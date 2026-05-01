// admin-mutate
//
// Single write endpoint for admin actions. Verifies Wix identity, requires
// admin, then dispatches based on `action`. Uses the service-role client
// so it works regardless of the (currently permissive) RLS policies.
//
// Actions:
//   - "delete_chat_log"       → { id }
//   - "review_chat_flag"      → { id, admin_notes? }
//   - "review_appraisal"      → { id }
//   - "save_appraisal_notes"  → { id, admin_notes }

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
  console.error("admin-mutate error:", err);
  return jsonResponse(
    { error: "internal_error", message: (err as Error).message },
    500,
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const action = String(body.action ?? "");
  const supabase = getServiceClient();

  try {
    switch (action) {
      case "delete_chat_log": {
        if (!isUuid(body.id)) return jsonResponse({ error: "invalid_id" }, 400);
        const { error } = await supabase
          .from("chat_logs")
          .delete()
          .eq("id", body.id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      case "review_chat_flag": {
        if (!isUuid(body.id)) return jsonResponse({ error: "invalid_id" }, 400);
        const adminNotes =
          typeof body.admin_notes === "string" && body.admin_notes.length > 0
            ? body.admin_notes.slice(0, 4000)
            : null;
        const { error } = await supabase
          .from("chat_flags")
          .update({ reviewed: true, admin_notes: adminNotes })
          .eq("id", body.id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      case "review_appraisal": {
        if (!isUuid(body.id)) return jsonResponse({ error: "invalid_id" }, 400);
        const { error } = await supabase
          .from("appraisal_requests")
          .update({
            status: "reviewed",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", body.id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      case "save_appraisal_notes": {
        if (!isUuid(body.id)) return jsonResponse({ error: "invalid_id" }, 400);
        const notes =
          typeof body.admin_notes === "string"
            ? body.admin_notes.slice(0, 8000)
            : "";
        const { error } = await supabase
          .from("appraisal_requests")
          .update({ admin_notes: notes })
          .eq("id", body.id);
        if (error) throw error;
        return jsonResponse({ ok: true });
      }

      default:
        return jsonResponse({ error: "unknown_action", action }, 400);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
