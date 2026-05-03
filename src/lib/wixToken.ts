// Helper to extract the current Wix access token from the wix client and
// build a fetch-style Authorization header for Edge Function calls.
//
// The Wix Headless OAuth tokens are persisted in localStorage under
// "wix-tokens" (see src/contexts/WixAuthContext.tsx). The shape is:
//   { accessToken: { value, expiresAt }, refreshToken: { value, ... } }
//
// Wix access tokens are short-lived (~5 minutes). The SDK auto-refreshes
// during its own API calls but does NOT write the renewed tokens back to
// localStorage. Edge function calls read from localStorage directly, so
// without proactive refresh here they would send a stale token and Wix
// would reject it ("invalid_token: Wix rejected the token").

import { wixClient } from "@/lib/wixClient";

const TOKEN_KEY = "wix-tokens";
// Refresh slightly before the documented expiry to absorb clock skew and
// network latency.
const REFRESH_SKEW_MS = 30_000;

function readStoredTokens(): any | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredTokens(tokens: any) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch {
    // ignore storage failures
  }
}

/** Synchronous read — may return a stale token. Prefer getFreshWixAccessToken. */
export function getWixAccessToken(): string | null {
  const tokens = readStoredTokens();
  return tokens?.accessToken?.value ?? null;
}

/**
 * Returns a non-expired Wix access token, renewing via the SDK if needed.
 * Persists the renewed tokens back to localStorage so subsequent calls
 * (including non-async ones) read fresh values.
 */
export async function getFreshWixAccessToken(): Promise<string | null> {
  const stored = readStoredTokens();
  if (!stored?.accessToken?.value) return null;

  const expiresAt = Number(stored.accessToken.expiresAt) || 0;
  // expiresAt from the SDK is a unix epoch in seconds.
  const expiresAtMs = expiresAt > 1e12 ? expiresAt : expiresAt * 1000;
  const isExpired = !expiresAtMs || expiresAtMs - REFRESH_SKEW_MS < Date.now();

  if (!isExpired) return stored.accessToken.value;

  const refreshToken = stored.refreshToken;
  if (!refreshToken?.value) return stored.accessToken.value;

  try {
    // Make sure the SDK has the latest stored tokens, then renew.
    wixClient.auth.setTokens(stored);
    const renewed = await wixClient.auth.renewToken(refreshToken);
    if (renewed?.accessToken?.value) {
      wixClient.auth.setTokens(renewed);
      writeStoredTokens(renewed);
      return renewed.accessToken.value;
    }
  } catch (err) {
    console.warn("Wix token renewal failed:", err);
  }
  return stored.accessToken.value;
}

/** Async — always returns a fresh Authorization header when possible. */
export async function wixAuthHeader(): Promise<Record<string, string>> {
  const token = await getFreshWixAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
