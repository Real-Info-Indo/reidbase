// download-public-report
//
// POST { slug: string }
//
// Returns a short-lived signed URL for a campaign report. Unlike
// `download-report`, this endpoint does NOT require Wix authentication: it
// is intended for email-campaign landing pages where the report is
// intentionally public. Only reports explicitly whitelisted in
// CAMPAIGN_REPORTS can be requested, so the `reports` Storage bucket stays
// private.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — comfortable click-to-download window.

// Whitelist of campaign slug -> storage object key inside the `reports`
// bucket. Add new entries here as new email campaigns launch. Anything not
// listed here is rejected, so the bucket stays effectively private.
const CAMPAIGN_REPORTS: Record<string, { path: string; downloadAs: string }> = {
  "q1-report": {
    path: "market/bali_q1_2026.pdf",
    downloadAs: "Bali_Q1_2026_Market_Report.pdf",
  },
  "h1-report": {
    path: "market/bali_h1_2026.pdf",
    downloadAs: "Bali_H1_2026_Market_Report.pdf",
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  let body: { slug?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slug || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(slug)) {
    return jsonResponse(400, { error: "invalid_slug" });
  }

  const entry = CAMPAIGN_REPORTS[slug];
  if (!entry) {
    return jsonResponse(404, { error: "campaign_not_found" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // We only need a signed URL — call Storage REST directly to avoid pulling
  // the supabase-js dependency for a single endpoint.
  const signRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/reports/${entry.path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    },
  );

  if (!signRes.ok) {
    const text = await signRes.text();
    const notFound = signRes.status === 404 || /not\s*found/i.test(text);
    return jsonResponse(notFound ? 404 : 500, {
      error: notFound ? "report_not_found" : "sign_failed",
      message: text,
    });
  }

  const signed = await signRes.json() as { signedURL?: string };
  if (!signed?.signedURL) {
    return jsonResponse(500, { error: "sign_failed" });
  }

  // Storage returns a relative path; turn it into an absolute URL and
  // append a `download` hint so the browser saves the file with a friendly
  // name instead of rendering inline.
  const url = new URL(`${SUPABASE_URL}/storage/v1${signed.signedURL}`);
  url.searchParams.set("download", entry.downloadAs);

  return jsonResponse(200, {
    ok: true,
    url: url.toString(),
    expires_in: SIGNED_URL_TTL_SECONDS,
  });
});
