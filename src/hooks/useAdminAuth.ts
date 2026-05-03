import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { wixAuthHeader, getWixAccessToken } from "@/lib/wixToken";

/**
 * Phase 1B + hardening: admin auth is sourced from the server on every mount.
 *
 * We verify the user's Wix access token against `check-admin`, which calls
 * the SECURITY DEFINER `public.has_admin()` RPC with the service-role key
 * and returns `{ isAdmin: true }` only when the verified Wix user id exists
 * in `public.admin_users`.
 *
 * SECURITY: We deliberately do NOT cache `authenticated=true` in
 * sessionStorage. A stale flag from a previous admin sign-in on the same
 * device must never let a different (or downgraded) account render admin
 * content. `authenticated` always starts `false` and only flips to `true`
 * after a successful server verification in this mount.
 */
export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setChecking(true);
    setError(null);
    const token = getWixAccessToken();
    if (!token) {
      setAuthenticated(false);
      setError("not_logged_in");
      setChecking(false);
      return false;
    }
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "check-admin",
        { headers: await wixAuthHeader() },
      );
      if (invokeError) throw new Error(invokeError.message);
      const isAdmin = !!(data as { isAdmin?: boolean })?.isAdmin;
      setAuthenticated(isAdmin);
      if (!isAdmin) setError("not_admin");
      setChecking(false);
      return isAdmin;
    } catch (e) {
      setAuthenticated(false);
      setError((e as Error).message || "verify_failed");
      setChecking(false);
      return false;
    }
  }, []);

  useEffect(() => { void verify(); }, [verify]);

  const signOut = useCallback(() => {
    setAuthenticated(false);
  }, []);

  return { authenticated, checking, error, verify, signOut };
}
