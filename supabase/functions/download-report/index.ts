// download-report
//
// POST { report_type: "market" | "location", report_key: string }
// Headers: Authorization: Bearer <wix-headless-access-token>
//
// Verifies the caller, reads their canonical tier from `user_entitlements`,
// checks that the requested report is allowed for that tier, then returns a
// short-lived signed URL for the matching object in the private `reports`
// storage bucket. Logs every successful authorisation to `report_downloads`.
//
// Storage layout (in the private `reports` bucket):
//   market/<report_key>.pdf       e.g. market/bali-q1-2026.pdf
//   location/<report_key>.pdf     e.g. location/canggu.pdf
//
// Tier requirements:
//   market reports   -> free and above (all logged-in users)
//   location reports -> reid_base_pro and above
// (Adjust the matrix below if the product tiering changes. Frontend gating
// is presentational only; this server check is authoritative.)

import { verifyWixToken, wixAuthErrorResponse } from "../_shared/wix-auth.ts";
import {
  getEntitlement,
  getServiceClient,
  meetsTier,
  type Tier,
} from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SIGNED_URL_TTL_SECONDS = 60;

type ReportType = "market" | "location";

const REQUIRED_TIER: Record<ReportType, Tier> = {
  market: "free",
  location: "reid_base",
};

function isValidReportKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= 128 &&
    /^[a-z0-9][a-z0-9_-]*$/i.test(key)
  );
}

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

  try {
    const identity = await verifyWixToken(req.headers.get("Authorization"));

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: "invalid_json" });
    }

    const reportType = body?.report_type;
    const reportKey = body?.report_key;

    if (reportType !== "market" && reportType !== "location") {
      return jsonResponse(400, {
        error: "invalid_report_type",
        message: "report_type must be 'market' or 'location'",
      });
    }
    if (!isValidReportKey(reportKey)) {
      return jsonResponse(400, {
        error: "invalid_report_key",
        message: "report_key must be a short alphanumeric slug",
      });
    }

    const entitlement = await getEntitlement(identity.wixUserId);
    const required = REQUIRED_TIER[reportType as ReportType];
    if (!meetsTier(entitlement.tier, required)) {
      return jsonResponse(403, {
        error: "tier_forbidden",
        message: `This report requires '${required}' tier`,
        required_tier: required,
        actual_tier: entitlement.tier,
      });
    }

    const storagePath = `${reportType}/${reportKey}.pdf`;
    const supabase = getServiceClient();

    const { data: signed, error: signErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
        download: `${reportKey}.pdf`,
      });

    if (signErr || !signed?.signedUrl) {
      // Most common cause: the PDF has not been uploaded yet.
      const msg = signErr?.message ?? "no_signed_url";
      const notFound = /not\s*found|object.*not.*exist/i.test(msg);
      return jsonResponse(notFound ? 404 : 500, {
        error: notFound ? "report_not_found" : "sign_failed",
        message: msg,
      });
    }

    // Audit log (fire-and-forget; do not block download on logging errors).
    supabase
      .from("report_downloads")
      .insert({
        wix_user_id: identity.wixUserId,
        report_type: reportType,
        report_key: reportKey,
        storage_path: storagePath,
        user_tier: entitlement.tier,
      })
      .then(({ error }) => {
        if (error) console.error("[download-report] audit insert failed:", error.message);
      });

    return jsonResponse(200, {
      ok: true,
      url: signed.signedUrl,
      expires_in: SIGNED_URL_TTL_SECONDS,
      report_type: reportType,
      report_key: reportKey,
    });
  } catch (err) {
    console.error("[download-report] error:", err);
    return wixAuthErrorResponse(err, corsHeaders);
  }
});
