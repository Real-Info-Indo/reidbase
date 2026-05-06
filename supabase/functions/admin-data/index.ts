// admin-data
//
// Single read endpoint for the admin dashboard. Verifies Wix identity,
// requires admin status, then dispatches on `action` to read from the
// canonical tables using the service-role client.
//
// Why a single function: keeps wix verification + admin check in one place,
// avoids deploying ~6 near-identical functions, and makes Phase 2 lockdown
// (revoking the permissive RLS) a single audit target.
//
// Actions:
//   - "users"           → user_profiles + analytics_events + chat_logs counts
//   - "chat_logs"       → recent chat_logs (full messages)
//   - "analytics"       → analytics_events + chat_log summaries + new appraisal count
//   - "appraisals"      → appraisal_requests
//   - "chat_flags"      → chat_flags
//
// Frontend usage:
//   supabase.functions.invoke("admin-data", {
//     headers: { Authorization: `Bearer ${wixToken}` },
//     body: { action: "users" },
//   });

import { verifyWixToken, wixAuthErrorResponse } from "../_shared/wix-auth.ts";
import { requireAdmin, AdminForbiddenError } from "../_shared/admin.ts";
import { getServiceClient } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof AdminForbiddenError) {
    return jsonResponse({ error: err.code, message: err.message }, err.status);
  }
  console.error("admin-data error:", err);
  return jsonResponse(
    { error: "internal_error", message: (err as Error).message },
    500,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let identity;
  try {
    identity = await verifyWixToken(req.headers.get("Authorization"));
  } catch (err) {
    return wixAuthErrorResponse(err, corsHeaders);
  }

  try {
    await requireAdmin(identity.wixUserId);
  } catch (err) {
    return errorResponse(err);
  }

  let body: { action?: string; from?: string; to?: string; path?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const action = String(body.action ?? "");
  const supabase = getServiceClient();

  try {
    switch (action) {
      case "users": {
        const [profilesRes, eventsRes, chatLogsRes] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("*")
            .order("last_login", { ascending: false })
            .limit(2000),
          supabase
            .from("analytics_events")
            .select("wix_user_id, event_type, event_name, page_path, metadata")
            .limit(50000),
          supabase
            .from("chat_logs")
            .select("wix_user_id")
            .limit(20000),
        ]);
        if (profilesRes.error) throw profilesRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (chatLogsRes.error) throw chatLogsRes.error;

        return jsonResponse({
          profiles: profilesRes.data ?? [],
          events: eventsRes.data ?? [],
          chatLogs: chatLogsRes.data ?? [],
        });
      }

      case "chat_logs": {
        const { data, error } = await supabase
          .from("chat_logs")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return jsonResponse({ logs: data ?? [] });
      }

      case "analytics": {
        // Server-side date range. Defaults to the last 90 days when omitted
        // so a fresh page load doesn't pull the entire table.
        const isIso = (v: unknown): v is string =>
          typeof v === "string" && !Number.isNaN(Date.parse(v));
        const toIso = isIso(body.to) ? body.to : new Date().toISOString();
        const fromIso = isIso(body.from)
          ? body.from
          : new Date(Date.parse(toIso) - 90 * 24 * 60 * 60 * 1000).toISOString();

        let eventsQuery = supabase
          .from("analytics_events")
          .select("*")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false })
          .limit(50000);

        let logsQuery = supabase
          .from("chat_logs")
          .select(
            "id,conversation_id,wix_user_id,wix_user_name,message_count,search_mode,created_at,updated_at",
          )
          .gte("updated_at", fromIso)
          .lte("updated_at", toIso)
          .order("updated_at", { ascending: false })
          .limit(20000);

        const [eventsRes, logsRes, appraisalRes] = await Promise.all([
          eventsQuery,
          logsQuery,
          supabase
            .from("appraisal_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "new"),
        ]);
        if (eventsRes.error) throw eventsRes.error;
        if (logsRes.error) throw logsRes.error;
        if (appraisalRes.error) throw appraisalRes.error;

        return jsonResponse({
          events: eventsRes.data ?? [],
          chatLogs: logsRes.data ?? [],
          newAppraisalCount: appraisalRes.count ?? 0,
          range: { from: fromIso, to: toIso },
        });
      }

      case "appraisals": {
        const { data, error } = await supabase
          .from("appraisal_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return jsonResponse({ requests: data ?? [] });
      }

      case "chat_flags": {
        const { data, error } = await supabase
          .from("chat_flags")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        return jsonResponse({ flags: data ?? [] });
      }

      case "appraisal_file_url": {
        // Create a short-lived signed URL for an admin to download a file
        // attached to an appraisal request. Restricted to the `appraisals`
        // bucket and the `appraisal-requests/` prefix, so admins cannot use
        // this endpoint to read arbitrary storage objects.
        const path = String((body as { path?: string }).path ?? "");
        if (!path || path.includes("..") || path.startsWith("/")) {
          return jsonResponse({ error: "invalid_path" }, 400);
        }
        if (!path.startsWith("appraisal-requests/")) {
          return jsonResponse({ error: "invalid_path" }, 400);
        }
        const { data, error } = await supabase.storage
          .from("appraisals")
          .createSignedUrl(path, 60); // 60 seconds
        if (error || !data?.signedUrl) {
          return jsonResponse(
            { error: "signed_url_failed", message: error?.message ?? "unknown" },
            500,
          );
        }
        return jsonResponse({ url: data.signedUrl, expiresIn: 60 });
      }

      default:
        return jsonResponse({ error: "unknown_action", action }, 400);
    }
  } catch (err) {
    return errorResponse(err);
  }
});

