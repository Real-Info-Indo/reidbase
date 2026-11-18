import { describe, expect, it } from "vitest";
import { campaignDownloadEvent } from "../../supabase/functions/_shared/campaign-analytics";

describe("campaign download audit", () => {
  it("records anonymous downloads without inventing a visitor identity", () => {
    expect(campaignDownloadEvent("h1-report", "visit-1", null)).toEqual({
      event_type: "feature", event_name: "campaign_report_download", page_path: "/campaign/h1-report",
      session_id: "visit-1", wix_user_id: null,
      metadata: { slug: "h1-report", trusted: false, source: "download-public-report" },
    });
  });
  it("records verified visitor identity for signed-in downloads", () => {
    const event = campaignDownloadEvent("q3-report", "visit-2", "verified-member");
    expect(event.wix_user_id).toBe("verified-member");
    expect(event.metadata.trusted).toBe(true);
    expect(event.metadata.slug).toBe("q3-report");
  });
  it("rejects invalid session identifiers rather than linking them to visitors", () => {
    expect(campaignDownloadEvent("q1-report", { wix_user_id: "forged" }, null).session_id).toBeNull();
    expect(campaignDownloadEvent("q1-report", "x".repeat(129), null).session_id).toBeNull();
  });
});