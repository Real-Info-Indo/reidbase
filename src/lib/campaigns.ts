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
      "**Welcome to REID Base AI.**",
      "",
      "REID Base AI is a different way to work with the Bali property market. Instead of reading through reports or pulling apart dashboards, you can ask questions, explore the data, and get a clear read on what is actually happening, in a way that is easy to work with.",
      "",
      "To give you a starting point, here is what Q1 2026 is showing.",
      "",
      "At a headline level, the market looks stable. Pricing has held, with a modest +0.7% movement year-on-year, and overall conditions remain steady. But underneath that, the structure of the market has continued to shift.",
      "",
      "- Sales activity softened, influenced by regulatory scrutiny and global economic uncertainty",
      "- Demand is now concentrated in 1 to 2 bedroom properties, making up over 55% of transactions",
      "- Development activity moderated, indicating a shift toward inventory absorption as supply pipelines tighten",
      "",
      "So while nothing dramatic is happening at the top level, the way the market is behaving has become more selective.",
      "",
      "## The rental side tells a similar story",
      "",
      "Occupancy has increased, but revenue has declined. That tends to point to growing competition rather than a drop in demand. More supply is entering the market, and operators are adjusting pricing to maintain bookings.",
      "",
      "Download the report below to see the full breakdown of Q1 2026.",
      "",
      "---",
      "",
      "**Want to explore more?** Ask REID a question to discover any part of the report, or take it further depending on what you are interested in.",
      "",
      "Would you like to compare the markets with the most sales in Q1 2025 to Q1 2026? Or see what locations have achieved the highest occupancy in Q1 2026?",
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
