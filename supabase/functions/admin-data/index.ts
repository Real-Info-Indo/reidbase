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
        const [profilesRes, entitlementsRes, eventsRes, chatLogsRes] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("*")
            .order("last_login", { ascending: false })
            .limit(2000),
          supabase
            .from("user_entitlements")
            .select("wix_user_id, tier, wix_plan_names, refreshed_at"),
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
        if (entitlementsRes.error) throw entitlementsRes.error;
        if (eventsRes.error) throw eventsRes.error;
        if (chatLogsRes.error) throw chatLogsRes.error;

        const entitlementByUserId = new Map(
          (entitlementsRes.data ?? []).map((row) => [row.wix_user_id, row]),
        );

        const profiles = (profilesRes.data ?? []).map((profile) => {
          const entitlement = entitlementByUserId.get(profile.wix_user_id);
          return {
            ...profile,
            tier: entitlement?.tier ?? profile.tier ?? null,
            wix_plan_names: entitlement?.wix_plan_names ?? [],
            entitlement_refreshed_at: entitlement?.refreshed_at ?? null,
          };
        });

        return jsonResponse({
          profiles,
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
        const isIso = (v: unknown): v is string =>
          typeof v === "string" && !Number.isNaN(Date.parse(v));
        const toIso = isIso(body.to) ? body.to : new Date().toISOString();
        const fromIso = isIso(body.from)
          ? body.from
          : new Date(Date.parse(toIso) - 90 * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase.rpc("admin_analytics_summary", {
          p_from: fromIso,
          p_to: toIso,
        });
        if (error) {
          const msg = String(error.message ?? "");
          const missing = /does not exist|undefined function|could not find/i.test(msg)
            || (error as { code?: string }).code === "42883";
          if (missing) {
            return jsonResponse({
              error: "analytics_summary_unavailable",
              message:
                "admin_analytics_summary RPC is unavailable. The latest migration must be applied.",
            }, 503);
          }
          return jsonResponse({
            error: "analytics_summary_failed",
            message: `Analytics SQL function failed: ${msg}`,
          }, 500);
        }

        const aggregates =
          (data && typeof data === "object" && !Array.isArray(data))
            ? (data as Record<string, unknown>)
            : {};

        return jsonResponse({
          source: "server_aggregated",
          truncated: false,
          range: { from: fromIso, to: toIso },
          ...aggregates,
        });
      }

      case "user_aggregates": {
        const { data, error } = await supabase.rpc("admin_user_aggregates");
        if (error) {
          const msg = String(error.message ?? "");
          const missing = /does not exist|undefined function|could not find/i.test(msg)
            || (error as { code?: string }).code === "42883";
          if (missing) {
            return jsonResponse({
              error: "user_aggregates_unavailable",
              message:
                "admin_user_aggregates RPC is unavailable. The latest migration must be applied.",
            }, 503);
          }
          return jsonResponse({
            error: "user_aggregates_failed",
            message: msg,
          }, 500);
        }
        return jsonResponse({ aggregates: data ?? {} });
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

      case "affiliates": {
        const { data: affiliates, error: affErr } = await supabase
          .from("affiliates")
          .select("*")
          .order("created_at", { ascending: false });
        if (affErr) throw affErr;

        const ids = (affiliates ?? []).map((a) => a.id);
        let clickAgg: Record<string, number> = {};
        let attrRows: Array<{
          wix_user_id: string;
          affiliate_id: string;
          source: string;
          attributed_at: string;
          first_paid_at: string | null;
          first_paid_tier: string | null;
          wix_plan_names: string[];
        }> = [];

        if (ids.length) {
          const [{ data: clicks }, { data: attrs }] = await Promise.all([
            supabase
              .from("affiliate_clicks")
              .select("affiliate_id")
              .in("affiliate_id", ids),
            supabase
              .from("affiliate_attributions")
              .select("wix_user_id, affiliate_id, source, attributed_at, first_paid_at, first_paid_tier, wix_plan_names")
              .in("affiliate_id", ids)
              .order("attributed_at", { ascending: false }),
          ]);
          for (const c of clicks ?? []) {
            clickAgg[c.affiliate_id] = (clickAgg[c.affiliate_id] ?? 0) + 1;
          }
          attrRows = attrs ?? [];
        }

        // Enrich attributions with user email/name
        const userIds = Array.from(new Set(attrRows.map((r) => r.wix_user_id)));
        const profileMap: Record<string, { email: string | null; display_name: string | null }> = {};
        if (userIds.length) {
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("wix_user_id, email, display_name")
            .in("wix_user_id", userIds);
          for (const p of profiles ?? []) {
            profileMap[p.wix_user_id] = { email: p.email, display_name: p.display_name };
          }
        }

        const enrichedAttrs = attrRows.map((r) => ({
          ...r,
          email: profileMap[r.wix_user_id]?.email ?? null,
          display_name: profileMap[r.wix_user_id]?.display_name ?? null,
        }));

        return jsonResponse({
          affiliates: affiliates ?? [],
          click_counts: clickAgg,
          attributions: enrichedAttrs,
        });
      }

      default:
        return jsonResponse({ error: "unknown_action", action }, 400);
    }
  } catch (err) {
    return errorResponse(err);
  }
});

