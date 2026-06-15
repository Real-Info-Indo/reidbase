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

      case "delete_appraisal": {
        if (!isUuid(body.id)) return jsonResponse({ error: "invalid_id" }, 400);
        const { error } = await supabase
          .from("appraisal_requests")
          .delete()
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

      case "upsert_affiliate": {
        const id = typeof body.id === "string" && isUuid(body.id) ? body.id : null;
        const slugRaw = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
        const slug = slugRaw.replace(/[^a-z0-9_-]/g, "").slice(0, 80);
        const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
        if (!slug || !name) return jsonResponse({ error: "missing_slug_or_name" }, 400);

        const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : null;
        const coupon = typeof body.wix_coupon_code === "string"
          ? body.wix_coupon_code.trim().slice(0, 100) || null
          : null;
        const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;
        const active = typeof body.active === "boolean" ? body.active : true;
        const rateNum = Number(body.commission_rate);
        const commission_rate = Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 1
          ? rateNum
          : 0.15;

        const row = { slug, name, email, wix_coupon_code: coupon, notes, active, commission_rate };
        const query = id
          ? supabase.from("affiliates").update(row).eq("id", id).select().single()
          : supabase.from("affiliates").insert(row).select().single();

        const { data, error } = await query;
        if (error) throw error;
        return jsonResponse({ ok: true, affiliate: data });
      }

      case "delete_affiliate": {
        if (!isUuid(body.id)) return jsonResponse({ error: "invalid_id" }, 400);
        // Refuse delete if attributions exist (FK is RESTRICT). Deactivate instead.
        const { count } = await supabase
          .from("affiliate_attributions")
          .select("wix_user_id", { count: "exact", head: true })
          .eq("affiliate_id", body.id);
        if ((count ?? 0) > 0) {
          const { error } = await supabase
            .from("affiliates")
            .update({ active: false })
            .eq("id", body.id);
          if (error) throw error;
          return jsonResponse({ ok: true, deactivated: true });
        }
        const { error } = await supabase.from("affiliates").delete().eq("id", body.id);
        if (error) throw error;
        return jsonResponse({ ok: true, deleted: true });
      }

      default:
        return jsonResponse({ error: "unknown_action", action }, 400);
    }
  } catch (err) {
    return errorResponse(err);
  }
});
