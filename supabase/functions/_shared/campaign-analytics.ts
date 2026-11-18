/** Identity is supplied only after server-side Wix verification. */
export function campaignDownloadEvent(slug: string, sessionId: unknown, verifiedUserId: string | null) {
  return {
    event_type: "feature",
    event_name: "campaign_report_download",
    page_path: `/campaign/${slug}`,
    session_id: typeof sessionId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(sessionId) ? sessionId : null,
    wix_user_id: verifiedUserId,
    metadata: { slug, trusted: verifiedUserId !== null, source: "download-public-report" },
  };
}