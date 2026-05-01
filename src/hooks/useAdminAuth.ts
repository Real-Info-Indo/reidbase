import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { wixAuthHeader, getWixAccessToken } from "@/lib/wixToken";

const STORAGE_KEY = "reid_admin_authed";

/**
 * Phase 1B: admin auth is now sourced from the server.
 *
 * We verify the user's Wix access token against `check-admin`, which in
 * turn calls the SECURITY DEFINER `public.has_admin()` RPC with the
 * service-role key. There is no shared password anymore.
 *
 * The result is cached in sessionStorage so admins don't re-verify on every
 * navigation, but `verify()` is called on mount to keep state fresh.
 */
export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState<boolean>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [checking, setChecking] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setChecking(true);
    setError(null);
    const token = getWixAccessToken();
    if (!token) {
      setAuthenticated(false);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setError("not_logged_in");
      setChecking(false);
      return false;
    }
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "check-admin",
        { headers: wixAuthHeader() },
      );
      if (invokeError) throw new Error(invokeError.message);
      const isAdmin = !!(data as { isAdmin?: boolean })?.isAdmin;
      setAuthenticated(isAdmin);
      try {
        if (isAdmin) sessionStorage.setItem(STORAGE_KEY, "1");
        else sessionStorage.removeItem(STORAGE_KEY);
      } catch { /* ignore */ }
      if (!isAdmin) setError("not_admin");
      setChecking(false);
      return isAdmin;
    } catch (e) {
      setAuthenticated(false);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setError((e as Error).message || "verify_failed");
      setChecking(false);
      return false;
    }
  }, []);

  useEffect(() => { void verify(); }, [verify]);

  const signOut = useCallback(() => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setAuthenticated(false);
  }, []);

  return { authenticated, checking, error, verify, signOut };
}
