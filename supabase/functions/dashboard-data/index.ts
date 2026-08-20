// dashboard-data
//
// Read-only reporting endpoint for the native REID dashboard (/dashboard-v2).
// Admin-gated: the caller's Wix access token is verified, then their wix_user_id
// must be present in public.admin_users. All aggregation happens inside the
// SECURITY DEFINER functions public.reid_dashboard_metrics /
// public.reid_dashboard_filter_options, which are callable only with the
// service-role key. No client-supplied SQL is ever executed.

import { verifyWixToken, wixAuthErrorResponse } from "../_shared/wix-auth.ts";
import { requireAdmin } from "../_shared/admin.ts";
import { getServiceClient } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODULES = new Set([
  "market-overview",
  "supply-trends",
  "sales-trends",
  "property-trends",
  "rental-trends",
  "location-report",
]);

const STRING_FILTERS = ["region", "location", "contract", "ptype", "date_from", "date_to"] as const;
const NUMERIC_FILTERS = ["beds", "price_min", "price_max", "size_min", "size_max"] as const;

/** Whitelist and coerce the filter payload. Anything unrecognised is dropped. */
function sanitiseFilters(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;

  for (const key of STRING_FILTERS) {
    const v = src[key];
    if (typeof v === "string" && v.trim() !== "" && v.length <= 64) {
      out[key] = v.trim();
    }
  }
  for (const key of NUMERIC_FILTERS) {
    const v = src[key];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n)) out[key] = String(n);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const identity = await verifyWixToken(req.headers.get("Authorization"));
    await requireAdmin(identity.wixUserId);

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      module?: string;
      filters?: unknown;
    };

    const supabase = getServiceClient();
    const action = body.action ?? "metrics";

    if (action === "filter_options") {
      const { data, error } = await supabase.rpc("reid_dashboard_filter_options");
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify(data ?? {}), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "metrics") {
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const moduleKey = String(body.module ?? "");
    if (!MODULES.has(moduleKey)) {
      return new Response(JSON.stringify({ error: "unknown_module" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filters = sanitiseFilters(body.filters);
    const { data, error } = await supabase.rpc("reid_dashboard_metrics", {
      p_module: moduleKey,
      p_filters: filters,
    });
    if (error) throw new Error(error.message);

    return new Response(JSON.stringify(data ?? {}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 403) {
      return new Response(JSON.stringify({ error: "admin_forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authResponse = wixAuthErrorResponse(err, corsHeaders);
    if (authResponse) return authResponse;
    return new Response(
      JSON.stringify({ error: "dashboard_data_failed", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
