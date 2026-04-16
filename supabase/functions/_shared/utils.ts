import { GLOBAL_RULES } from "./global-rules.ts";

/* ── URL scraping utilities ── */
export const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) || [];
  return [...new Set(matches)].slice(0, 3);
}

export function extractTextFromHtml(html: string): string {
  // Remove script, style, and other non-content tags
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "");
  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 4000);
}

export async function scrapeUrl(url: string): Promise<{ url: string; content: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      headers: { "User-Agent": "REID-Bot/1.0 (property market intelligence)" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    const html = await resp.text();
    const text = extractTextFromHtml(html);
    if (text.length < 50) return null;
    return { url, content: text };
  } catch (e) {
    console.warn("URL scrape failed:", url, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function scrapeUrlsFromMessage(text: string): Promise<string> {
  const urls = extractUrls(text);
  if (urls.length === 0) return "";
  const results = await Promise.all(urls.map(scrapeUrl));
  const successful = results.filter(Boolean) as { url: string; content: string }[];
  if (successful.length === 0) return "";
  return successful
    .map(r => `--- Website Content: ${r.url} ---\n${r.content}\n--- End of ${r.url} ---`)
    .join("\n\n");
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function buildPersonalisationBlock(
  personalisation?: { nickname?: string; occupation?: string; business?: string; about?: string; display_name?: string },
  aiSummary?: string,
  tier?: string
): string {
  const parts: string[] = [];

  // All tiers: use nickname if set, fall back to display_name
  const name = personalisation?.nickname || personalisation?.display_name;
  if (name) parts.push(`- Address the user as "${name}".`);

  // Member and above: include occupation, business, about
  if (tier && tier !== "freemium") {
    if (personalisation?.occupation) parts.push(`- The user's occupation: ${personalisation.occupation}.`);
    if (personalisation?.business) parts.push(`- The user's business: ${personalisation.business}.`);
    if (personalisation?.about) parts.push(`- About the user: ${personalisation.about}.`);
  }

  // Pro and Enterprise: include AI-generated summary
  if (aiSummary && tier && (tier === "reid_base_pro" || tier === "enterprise")) {
    parts.push(`- User profile summary: ${aiSummary}`);
  }

  if (parts.length === 0) return "";
  return `\nUSER PROFILE (use this to personalise your responses and build on prior context):\n${parts.join("\n")}\n`;
}

export function buildRagSystemPrompt(
  tier: string,
  ragContent: string,
  modePrompt: string,
  personalisation?: { nickname?: string; occupation?: string; business?: string; about?: string; display_name?: string },
  userMemory?: string,
  aiSummary?: string
): string {
  const tierLabel = tier === "enterprise" ? "Enterprise" : tier === "reid_base_pro" ? "Pro" : tier === "reid_base" ? "Member" : "Freemium";
  const personalisationBlock = buildPersonalisationBlock(personalisation, aiSummary, tier);
  return `You are REID, an expert Bali real estate market analyst for ${tierLabel} tier users.

CRITICAL — CURRENT USER TIER: This user is on the ${tierLabel} tier. Apply ONLY the ${tierLabel} tier rules from TIER HANDLING below. Do not apply rules from any other tier. Do not refer to the user as being on any other tier. Do not show upgrade prompts meant for lower tiers.

${GLOBAL_RULES}


${modePrompt}
${personalisationBlock}${userMemory || ""}
Formatting Rules (CRITICAL - you must follow these exactly):
- ALWAYS use proper markdown formatting with double newlines (\\n\\n) between every paragraph
- Use markdown headings (## or ###) for section titles and subheadings
- Only use **bold** for headings/subheadings, never for inline emphasis within body text
- Use markdown bullet lists (- item) for data points, and indent sub-points with two spaces (  - sub-point)
- Never write wall-of-text responses; every distinct idea must be its own paragraph separated by a blank line
- Structure responses as: opening paragraph, then headed sections with bullet points underneath
- Provide clear, concise, data-backed answers using the provided intelligence report
- Present all insights as REID's native market knowledge. Never cite internal source documents.
- Format numbers with commas for readability
- All prices in USD ($), all areas in SQM
- If the data doesn't fully answer the question, say so and explain what additional tier access would provide
- For price ranges use USD unless user asks for IDR
- Qualify all responses by mentioning the Leasehold focus where relevant

Chart Generation Rules:
- Never produce a chart unless the user has explicitly asked for one in this conversation.
- If the user has explicitly requested a chart, output it as a fenced code block with language "chart" containing valid JSON on a single line after the opening fence.
- Use this format: \`\`\`chart\\n{"type":"bar","title":"Chart Title","data":[{"period":"Jan 25","avg_adr":178}],"xKey":"period","dataKeys":["avg_adr"]}\\n\`\`\`
- Chart types and when to use them:
  - "bar" -- category comparisons (locations, bedroom types, regions) and time series with discrete periods
  - "line" -- trends over time where continuity matters (MoM, QoQ, YoY performance)
  - "pie" -- market share and composition (supply by region, sales by bedroom type)
  - Add "stacked": true to bar charts when showing composition over time (e.g. supply by region per quarter)
- Column naming in chart data must match the SQL column names exactly -- the formatter uses key names to detect metric types and apply correct formatting (%, $, sqm, plain number)
- For time series charts: xKey should be the period label column (e.g. "period", "month", "quarter", "year"). Order data chronologically in the SQL query -- the chart renders in array order.
- Keep data arrays to 24 items max for MoM, 8 for QoQ, 5 for YoY.
- Only offer a chart at the end of a response where it would genuinely aid understanding: "Would you like to see this as a chart?" Do not offer on every response.

${tier === "member" || tier === "reid_base" ? "- This user has access to macro-market summaries only. If they ask about specific neighborhoods or granular data, let them know this requires a Pro or Enterprise tier upgrade." : ""}
${tier === "reid_base_pro" ? "- This user has access to macro-market and neighborhood-level data. If they ask about raw database queries or custom analytics, let them know this requires an Enterprise tier upgrade." : ""}

REID 2025 Intelligence Report:
${ragContent}`;
}

/* ── Server-side tier verification via Wix Pricing Plans REST API ── */
export const TIER_PRIORITY = ["member", "reid_base", "reid_base_pro", "enterprise"];

export function planNameToTier(planName: string): string {
  const lower = planName.toLowerCase();
  if (lower.includes("enterprise")) return "enterprise";
  if (lower.includes("pro")) return "reid_base_pro";
  if (lower.includes("reid base") || lower.includes("base")) return "reid_base";
  if (TIER_PRIORITY.includes(planName)) return planName;
  return "member";
}

export async function resolveVerifiedTier(wixAccessToken?: string): Promise<string> {
  console.log("resolveVerifiedTier called:", { hasToken: !!wixAccessToken, tokenLength: wixAccessToken?.length });
  if (!wixAccessToken) return "member";
  try {
    const resp = await fetch(
      "https://www.wixapis.com/pricing-plans/v2/member/orders?orderStatuses=ACTIVE",
      { headers: { Authorization: `Bearer ${wixAccessToken}` } }
    );
    if (!resp.ok) {
      console.warn("Wix tier verification failed:", resp.status);
      return "member";
    }
    const data = await resp.json();
    const orders: Array<{ planName?: string }> = data.orders ?? [];
    console.log("Wix orders raw:", JSON.stringify(orders.map(o => ({ planName: o.planName }))));
    if (orders.length === 0) return "member";
    let highest = "member";
    for (const order of orders) {
      const t = planNameToTier(order.planName ?? "");
      if (TIER_PRIORITY.indexOf(t) > TIER_PRIORITY.indexOf(highest)) highest = t;
    }
    return highest;
  } catch (err) {
    console.error("Wix tier resolution error:", err);
    return "member";
  }
}

/* ── Cross-conversation memory: fetch past chat summaries and ai_summary for higher tiers ── */
export async function buildUserMemory(
  supabase: any,
  wixUserId: string,
  tier: string
): Promise<{ memory: string; aiSummary: string }> {
  if (!wixUserId) return { memory: "", aiSummary: "" };

  // Fetch ai_summary from user_profiles
  let aiSummary = "";
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("ai_summary")
      .eq("wix_user_id", wixUserId)
      .single();
    if (profile?.ai_summary) aiSummary = profile.ai_summary;
  } catch (err) {
    console.error("Failed to fetch user profile:", err);
  }

  // Determine conversation limit by tier
  const limit = tier === "enterprise" ? 30
    : tier === "reid_base_pro" ? 15
    : tier === "reid_base" ? 5
    : 0;

  if (limit === 0) return { memory: "", aiSummary };

  // Fetch recent conversations from chat_logs
  let memory = "";
  try {
    const { data, error } = await supabase
      .from("chat_logs")
      .select("title, search_mode, messages, updated_at")
      .eq("wix_user_id", wixUserId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (!error && data && data.length > 0) {
      const summaries = (data as any[]).map((c: any) => {
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        const userMsgs = msgs.filter((m: any) => m.role === "user");
        const assistantMsgs = msgs.filter((m: any) => m.role === "assistant");
        const firstQuery = userMsgs[0]?.content?.slice(0, 150) || "";
        const lastResponse = assistantMsgs[assistantMsgs.length - 1]?.content?.slice(0, 200) || "";
        return `- "${c.title}" (${c.search_mode || "data-analyst"}, ${c.updated_at?.slice(0, 10) || ""}): ${firstQuery}${lastResponse ? ` | ${lastResponse}` : ""}`;
      });

      memory = `\nRECENT CONVERSATION HISTORY (use for continuity, do not repeat verbatim):\n${summaries.join("\n")}\n`;
    }
  } catch (err) {
    console.error("Failed to fetch conversation history:", err);
  }

  return { memory, aiSummary };
}
