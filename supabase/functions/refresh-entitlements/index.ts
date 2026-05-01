// refresh-entitlements
//
// POST (no body required).
// Headers: Authorization: Bearer <wix-headless-access-token>
//
// Resolves the caller's Wix identity, asks Wix for their ACTIVE pricing
// plan orders, maps them to our internal tier model, and upserts the
// canonical tier into `public.user_entitlements`. Returns the resulting
// entitlement so the frontend can update its UI.
//
// This is the ONLY place the canonical tier is written from a Wix lookup.
// All other Edge Functions should READ from `user_entitlements` via
// getEntitlement() and never trust client-supplied tier values.

import { verifyWixToken, wixAuthErrorResponse, WixAuthError } from "../_shared/wix-auth.ts";
import {
  highestTier,
  planNameToTier,
  upsertEntitlement,
  type Tier,
} from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WIX_ORDERS_URL =
  "https://www.wixapis.com/pricing-plans/v2/member/orders?orderStatuses=ACTIVE";

interface WixOrder {
  planName?: string;
  status?: string;
  endDate?: string;
}

async function fetchActiveOrders(token: string): Promise<WixOrder[]> {
  const wixClientId = Deno.env.get("WIX_CLIENT_ID");
  if (!wixClientId) {
    throw new WixAuthError(
      "missing_wix_client_id",
      "WIX_CLIENT_ID env var is not set",
      500,
    );
  }

  const tryFetch = (authValue: string) =>
    fetch(WIX_ORDERS_URL, {
      method: "GET",
      headers: {
        Authorization: authValue,
        "wix-client-id": wixClientId,
        Accept: "application/json",
      },
    });

  let res = await tryFetch(`Bearer ${token}`);
  if (res.status === 401 || res.status === 403) {
    await res.text().catch(() => undefined);
    res = await tryFetch(token);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WixAuthError(
      "wix_orders_failed",
      `Wix orders endpoint returned ${res.status}: ${body.slice(0, 200)}`,
      502,
    );
  }

  const payload = await res.json().catch(() => ({}));
  const orders = Array.isArray(payload?.orders) ? payload.orders : [];
  return orders as WixOrder[];
}

function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1].trim() : authHeader.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const identity = await verifyWixToken(authHeader);
    const token = extractBearer(authHeader)!;

    let orders: WixOrder[] = [];
    let ordersError: string | null = null;
    try {
      orders = await fetchActiveOrders(token);
    } catch (err) {
      // Don't fail the whole refresh if orders lookup blips: fall back to
      // free tier so the user is at least not stuck on a stale paid tier.
      ordersError = (err as Error).message;
      console.error("[refresh-entitlements] orders fetch failed:", ordersError);
    }

    const planNames = orders
      .map((o) => o.planName)
      .filter((n): n is string => typeof n === "string" && n.length > 0);

    const resolvedTier: Tier = planNames.length
      ? highestTier(planNames.map(planNameToTier))
      : "free";

    // Earliest end date among active orders, if any.
    let expiresAt: string | null = null;
    for (const o of orders) {
      if (o.endDate) {
        if (!expiresAt || o.endDate < expiresAt) expiresAt = o.endDate;
      }
    }

    const ent = await upsertEntitlement({
      wixUserId: identity.wixUserId,
      tier: resolvedTier,
      source: "wix",
      wixPlanNames: planNames,
      expiresAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        wix_user_id: ent.wixUserId,
        tier: ent.tier,
        wix_plan_names: ent.wixPlanNames,
        refreshed_at: ent.refreshedAt,
        expires_at: ent.expiresAt,
        orders_error: ordersError,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[refresh-entitlements] error:", err);
    return wixAuthErrorResponse(err, corsHeaders);
  }
});
