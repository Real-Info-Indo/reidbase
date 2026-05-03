// Logs analytics events server-side. Never trusts client-supplied identity.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyWixToken, WixAuthError } from "../_shared/wix-auth.ts";
import { getEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EVENT_TYPES = new Set(["page_view", "feature"]);
const MAX_EVENT_NAME = 120;
const MAX_PAGE_PATH = 512;
const MAX_SESSION_ID = 128;

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType = typeof body.event_type === "string" ? body.event_type : "";
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return new Response(JSON.stringify({ error: "invalid_event_type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventName = clampStr(body.event_name, MAX_EVENT_NAME);
  if (!eventName) {
    return new Response(JSON.stringify({ error: "invalid_event_name" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pagePath = clampStr(body.page_path, MAX_PAGE_PATH);
  const sessionId = clampStr(body.session_id, MAX_SESSION_ID);
  const clientMeta =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  // Strip any client-supplied identity fields from metadata.
  const { user_tier: _ut, wix_user_id: _wid, ...safeMeta } = clientMeta;

  let wixUserId: string | null = null;
  let tier = "free";
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.trim()) {
    try {
      const identity = await verifyWixToken(authHeader);
      wixUserId = identity.wixUserId;
      const ent = await getEntitlement(wixUserId);
      tier = ent.tier;
    } catch (err) {
      if (err instanceof WixAuthError) {
        // Treat invalid tokens as anonymous to avoid breaking page tracking.
        wixUserId = null;
        tier = "free";
      } else {
        throw err;
      }
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await supabase.from("analytics_events").insert({
    event_type: eventType,
    event_name: eventName,
    page_path: pagePath,
    session_id: sessionId,
    wix_user_id: wixUserId,
    metadata: { user_tier: tier, ...safeMeta },
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: "insert_failed", message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
