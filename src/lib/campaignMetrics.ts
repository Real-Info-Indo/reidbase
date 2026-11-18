export interface CampaignVisitor {
  wix_user_id: string;
  display_name: string | null;
  email: string | null;
  page_views: number;
  downloads: number;
  first_seen: string;
  last_seen: string;
}

export interface LaunchCampaign {
  slug: string;
  title: string;
  visitors: number;
  page_views: number;
  identified_users: number;
  anonymous_visits: number;
  downloads: number;
  downloading_visits?: number;
  signin_prompt_visits?: number;
  followup_visits?: number;
  identified_downloaders?: number;
  traffic_sources?: { source: string; medium: string; campaign: string; visits: number }[];
  visitor_details: CampaignVisitor[];
}

export function campaignRate(visits: number | undefined, total: number): number | null {
  return visits === undefined || total <= 0 ? null : (visits / total) * 100;
}

export function campaignRateLabel(visits: number | undefined, total: number): string {
  const rate = campaignRate(visits, total);
  return rate === null ? "Not available" : `${rate.toFixed(1)}%`;
}

export function campaignExportRows(campaigns: LaunchCampaign[], period: string): (string | number)[][] {
  return [
    ["Date range", period],
    ["# Campaign totals"],
    ["Campaign", "Visits (sessions)", "Page views", "Identified users", "Anonymous visits", "Download requests", "Downloading visits", "Download rate", "Sign-in prompt visits", "Sign-in prompt rate", "Follow-up visits", "Follow-up rate", "Identified downloaders", "Page views per visit"],
    ...campaigns.map(c => [c.title, c.visitors, c.page_views, c.identified_users, c.anonymous_visits, c.downloads, c.downloading_visits ?? "", campaignRateLabel(c.downloading_visits, c.visitors), c.signin_prompt_visits ?? "", campaignRateLabel(c.signin_prompt_visits, c.visitors), c.followup_visits ?? "", campaignRateLabel(c.followup_visits, c.visitors), c.identified_downloaders ?? "", c.visitors ? (c.page_views / c.visitors).toFixed(2) : ""]),
    [], ["# Traffic sources"], ["Campaign", "Source", "Medium", "Email campaign tag", "Visits"],
    ...campaigns.flatMap(c => (c.traffic_sources ?? []).map(s => [c.title, s.source, s.medium, s.campaign, s.visits])),
    [], ["# Identified visitors"], ["Campaign", "Name", "Email", "Page views", "Download requests", "First activity", "Last activity"],
    ...campaigns.flatMap(c => c.visitor_details.map(v => [c.title, v.display_name ?? "", v.email ?? "", v.page_views, v.downloads, v.first_seen, v.last_seen])),
  ];
}