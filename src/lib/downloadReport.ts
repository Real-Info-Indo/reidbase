// Brokered downloads for private report PDFs.
//
// Phase 2C Step B: the frontend no longer links directly to /reports/*.pdf.
// Instead it calls the `download-report` Edge Function, which verifies the
// caller's Wix identity, checks their tier, and returns a short-lived signed
// URL from the private `reports` Storage bucket.
//
// Errors are surfaced to the UI as a discriminated union so the caller can
// render appropriate guidance (sign in / upgrade / not available yet).

import { supabase } from "@/integrations/supabase/client";
import { wixAuthHeader } from "@/lib/wixToken";

export type ReportType = "market" | "location";

export type DownloadReportResult =
  | { ok: true; url: string; expiresIn: number }
  | { ok: false; kind: "unauthenticated" | "tier_forbidden" | "not_found" | "unknown"; message: string };

interface DownloadArgs {
  reportType: ReportType;
  reportKey: string;
}

export async function requestReportSignedUrl({
  reportType,
  reportKey,
}: DownloadArgs): Promise<DownloadReportResult> {
  // If the user is not logged in we have no Wix bearer to send. Bail early
  // with the unauthenticated outcome so the UI can prompt sign-in without a
  // round-trip.
  const headers = await wixAuthHeader();
  if (!headers.Authorization) {
    return {
      ok: false,
      kind: "unauthenticated",
      message: "Sign in to download this report.",
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke("download-report", {
      body: { report_type: reportType, report_key: reportKey },
      headers,
    });

    // supabase-js wraps non-2xx responses in `error` but still parses the body
    // into `data` when possible. We inspect both to classify the outcome.
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      const payload = (data ?? {}) as { error?: string; message?: string };
      const code = payload?.error ?? "";

      if (status === 401 || code === "unauthorized" || code === "invalid_token") {
        return {
          ok: false,
          kind: "unauthenticated",
          message: "Your session has expired. Please sign in again.",
        };
      }
      if (status === 403 || code === "tier_forbidden") {
        return {
          ok: false,
          kind: "tier_forbidden",
          message:
            payload.message ??
            "This report is available on Pro and Enterprise plans.",
        };
      }
      if (status === 404 || code === "report_not_found") {
        return {
          ok: false,
          kind: "not_found",
          message: "This report is not available yet. Please check back soon.",
        };
      }
      return {
        ok: false,
        kind: "unknown",
        message: payload.message ?? error.message ?? "Download failed.",
      };
    }

    const result = data as { ok?: boolean; url?: string; expires_in?: number };
    if (!result?.ok || !result.url) {
      return { ok: false, kind: "unknown", message: "Download failed." };
    }
    return { ok: true, url: result.url, expiresIn: result.expires_in ?? 60 };
  } catch (e) {
    return {
      ok: false,
      kind: "unknown",
      message: (e as Error).message ?? "Network error. Please try again.",
    };
  }
}

/**
 * Opens the signed URL in a new tab. The `download-report` function already
 * sets a `download` disposition, so the browser will save the file rather
 * than render it inline.
 */
export function openSignedDownload(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
