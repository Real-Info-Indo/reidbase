// user-data: server-side hub for owner-scoped reads/writes against
// chat_logs, folders, user_profiles, chat_feedback, user_sessions, and
// shared_conversations. Identity is verified server-side via the Wix
// access token in the Authorization header. The wix_user_id from the
// verified identity is the only one ever written to / used to filter.
//
// Action dispatch:
//   GET-style:
//     hydrate                 -> { conversations, folders, profile }
//     check_session           -> { session_id, last_seen, is_owner }
//   POST-style:
//     upsert_chat_log         -> persist a conversation
//     patch_chat_log          -> partial update (rename, pin, folder, soft-delete)
//     log_feedback_count      -> increment copy/like/dislike on a chat_log
//     submit_feedback_comment -> insert chat_feedback row
//     upsert_folder           -> create/rename folder
//     delete_folder           -> hard-delete folder + null folder_id on logs
//     upsert_profile          -> upsert user_profiles row
//     register_session        -> upsert user_sessions row
//     heartbeat_session       -> update last_seen
//     share_conversation      -> insert shared_conversations row
//
// Owner enforcement: every write/read is scoped to the verified
// wix_user_id. The client cannot pass a different wix_user_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyWixToken, wixAuthErrorResponse } from "../_shared/wix-auth.ts";
import { getServiceClient } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(message: string): Response {
  return jsonResponse({ error: "bad_request", message }, 400);
}

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // 1. Verify Wix identity
  let identity;
  try {
    identity = await verifyWixToken(req.headers.get("Authorization"));
  } catch (err) {
    return wixAuthErrorResponse(err, corsHeaders);
  }
  const wixUserId = identity.wixUserId;

  // 2. Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid_json");
  }
  const action = body?.action;
  if (!isString(action)) return badRequest("missing_action");

  const supabase = getServiceClient();

  try {
    switch (action) {
      // ── HYDRATE ──────────────────────────────────────────
      case "hydrate": {
        const [{ data: chatLogs }, { data: folders }, { data: profile }] = await Promise.all([
          supabase
            .from("chat_logs")
            .select(
              "conversation_id, title, messages, search_mode, updated_at, pinned, folder_id, deleted_at",
            )
            .eq("wix_user_id", wixUserId)
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
            .limit(100),
          supabase
            .from("folders")
            .select("id, name, created_at")
            .eq("wix_user_id", wixUserId)
            .order("created_at", { ascending: true }),
          supabase
            .from("user_profiles")
            .select("nickname, occupation, business, about, display_name, email")
            .eq("wix_user_id", wixUserId)
            .maybeSingle(),
        ]);
        return jsonResponse({
          conversations: chatLogs ?? [],
          folders: folders ?? [],
          profile: profile ?? null,
          identity: {
            wix_user_id: wixUserId,
            display_name: identity.displayName,
            email: identity.email,
          },
        });
      }

      // ── CHAT LOGS ────────────────────────────────────────
      case "upsert_chat_log": {
        const c = body.conversation;
        if (!c || !isString(c.conversation_id)) return badRequest("missing_conversation");

        // Owner check: if a row already exists for this conversation_id and
        // it belongs to a different Wix user, refuse. Service role bypasses
        // RLS, so without this check a caller could overwrite anyone's row
        // by guessing or reusing a conversation_id.
        const { data: existing, error: existingErr } = await supabase
          .from("chat_logs")
          .select("wix_user_id")
          .eq("conversation_id", c.conversation_id)
          .maybeSingle();
        if (existingErr) {
          return jsonResponse({ error: "lookup_failed", message: existingErr.message }, 500);
        }
        if (
          existing &&
          (existing as any).wix_user_id &&
          (existing as any).wix_user_id !== wixUserId
        ) {
          return jsonResponse({ error: "forbidden" }, 403);
        }

        const row = {
          conversation_id: c.conversation_id,
          wix_user_id: wixUserId,
          wix_user_name: identity.displayName,
          wix_user_email: identity.email,
          title: isString(c.title) ? c.title : "New conversation",
          messages: Array.isArray(c.messages) ? c.messages : [],
          search_mode: isString(c.search_mode) ? c.search_mode : "data-analyst",
          user_tier: isString(c.user_tier) ? c.user_tier : null,
          message_count: Array.isArray(c.messages) ? c.messages.length : 0,
          updated_at: new Date().toISOString(),
          pinned: !!c.pinned,
          folder_id: isString(c.folder_id) ? c.folder_id : null,
        };
        const { error } = await supabase
          .from("chat_logs")
          .upsert(row, { onConflict: "conversation_id" });
        if (error) return jsonResponse({ error: "upsert_failed", message: error.message }, 500);
        return jsonResponse({ ok: true });
      }

      case "patch_chat_log": {
        const conversationId = body.conversation_id;
        const patch = body.patch;
        if (!isString(conversationId) || !patch || typeof patch !== "object") {
          return badRequest("missing_conversation_id_or_patch");
        }
        // Whitelist of mutable fields
        const allowed: Record<string, unknown> = {};
        if ("title" in patch) allowed.title = patch.title;
        if ("pinned" in patch) allowed.pinned = !!patch.pinned;
        if ("folder_id" in patch) allowed.folder_id = patch.folder_id ?? null;
        if ("deleted_at" in patch) allowed.deleted_at = patch.deleted_at;
        if (Object.keys(allowed).length === 0) return badRequest("empty_patch");
        allowed.updated_at = new Date().toISOString();

        // Owner-scoped update only
        const { error } = await supabase
          .from("chat_logs")
          .update(allowed)
          .eq("conversation_id", conversationId)
          .eq("wix_user_id", wixUserId);
        if (error) return jsonResponse({ error: "patch_failed", message: error.message }, 500);
        return jsonResponse({ ok: true });
      }

      case "log_feedback_count": {
        const conversationId = body.conversation_id;
        const kind = body.kind;
        if (!isString(conversationId)) return badRequest("missing_conversation_id");
        if (kind !== "copy" && kind !== "like" && kind !== "dislike") {
          return badRequest("invalid_kind");
        }
        // Atomic increment via SECURITY DEFINER RPC. The function only
        // increments rows where wix_user_id matches the verified caller
        // (or is null/legacy). Returns the new value, or null if the row
        // did not match.
        const { data, error } = await supabase.rpc("increment_chat_feedback_counter", {
          _conversation_id: conversationId,
          _wix_user_id: wixUserId,
          _kind: kind,
        });
        if (error) return jsonResponse({ error: "update_failed", message: error.message }, 500);
        if (data === null || typeof data === "undefined") {
          return jsonResponse({ error: "not_found_or_forbidden" }, 404);
        }
        const colMap: Record<string, string> = {
          copy: "copy_count",
          like: "likes",
          dislike: "dislikes",
        };
        return jsonResponse({ ok: true, [colMap[kind]]: data });
      }

      case "submit_feedback_comment": {
        const conversationId = body.conversation_id;
        const rating = body.rating;
        const comment = body.comment;
        const messageIndex = body.message_index;
        if (!isString(conversationId)) return badRequest("missing_conversation_id");
        if (rating !== "like" && rating !== "dislike") return badRequest("invalid_rating");
        const { error } = await supabase.from("chat_feedback").insert({
          conversation_id: conversationId,
          message_index: typeof messageIndex === "number" ? messageIndex : null,
          rating,
          comment: typeof comment === "string" && comment.trim().length > 0 ? comment.trim() : null,
          wix_user_id: wixUserId,
          wix_user_name: identity.displayName,
          wix_user_email: identity.email,
        });
        if (error) return jsonResponse({ error: "insert_failed", message: error.message }, 500);
        return jsonResponse({ ok: true });
      }

      // ── FOLDERS ──────────────────────────────────────────
      case "upsert_folder": {
        const folder = body.folder;
        if (!folder || !isString(folder.id) || !isString(folder.name)) {
          return badRequest("missing_folder");
        }

        // Owner check: refuse to overwrite a folder owned by someone else.
        const { data: existing, error: existingErr } = await supabase
          .from("folders")
          .select("wix_user_id")
          .eq("id", folder.id)
          .maybeSingle();
        if (existingErr) {
          return jsonResponse({ error: "lookup_failed", message: existingErr.message }, 500);
        }
        if (
          existing &&
          (existing as any).wix_user_id &&
          (existing as any).wix_user_id !== wixUserId
        ) {
          return jsonResponse({ error: "forbidden" }, 403);
        }

        const { error } = await supabase.from("folders").upsert(
          {
            id: folder.id,
            name: folder.name,
            wix_user_id: wixUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
        if (error) return jsonResponse({ error: "upsert_failed", message: error.message }, 500);
        return jsonResponse({ ok: true });
      }

      case "delete_folder": {
        const folderId = body.folder_id;
        if (!isString(folderId)) return badRequest("missing_folder_id");
        // Owner check
        const { data: existing } = await supabase
          .from("folders")
          .select("wix_user_id")
          .eq("id", folderId)
          .maybeSingle();
        if (existing && (existing as any).wix_user_id !== wixUserId) {
          return jsonResponse({ error: "forbidden" }, 403);
        }
        const { error: delErr } = await supabase
          .from("folders")
          .delete()
          .eq("id", folderId)
          .eq("wix_user_id", wixUserId);
        if (delErr) return jsonResponse({ error: "delete_failed", message: delErr.message }, 500);
        // Null out folder_id on owner's chat logs
        await supabase
          .from("chat_logs")
          .update({ folder_id: null, updated_at: new Date().toISOString() })
          .eq("wix_user_id", wixUserId)
          .eq("folder_id", folderId);
        return jsonResponse({ ok: true });
      }

      // ── PROFILE ──────────────────────────────────────────
      // Note: tier is intentionally NOT writable here. Entitlement / tier
      // lives only in `public.user_entitlements`, populated by
      // `refresh-entitlements` after talking to Wix. Any `body.tier` sent
      // by the client is silently ignored.
      case "upsert_profile": {
        const p = body.profile ?? {};
        const row = {
          wix_user_id: wixUserId,
          display_name: identity.displayName,
          email: identity.email,
          business: typeof p.business === "string" ? p.business : null,
          nickname: typeof p.nickname === "string" ? p.nickname : null,
          occupation: typeof p.occupation === "string" ? p.occupation : null,
          about: typeof p.about === "string" ? p.about : null,
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("user_profiles")
          .upsert(row, { onConflict: "wix_user_id" });
        if (error) return jsonResponse({ error: "upsert_failed", message: error.message }, 500);
        return jsonResponse({ ok: true });
      }

      // ── SESSIONS ─────────────────────────────────────────
      case "register_session": {
        const sessionId = body.session_id;
        if (!isString(sessionId)) return badRequest("missing_session_id");
        const { error } = await supabase.from("user_sessions").upsert(
          {
            wix_user_id: wixUserId,
            session_id: sessionId,
            last_seen: new Date().toISOString(),
          },
          { onConflict: "wix_user_id" },
        );
        if (error) return jsonResponse({ error: "register_failed", message: error.message }, 500);
        return jsonResponse({ ok: true });
      }

      case "check_session": {
        const sessionId = body.session_id;
        if (!isString(sessionId)) return badRequest("missing_session_id");
        const { data, error } = await supabase
          .from("user_sessions")
          .select("session_id, last_seen")
          .eq("wix_user_id", wixUserId)
          .maybeSingle();
        if (error) return jsonResponse({ error: "read_failed", message: error.message }, 500);
        const isOwner = !!data && data.session_id === sessionId;
        if (isOwner) {
          await supabase
            .from("user_sessions")
            .update({ last_seen: new Date().toISOString() })
            .eq("wix_user_id", wixUserId)
            .eq("session_id", sessionId);
        }
        return jsonResponse({
          session_id: data?.session_id ?? null,
          last_seen: data?.last_seen ?? null,
          is_owner: isOwner,
        });
      }

      // ── SHARE LINK ───────────────────────────────────────
      case "share_conversation": {
        const c = body.conversation;
        const shareId = body.share_id;
        if (!isString(shareId) || !c || !isString(c.conversation_id)) {
          return badRequest("missing_share_input");
        }
        // Confirm caller owns the source conversation (if it exists)
        const { data: src } = await supabase
          .from("chat_logs")
          .select("wix_user_id")
          .eq("conversation_id", c.conversation_id)
          .maybeSingle();
        if (src && (src as any).wix_user_id && (src as any).wix_user_id !== wixUserId) {
          return jsonResponse({ error: "forbidden" }, 403);
        }
        const { error } = await supabase.from("shared_conversations").insert({
          id: shareId,
          source_conversation_id: c.conversation_id,
          title: isString(c.title) ? c.title : "Shared conversation",
          messages: Array.isArray(c.messages) ? c.messages : [],
          search_mode: isString(c.search_mode) ? c.search_mode : null,
          sharer_wix_user_id: wixUserId,
          sharer_name: identity.displayName,
          sharer_tier: isString(c.tier) ? c.tier : null,
        });
        if (error) return jsonResponse({ error: "insert_failed", message: error.message }, 500);
        return jsonResponse({ ok: true, share_id: shareId });
      }


      // ── SUMMARY REFRESH ──────────────────────────────────
      // Owner-scoped wrapper around `summarise-conversation`. Verifies the
      // caller owns the conversation, then calls the internal function with
      // a shared internal token (see summarise-conversation auth check).
      case "refresh_summary": {
        const conversationId = body.conversation_id;
        const force = !!body.force;
        if (!isString(conversationId)) return badRequest("missing_conversation_id");

        const { data: src, error: srcErr } = await supabase
          .from("chat_logs")
          .select("wix_user_id")
          .eq("conversation_id", conversationId)
          .maybeSingle();
        if (srcErr) return jsonResponse({ error: "lookup_failed", message: srcErr.message }, 500);
        if (!src) return jsonResponse({ error: "not_found" }, 404);
        if ((src as any).wix_user_id && (src as any).wix_user_id !== wixUserId) {
          return jsonResponse({ error: "forbidden" }, 403);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || serviceRoleKey;
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/summarise-conversation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
              "x-internal-token": internalToken,
            },
            body: JSON.stringify({ conversationId, force }),
          });
          const out = await resp.json().catch(() => ({}));
          return jsonResponse(out, resp.status);
        } catch (err) {
          return jsonResponse(
            { error: "summarise_invoke_failed", message: (err as Error).message },
            502,
          );
        }
      }

      default:
        return badRequest(`unknown_action: ${action}`);
    }
  } catch (err) {
    console.error("user-data error:", err);
    return jsonResponse(
      { error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
