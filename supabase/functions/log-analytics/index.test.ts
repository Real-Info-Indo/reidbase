// Integration tests for log-analytics. Requires the function to be deployed.
// Runs against the live deployed edge function URL constructed from the
// project's VITE_SUPABASE_URL.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ??
  Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/log-analytics`;
const ALLOWED_ORIGIN = "https://reidbase.lovable.app";

function callFn(opts: {
  body?: unknown;
  origin?: string | null;
  auth?: string | null;
  raw?: string;
  contentType?: string;
}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": opts.contentType ?? "application/json",
    apikey: ANON,
    authorization: opts.auth ?? `Bearer ${ANON}`,
  };
  if (opts.origin !== null) {
    headers.origin = opts.origin ?? ALLOWED_ORIGIN;
  }
  return fetch(FN_URL, {
    method: "POST",
    headers,
    body: opts.raw ?? JSON.stringify(opts.body ?? {}),
  });
}

Deno.test("accepts valid anonymous page_view", async () => {
  const res = await callFn({
    body: {
      event_type: "page_view",
      event_name: "page_view",
      page_path: "/",
      session_id: crypto.randomUUID(),
      metadata: {},
    },
    auth: ANON ? `Bearer ${ANON}` : undefined,
  });
  const json = await res.json();
  assertEquals(res.status, 200, JSON.stringify(json));
  assertEquals(json.ok, true);
  assertEquals(json.trusted, false);
});

Deno.test("rejects invalid event type", async () => {
  const res = await callFn({
    body: {
      event_type: "telemetry",
      event_name: "bogus",
      session_id: crypto.randomUUID(),
    },
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "invalid_event_type");
});

Deno.test("rejects unknown origin", async () => {
  const res = await callFn({
    body: {
      event_type: "page_view",
      event_name: "page_view",
      session_id: crypto.randomUUID(),
    },
    origin: "https://evil.example.com",
  });
  const json = await res.json();
  assertEquals(res.status, 403);
  assertEquals(json.error, "forbidden_origin");
});

Deno.test("rejects oversized metadata", async () => {
  const big = "x".repeat(5_000);
  const res = await callFn({
    body: {
      event_type: "page_view",
      event_name: "page_view",
      session_id: crypto.randomUUID(),
      metadata: { blob: big },
    },
  });
  const json = await res.json();
  assert(res.status === 413, `expected 413, got ${res.status}: ${JSON.stringify(json)}`);
  assertEquals(json.error, "metadata_too_large");
});

Deno.test("rate limits a single session+ip burst", async () => {
  const session = crypto.randomUUID();
  let limited = false;
  for (let i = 0; i < 40; i++) {
    const res = await callFn({
      body: {
        event_type: "page_view",
        event_name: "page_view",
        session_id: session,
      },
    });
    const json = await res.json();
    if (res.status === 429) {
      assertEquals(json.error, "rate_limited");
      limited = true;
      break;
    }
  }
  assert(limited, "expected at least one 429 within 40 rapid requests");
});

Deno.test("rejects feature event without auth", async () => {
  const res = await callFn({
    body: {
      event_type: "feature",
      event_name: "report_view",
      session_id: crypto.randomUUID(),
    },
    auth: "",
  });
  const json = await res.json();
  assertEquals(res.status, 401);
  assert(
    json.error === "auth_required" || json.error === "invalid_token",
    `unexpected error: ${json.error}`,
  );
});

Deno.test("rejects invalid JSON body", async () => {
  const res = await callFn({ raw: "not-json{" });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "invalid_json");
});

Deno.test("rejects nested metadata as invalid_metadata", async () => {
  const res = await callFn({
    body: {
      event_type: "page_view",
      event_name: "page_view",
      session_id: crypto.randomUUID(),
      metadata: { utm_source: { nested: "no" } },
    },
  });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "invalid_metadata");
});

Deno.test("silently strips dangerous keys (wix_user_id, email, token)", async () => {
  const res = await callFn({
    body: {
      event_type: "page_view",
      event_name: "page_view",
      session_id: crypto.randomUUID(),
      metadata: {
        wix_user_id: "attacker",
        user_tier: "enterprise",
        email: "x@y.z",
        access_token: "eyJsecret",
        utm_source: "google",
      },
    },
  });
  const json = await res.json();
  assertEquals(res.status, 200, JSON.stringify(json));
  assertEquals(json.ok, true);
  // Server still records the event, but trust flag stays false.
  assertEquals(json.trusted, false);
});
