// Shared entitlement resolution for Edge Functions.
//
// The authoritative source of truth for "what tier is this user on" is the
// `public.user_entitlements` table. Edge Functions should call
// `getEntitlement(wixUserId)` to read it, and `refresh-entitlements` is the
// only function that should write to it (after talking to Wix).
//
// Tier model (canonical, internal):
//   free            - no active paid Wix plan
//   reid_base       - paid "Member" / "REID Base" plan
//   reid_base_pro   - paid "Team" / "REID Base Team" / "REID Base Pro" plan
//   enterprise      - "Enterprise" plan
//
// IMPORTANT: legacy `member` in older rows means "free" (unpaid). The paid
// Member tier maps to `reid_base`. Never trust a tier value from the client.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type Tier = "free" | "reid_base" | "reid_base_pro" | "enterprise";

export const TIER_PRIORITY: Record<Tier, number> = {
  free: 0,
  reid_base: 1,
  reid_base_pro: 2,
  enterprise: 3,
};

export interface Entitlement {
  wixUserId: string;
  tier: Tier;
  source: string;
  wixPlanNames: string[];
  refreshedAt: string;
  expiresAt: string | null;
}

const VALID_TIERS: Tier[] = ["free", "reid_base", "reid_base_pro", "enterprise"];

export function normaliseTier(value: unknown): Tier {
  if (typeof value !== "string") return "free";
  const v = value.trim().toLowerCase();
  // Legacy: "member" historically meant unpaid free.
  if (v === "member" || v === "freemium" || v === "" || v === "null") return "free";
  if ((VALID_TIERS as string[]).includes(v)) return v as Tier;
  return "free";
}

/**
 * Map a Wix pricing plan name to our internal tier code.
 * Match logic mirrors src/contexts/TierContext.tsx so the canonical tier
 * resolved server-side stays consistent with prior behaviour.
 */
export function planNameToTier(planName: string | null | undefined): Tier {
  if (!planName) return "free";
  const lower = planName.toLowerCase();
  if (lower.includes("enterprise")) return "enterprise";
  if (lower.includes("team") || lower.includes("pro")) return "reid_base_pro";
  if (lower.includes("reid base") || lower.includes("base") || lower === "member") {
    return "reid_base";
  }
  return "free";
}

export function highestTier(tiers: Tier[]): Tier {
  let best: Tier = "free";
  for (const t of tiers) {
    if (TIER_PRIORITY[t] > TIER_PRIORITY[best]) best = t;
  }
  return best;
}

export function meetsTier(actual: Tier, required: Tier): boolean {
  return TIER_PRIORITY[actual] >= TIER_PRIORITY[required];
}

let _serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  _serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceClient;
}

/**
 * Read the canonical entitlement for this Wix user. Returns a `free`
 * entitlement if no row exists. Never throws on "not found".
 */
export async function getEntitlement(wixUserId: string): Promise<Entitlement> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("wix_user_id, tier, source, wix_plan_names, refreshed_at, expires_at")
    .eq("wix_user_id", wixUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`entitlement_read_failed: ${error.message}`);
  }

  if (!data) {
    return {
      wixUserId,
      tier: "free",
      source: "default",
      wixPlanNames: [],
      refreshedAt: new Date(0).toISOString(),
      expiresAt: null,
    };
  }

  return {
    wixUserId: data.wix_user_id,
    tier: normaliseTier(data.tier),
    source: data.source ?? "wix",
    wixPlanNames: Array.isArray(data.wix_plan_names) ? data.wix_plan_names : [],
    refreshedAt: data.refreshed_at,
    expiresAt: data.expires_at,
  };
}

/**
 * Upsert the canonical entitlement for this Wix user. Only callers with the
 * service-role key (i.e. Edge Functions) can do this; the table has no
 * permissive policies for anon/authenticated roles.
 */
export async function upsertEntitlement(params: {
  wixUserId: string;
  tier: Tier;
  source?: string;
  wixPlanNames?: string[];
  expiresAt?: string | null;
}): Promise<Entitlement> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const row = {
    wix_user_id: params.wixUserId,
    tier: params.tier,
    source: params.source ?? "wix",
    wix_plan_names: params.wixPlanNames ?? [],
    expires_at: params.expiresAt ?? null,
    refreshed_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from("user_entitlements")
    .upsert(row, { onConflict: "wix_user_id" })
    .select("wix_user_id, tier, source, wix_plan_names, refreshed_at, expires_at")
    .single();
  if (error || !data) {
    throw new Error(`entitlement_write_failed: ${error?.message ?? "unknown"}`);
  }
  return {
    wixUserId: data.wix_user_id,
    tier: normaliseTier(data.tier),
    source: data.source ?? "wix",
    wixPlanNames: Array.isArray(data.wix_plan_names) ? data.wix_plan_names : [],
    refreshedAt: data.refreshed_at,
    expiresAt: data.expires_at,
  };
}

/**
 * Convenience guard: throw a 403-ready error if the entitlement does not
 * meet the minimum required tier.
 */
export class TierForbiddenError extends Error {
  status = 403;
  code = "tier_forbidden";
  constructor(public required: Tier, public actual: Tier) {
    super(`Requires tier '${required}' but caller has '${actual}'`);
  }
}

export function requireTier(entitlement: Entitlement, required: Tier): void {
  if (!meetsTier(entitlement.tier, required)) {
    throw new TierForbiddenError(required, entitlement.tier);
  }
}
