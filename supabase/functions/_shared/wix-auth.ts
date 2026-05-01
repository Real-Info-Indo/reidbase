// Shared Wix identity verification for Edge Functions.
//
// Strategy:
//   1. Frontend includes `Authorization: Bearer <wix-access-token>` on calls
//      to gated Edge Functions. The token is the `accessToken.value` issued
//      by the Wix Headless OAuth flow (see src/contexts/WixAuthContext.tsx).
//   2. Wix Headless access tokens are opaque to us: they must be validated
//      by calling a Wix REST endpoint that introspects the caller. We use
//      the Members API "get current member" endpoint, which returns the
//      member only if the bearer token is valid and unexpired.
//        GET https://www.wixapis.com/members/v1/members/my
//        Headers: Authorization: <token>   (Wix accepts the raw token,
//                                           with or without "Bearer ")
//   3. We cache the (token -> member) mapping in-process for 60s to avoid
//      hammering Wix on every gated request. Cache is keyed by a SHA-256
//      hash of the token so we never log or retain the raw token.
//
// IMPORTANT: This helper does NOT call our database. It only resolves the
// caller's Wix identity. Entitlements and admin checks live in their own
// shared modules.

export interface WixIdentity {
  wixUserId: string;
  email: string | null;
  loginEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

export class WixAuthError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 401) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const WIX_MEMBERS_ME_URL = "https://www.wixapis.com/members/v1/members/my?fieldSet=FULL";
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  identity: WixIdentity;
  expiresAt: number;
}

const identityCache = new Map<string, CacheEntry>();

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (!trimmed) return null;
  // Accept "Bearer <token>" (case-insensitive) or a raw token.
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

/**
 * Verify the caller's Wix access token and return their identity.
 * Throws WixAuthError on any failure. Never logs the raw token.
 */
export async function verifyWixToken(authHeader: string | null): Promise<WixIdentity> {
  const token = extractBearer(authHeader);
  if (!token) {
    throw new WixAuthError("missing_token", "Authorization header is required", 401);
  }

  const cacheKey = await hashToken(token);
  const cached = identityCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.identity;
  }

  let res: Response;
  try {
    res = await fetch(WIX_MEMBERS_ME_URL, {
      method: "GET",
      headers: {
        Authorization: token,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new WixAuthError(
      "wix_unreachable",
      `Failed to reach Wix: ${(err as Error).message}`,
      502,
    );
  }

  if (res.status === 401 || res.status === 403) {
    // Consume body to release the connection.
    await res.text().catch(() => undefined);
    throw new WixAuthError("invalid_token", "Wix rejected the token", 401);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new WixAuthError(
      "wix_error",
      `Wix returned ${res.status}: ${body.slice(0, 200)}`,
      502,
    );
  }

  let payload: any;
  try {
    payload = await res.json();
  } catch {
    throw new WixAuthError("wix_bad_response", "Wix returned non-JSON payload", 502);
  }

  const member = payload?.member;
  const wixUserId = member?.id ?? member?._id;
  if (!wixUserId || typeof wixUserId !== "string") {
    throw new WixAuthError("no_member", "Wix did not return a member id", 401);
  }

  const identity: WixIdentity = {
    wixUserId,
    email: member?.contact?.emails?.[0] ?? member?.loginEmail ?? null,
    loginEmail: member?.loginEmail ?? null,
    firstName: member?.contact?.firstName ?? null,
    lastName: member?.contact?.lastName ?? null,
    displayName:
      [member?.contact?.firstName, member?.contact?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || member?.profile?.nickname || null,
  };

  identityCache.set(cacheKey, { identity, expiresAt: now + CACHE_TTL_MS });
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (identityCache.size > 500) {
    for (const [k, v] of identityCache) {
      if (v.expiresAt <= now) identityCache.delete(k);
    }
  }

  return identity;
}

/** Convenience: build a JSON Response for a WixAuthError. */
export function wixAuthErrorResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
): Response {
  if (err instanceof WixAuthError) {
    return new Response(
      JSON.stringify({ error: err.code, message: err.message }),
      {
        status: err.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  return new Response(
    JSON.stringify({ error: "internal_error", message: (err as Error).message }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
