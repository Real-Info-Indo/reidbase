// Logs analytics events server-side. Never trusts client-supplied identity.
//
// Hardening applied:
//   - Origin/Referer allowlist (production domains + Lovable previews + local dev).
//   - Lightweight in-memory rate limit keyed by session_id + client IP.
//   - Feature events require a valid Wix token. Anonymous page_view stays allowed.
//   - Every stored event carries a `trusted` flag in its metadata so admin
//     dashboards can distinguish verified-identity events from anonymous traffic.
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
const MAX_METADATA_BYTES = 4_000;
const MAX_BODY_BYTES = 8_000;
const MAX_STRING_VALUE = 1_000;

// Keys that must NEVER appear in stored metadata, regardless of source.
// Server derives identity/trust separately; anything matching these (case-insensitive,
// substring match for token-like names) is silently stripped before insert.
const DANGEROUS_KEY_PATTERNS = [
  "wix_user_id",
  "user_tier",
  "tier",
  "email",
  "password",
  "token",          // matches access_token, auth_token, session_token, jwt_token, id_token
  "authorization",
  "api_key",
  "apikey",
  "secret",
  "jwt",
  "session",        // session ids handled by top-level field
  "trusted",
];

// Per-event-type metadata allowlists. Unknown keys are dropped silently.
// Feature events branch by event_name prefix.
const PAGE_VIEW_KEYS = new Set([
  "referrer",
  "full_path",
  "search",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "conversation_id", // PageViewTracker enriches /c/<id> views
]);
const CHAT_EVENT_KEYS = new Set([
  "search_mode",
  "conversation_id",
  "response_ms",
  "error_code",
  "mode",
  "tier",            // dropped by dangerous filter; kept here only for clarity
]);
const APPRAISAL_EVENT_KEYS = new Set([
  "property_type",
  "location",
  "file_count",
  "status",
  "error_code",
]);
// Generic feature-event fallback (funnel_*, report_view, etc.)
const GENERIC_FEATURE_KEYS = new Set([
  "conversation_id",
  "report_id",
  "report_type",
  "region",
  "mode",
  "search_mode",
  "error_code",
  "source",
]);

function isDangerousKey(key: string): boolean {
  const k = key.toLowerCase();
  return DANGEROUS_KEY_PATTERNS.some((p) => k.includes(p));
}

function allowedKeysFor(eventType: string, eventName: string): Set<string> {
  if (eventType === "page_view") return PAGE_VIEW_KEYS;
  const n = eventName.toLowerCase();
  if (n.startsWith("chat_")) return CHAT_EVENT_KEYS;
  if (n.startsWith("appraisal_")) return APPRAISAL_EVENT_KEYS;
  return GENERIC_FEATURE_KEYS;
}

type SanitizeResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; code: string; message: string };

function sanitizeMetadata(
  raw: Record<string, unknown>,
  eventType: string,
  eventName: string,
): SanitizeResult {
  const allowed = allowedKeysFor(eventType, eventName);
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof key !== "string" || !key) continue;
    if (isDangerousKey(key)) continue;          // strip silently
    if (!allowed.has(key)) continue;            // drop unknown keys
    if (val === null || val === undefined) continue;
    // Reject nested structures up-front; metadata must be flat primitives.
    if (typeof val === "object") {
      return {
        ok: false,
        code: "invalid_metadata",
        message: `metadata.${key} must be a primitive (string|number|boolean)`,
      };
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) continue;
      out[key] = trimmed.slice(0, MAX_STRING_VALUE);
    } else if (typeof val === "number" && Number.isFinite(val)) {
      out[key] = val;
    } else if (typeof val === "boolean") {
      out[key] = val;
    } else {
      // Functions, symbols, bigints, etc. — drop.
      continue;
    }
  }
  return { ok: true, value: out };
}

// Rate limit: per (session_id|ip) sliding window.
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_EVENTS = 30; // ≤30 events per 10s per session/IP
const rateBuckets = new Map<string, number[]>();

// Origin allowlist. Exact matches and suffix matches (".lovable.app" etc).
const ALLOWED_EXACT = new Set([
  "https://reidbase.lovable.app",
  "https://app.realinfo.id",
  "https://ai.realinfo.id",
  "https://www.realinfo.id",
  "https://realinfo.id",
]);
const ALLOWED_SUFFIXES = [
  ".lovable.app",
  ".lovableproject.com",
  ".lovable.dev",
];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function originAllowed(origin: string | null, referer: string | null): boolean {
  const candidate = origin || referer;
  if (!candidate) return false;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const originStr = `${url.protocol}//${url.host}`;
  if (ALLOWED_EXACT.has(originStr)) return true;
  if (LOCAL_HOSTS.has(host)) return true;
  if (ALLOWED_SUFFIXES.some((s) => host.endsWith(s))) return true;
  return false;
}

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = rateBuckets.get(key) ?? [];
  // Drop entries outside the window.
  const fresh = arr.filter((t) => now - t < RATE_WINDOW_MS);
  fresh.push(now);
  rateBuckets.set(key, fresh);
  // Periodic cleanup so the map doesn't grow unbounded.
  if (rateBuckets.size > 5_000) {
    for (const [k, v] of rateBuckets) {
      if (v.length === 0 || now - v[v.length - 1] > RATE_WINDOW_MS) {
        rateBuckets.delete(k);
      }
    }
  }
  return fresh.length > RATE_MAX_EVENTS;
}

function jsonError(
  code: string,
  message: string,
  status: number,
): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("method_not_allowed", "Only POST is allowed", 405);
  }

  // --- Origin / Referer allowlist -----------------------------------------
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (!originAllowed(origin, referer)) {
    return jsonError("forbidden_origin", "Origin not permitted", 403);
  }

  // --- Body size guard ----------------------------------------------------
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength && contentLength > MAX_BODY_BYTES) {
    return jsonError("payload_too_large", "Request body exceeds limit", 413);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return jsonError("invalid_body", "Could not read request body", 400);
  }
  if (raw.length > MAX_BODY_BYTES) {
    return jsonError("payload_too_large", "Request body exceeds limit", 413);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError("invalid_json", "Request body must be JSON", 400);
  }

  const eventType = typeof body.event_type === "string" ? body.event_type : "";
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return jsonError("invalid_event_type", "event_type must be page_view or feature", 400);
  }

  const eventName = clampStr(body.event_name, MAX_EVENT_NAME);
  if (!eventName) {
    return jsonError("invalid_event_name", "event_name is required", 400);
  }

  const pagePath = clampStr(body.page_path, MAX_PAGE_PATH);
  const sessionId = clampStr(body.session_id, MAX_SESSION_ID);
  const clientMeta =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  // Enforce raw metadata size cap BEFORE sanitization so spammy payloads
  // (even with unknown keys that would be dropped) still get rejected.
  const rawMetaJson = JSON.stringify(clientMeta);
  if (rawMetaJson.length > MAX_METADATA_BYTES) {
    return jsonError("metadata_too_large", "metadata exceeds size limit", 413);
  }

  // Sanitize: strip dangerous keys, drop unknown keys, reject nested objects.
  const sanitized = sanitizeMetadata(clientMeta, eventType, eventName);
  if (!sanitized.ok) {
    return jsonError(sanitized.code, sanitized.message, 400);
  }
  const safeMeta = sanitized.value;

  // Recheck post-sanitize size as a defensive guard.
  if (JSON.stringify(safeMeta).length > MAX_METADATA_BYTES) {
    return jsonError("metadata_too_large", "metadata exceeds size limit", 413);
  }

  // --- Rate limit ---------------------------------------------------------
  const ip = clientIp(req);
  const rateKey = `${sessionId ?? "nosession"}|${ip}`;
  if (rateLimited(rateKey)) {
    return jsonError("rate_limited", "Too many events, slow down", 429);
  }

  // --- Identity resolution (server-side only) -----------------------------
  let wixUserId: string | null = null;
  let tier = "free";
  let trusted = false;
  const authHeader = req.headers.get("authorization");

  if (authHeader && authHeader.trim()) {
    try {
      const identity = await verifyWixToken(authHeader);
      wixUserId = identity.wixUserId;
      const ent = await getEntitlement(wixUserId);
      tier = ent.tier;
      trusted = true;
    } catch (err) {
      if (err instanceof WixAuthError) {
        // Feature events with a bad token must NOT silently pose as anonymous
        // traffic — that would let attackers manufacture untrusted "feature"
        // signals. Page views remain accepted as anonymous/untrusted.
        if (eventType === "feature") {
          return jsonError("invalid_token", "Auth required for feature events", 401);
        }
        wixUserId = null;
        tier = "free";
        trusted = false;
      } else {
        throw err;
      }
    }
  } else {
    // No auth provided. A small allowlist of pre-auth feature events is
    // accepted as untrusted (e.g. login_started fires before a Wix token
    // exists). Everything else still requires authentication.
    const PRE_AUTH_FEATURE_ALLOWLIST = new Set(["login_started"]);
    if (eventType === "feature" && !PRE_AUTH_FEATURE_ALLOWLIST.has(eventName)) {
      return jsonError("auth_required", "Feature events require authentication", 401);
    }
    // trusted stays false; wixUserId stays null.
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
    metadata: { user_tier: tier, trusted, ...safeMeta },
  });

  if (error) {
    return jsonError("insert_failed", error.message, 500);
  }

  return new Response(JSON.stringify({ ok: true, trusted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
