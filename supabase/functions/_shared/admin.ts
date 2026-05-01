// Shared admin check for Edge Functions.
//
// Admin status is sourced from `public.admin_users` via the SECURITY DEFINER
// function `public.has_admin(_wix_user_id text)`. EXECUTE on that function
// has been REVOKED from PUBLIC/anon/authenticated, so it can only be called
// from Edge Functions using the service-role key.
//
// Never trust an "is admin" signal from the client. Always resolve the
// caller's Wix identity via verifyWixToken() first, then call
// isAdmin(identity.wixUserId) here.

import { getServiceClient } from "./entitlements.ts";

const adminCache = new Map<string, { value: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

export class AdminForbiddenError extends Error {
  status = 403;
  code = "admin_forbidden";
  constructor() {
    super("Admin privileges required");
  }
}

export async function isAdmin(wixUserId: string): Promise<boolean> {
  if (!wixUserId) return false;
  const now = Date.now();
  const cached = adminCache.get(wixUserId);
  if (cached && cached.expiresAt > now) return cached.value;

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("has_admin", {
    _wix_user_id: wixUserId,
  });
  if (error) {
    throw new Error(`admin_check_failed: ${error.message}`);
  }
  const value = data === true;
  adminCache.set(wixUserId, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

export async function requireAdmin(wixUserId: string): Promise<void> {
  const ok = await isAdmin(wixUserId);
  if (!ok) throw new AdminForbiddenError();
}
