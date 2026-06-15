// track-affiliate-click
//
// Public endpoint (no Wix auth). Called from the browser when a visitor
// lands with ?ref=<slug>. Writes one row to public.affiliate_clicks if the
// slug matches an active affiliate. Idempotent: dedupes the same
// affiliate/visitor pair within a 30-minute window so refreshes don't
// inflate click counts.

import { getServiceClient } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const trim = (v: unknown, max = 500) =>
  typeof v === "string" ? v.slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase().slice(0, 80) : "";
  const visitorId = typeof body.visitor_id === "string" ? body.visitor_id.slice(0, 80) : null;
  if (!slug) return json({ error: "missing_slug" }, 400);

  const supabase = getServiceClient();

  const { data: affiliate, error: affErr } = await supabase
    .from("affiliates")
    .select("id, active")
    .eq("slug", slug)
    .maybeSingle();

  if (affErr) return json({ error: "lookup_failed", message: affErr.message }, 500);
  if (!affiliate || !affiliate.active) {
    // Don't leak existence; just no-op.
    return json({ ok: true, recorded: false });
  }

  // Dedupe: skip if same visitor already clicked this affiliate in last 30 min.
  if (visitorId) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("affiliate_clicks")
      .select("id")
      .eq("affiliate_id", affiliate.id)
      .eq("visitor_id", visitorId)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      return json({ ok: true, recorded: false, deduped: true });
    }
  }

  const { error: insErr } = await supabase.from("affiliate_clicks").insert({
    affiliate_id: affiliate.id,
    visitor_id: visitorId,
    landing_path: trim(body.landing_path, 500),
    referrer: trim(body.referrer, 500),
    utm_source: trim(body.utm_source, 100),
    utm_medium: trim(body.utm_medium, 100),
    utm_campaign: trim(body.utm_campaign, 100),
    user_agent: trim(req.headers.get("user-agent"), 500),
  });

  if (insErr) return json({ error: "insert_failed", message: insErr.message }, 500);
  return json({ ok: true, recorded: true });
});
