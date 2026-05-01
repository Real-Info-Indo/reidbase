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

  let body: { action?: string } = {};
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
        const [eventsRes, logsRes, appraisalRes] = await Promise.all([
          supabase
            .from("analytics_events")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20000),
          supabase
            .from("chat_logs")
            .select(
              "id,conversation_id,wix_user_id,wix_user_name,message_count,search_mode,created_at,updated_at",
            )
            .order("updated_at", { ascending: false })
            .limit(5000),
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

      default:
        return jsonResponse({ error: "unknown_action", action }, 400);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
