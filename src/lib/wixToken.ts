// Helper to extract the current Wix access token from the wix client and
// build a fetch-style Authorization header for Edge Function calls.
//
// The Wix Headless OAuth tokens are persisted in localStorage under
// "wix-tokens" (see src/contexts/WixAuthContext.tsx). The shape is:
//   { accessToken: { value, expiresAt }, refreshToken: { value, ... } }

const TOKEN_KEY = "wix-tokens";

export function getWixAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.accessToken?.value ?? null;
  } catch {
    return null;
  }
}

export function wixAuthHeader(): Record<string, string> {
  const token = getWixAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
