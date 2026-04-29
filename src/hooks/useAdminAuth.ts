import { useState, useCallback, useEffect } from "react";

export const ADMIN_PASSWORD = "reid-admin-2025";
const STORAGE_KEY = "reid_admin_authed";

function readStored(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Shared admin auth state. Persists across admin pages within the
 * browser session so the user only needs to enter the password once.
 */
export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState<boolean>(readStored);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setAuthenticated(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signIn = useCallback((password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
      setAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const signOut = useCallback(() => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setAuthenticated(false);
  }, []);

  return { authenticated, signIn, signOut };
}
