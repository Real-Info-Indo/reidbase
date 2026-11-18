import { describe, expect, it } from "vitest";
import { campaignRate, campaignExportRows, type LaunchCampaign } from "../lib/campaignMetrics";

describe("campaign engagement metrics", () => {
  it("calculates conversion from downloading sessions, not repeat download requests", () => {
    expect(campaignRate(3, 12)).toBe(25);
  });
  it("does not invent a rate when there are no visits or no recorded metric", () => {
    expect(campaignRate(0, 0)).toBeNull();
    expect(campaignRate(undefined, 12)).toBeNull();
  });
  it("exports campaign totals, sources and verified visitor emails", () => {
    const campaign: LaunchCampaign = { slug:"q3-report", title:"Q3", visitors:12, page_views:18, identified_users:1, anonymous_visits:11, downloads:6, downloading_visits:3, traffic_sources:[{source:"newsletter",medium:"email",campaign:"q3",visits:12}], visitor_details:[{wix_user_id:"verified",display_name:"Test",email:"test@example.com",page_views:2,downloads:1,first_seen:"2026-11-01",last_seen:"2026-11-02"}] };
    const rows = campaignExportRows([campaign],"1 to 18 November 2026");
    expect(rows[3][7]).toBe("25.0%");
    expect(rows).toContainEqual(["Q3","newsletter","email","q3",12]);
    expect(rows).toContainEqual(["Q3","Test","test@example.com",2,1,"2026-11-01","2026-11-02"]);
  });
});