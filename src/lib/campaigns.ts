// Email-campaign pre-loaded conversations.
//
// Each campaign defines a public, read-only conversation preview that
// anonymous visitors can land on from an email link. The Send button and
// sidebar items are gated: clicking either prompts Wix sign-in. After sign
// in, the visitor is dropped into NewAnalysis with the conversation seeded
// and any typed draft prefilled in the input.
//
// To launch a future campaign: add a new entry to CAMPAIGNS keyed by slug.

export interface CampaignReport {
  /** Display title shown on the report card. */
  title: string;
  /** Subtitle shown beneath the title (e.g. "Q1 2026 Market Report"). */
  subtitle: string;
  /** Public path or URL for the cover thumbnail image. */
  thumbnail: string;
  /**
   * Storage key inside the private `reports` bucket, matching the existing
   * download-report convention: `market/<reportKey>.pdf`.
   */
  reportType: "market" | "location";
  reportKey: string;
}

export interface Campaign {
  slug: string;
  /** Title shown in the browser tab and as the conversation title once seeded. */
  title: string;
  /** The simulated user prompt that opens the conversation. */
  userPrompt: string;
  /**
   * Pre-loaded assistant response, rendered as Markdown. Placeholder copy
   * for now; replace with the finalised text from the campaign owner.
   */
  assistantMessage: string;
  /** Optional report card rendered beneath the assistant message. */
  report?: CampaignReport;
}

export const CAMPAIGNS: Record<string, Campaign> = {
  "q1-report": {
    slug: "q1-report",
    title: "Bali Q1 2026 Market Report",
    userPrompt: "Walk me through the Bali Q1 2026 market report.",
    assistantMessage: [
      "Here is a quick summary of the **Bali Q1 2026 Market Report**.",
      "",
      "_Placeholder text. The final response will be provided by the campaign owner and pasted into `src/lib/campaigns.ts` before launch._",
      "",
      "## Headline figures",
      "- Median sale price",
      "- Price per SQM",
      "- Transaction volume",
      "- Active supply and asking prices",
      "",
      "## Rental performance",
      "- Occupancy",
      "- ADR and revenue trends",
      "",
      "Download the full report below to see the underlying data, methodology, and micro-location breakdowns.",
    ].join("\n"),
    report: {
      title: "Bali Q1 2026 Market Report",
      subtitle: "Quarterly market intelligence",
      thumbnail: "/reports/thumbnails/Bali_Q1_2026.jpg",
      reportType: "market",
      reportKey: "bali_q1_2026",
    },
  },
};

export function getCampaign(slug: string | undefined | null): Campaign | undefined {
  if (!slug) return undefined;
  return CAMPAIGNS[slug];
}
