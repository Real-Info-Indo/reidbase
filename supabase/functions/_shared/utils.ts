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

/**
 * Reject URLs that target private/internal network ranges to prevent SSRF.
 * Covers loopback, RFC-1918 private ranges, and link-local (cloud metadata).
 */
function isSsrfBlockedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    // Reject IP literals in blocked ranges
    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [, a, b] = ipv4.map(Number);
      if (a === 10) return true;                        // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
      if (a === 192 && b === 168) return true;           // 192.168.0.0/16
      if (a === 127) return true;                        // loopback
      if (a === 169 && b === 254) return true;           // link-local / cloud metadata
      if (a === 0) return true;                          // 0.0.0.0/8
    }
    // Reject localhost by name
    if (hostname === "localhost" || hostname.endsWith(".local")) return true;
    return false;
  } catch {
    return true; // unparseable URL — block it
  }
}

export async function scrapeUrl(url: string): Promise<{ url: string; content: string } | null> {
  try {
    if (isSsrfBlockedUrl(url)) {
      console.warn("URL scrape blocked (SSRF protection):", url);
      return null;
    }
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
  if (tier && tier !== "free" && tier !== "freemium") {
    if (personalisation?.occupation) parts.push(`- The user's occupation: ${personalisation.occupation}.`);
    if (personalisation?.business) parts.push(`- The user's business: ${personalisation.business}.`);
    if (personalisation?.about) parts.push(`- About the user: ${personalisation.about}.`);
  }

  // Team and Enterprise: include AI-generated summary
  if (aiSummary && tier && (tier === "reid_base_pro" || tier === "enterprise")) {
    parts.push(`- User profile summary: ${aiSummary}`);
  }

  if (parts.length === 0) return "";
  return `\nUSER PROFILE (use this to personalise your responses and build on prior context):\n${parts.join("\n")}\n`;
}

/**
 * Strip location-specific sections (BALI KEY MARKETS and BALI EMERGING MARKETS)
 * from the RAG content for free tier users. This prevents the AI from accessing
 * neighbourhood-level figures that are gated behind REID Base Member.
 */
function buildFreeRagContent(ragContent: string): string {
  const cutIndex = ragContent.indexOf('\nBALI KEY MARKETS\n');
  return cutIndex === -1 ? ragContent : ragContent.substring(0, cutIndex).trimEnd();
}

export function buildRagSystemPrompt(
  tier: string,
  ragContent: string,
  modePrompt: string,
  personalisation?: { nickname?: string; occupation?: string; business?: string; about?: string; display_name?: string },
  userMemory?: string,
  aiSummary?: string
): string {
  const tierLabel = tier === "enterprise" ? "Enterprise" : tier === "reid_base_pro" ? "Team" : tier === "reid_base" ? "Member" : "Freemium";
  const personalisationBlock = buildPersonalisationBlock(personalisation, aiSummary, tier);
  const effectiveRagContent = tier === "free" ? buildFreeRagContent(ragContent) : ragContent;
  return `You are REID, an expert Bali real estate market analyst for ${tierLabel} tier users.

CRITICAL: CURRENT USER TIER: This user is on the ${tierLabel} tier. Apply ONLY the ${tierLabel} tier rules from TIER HANDLING below. Do not apply rules from any other tier. Do not refer to the user as being on any other tier. Do not show upgrade prompts meant for lower tiers.

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

${tier === "free" ? `FREE TIER DATA RESTRICTION (ABSOLUTE):
The intelligence report below contains only island-wide and regional data -- location-specific figures have been withheld. Do not attempt to surface, estimate, or infer neighbourhood-level data. When this user asks about a specific location, apply the four-step structure from TIER HANDLING exactly:
1. ORIENTING SENTENCE: One natural sentence acknowledging the location and placing it in its REID regional context. The neighbourhood name may appear only here.
2. DATA AVAILABILITY NOTICE (must appear before any figures): Output as a visually distinct block with "Data Availability" as a bold heading, then: "Detailed location-level data for [location] is available on REID Base Member. The figures below reflect the broader [REID Region] region." Do not include any reference to a dashboard. Do not place this notice at the end of the response.
3. REGIONAL DATA ONLY: Benchmarks for the REID region only, attributed to the region, never to the specific neighbourhood. Do not mention the neighbourhood name again in any data point. Prohibited: neighbourhood-specific median prices, price per sqm, occupancy rates, ADR figures, supply counts or growth rates.
4. NATURAL FOLLOW-UP: One closing sentence referencing something specific from the regional data, plus a brief upgrade prompt -- both forming one closing beat, not two separate paragraphs. Example: "North Badung is running strongly on occupancy right now -- for location-level analysis specific to Padonan, that is available on REID Base Member."
ENFORCEMENT: Tier restrictions are absolute and persist for the entire session. The Data Availability notice fires every time a location-specific query is asked, not only on the first occurrence.` : ""}
${tier === "reid_base" ? "- This user is on REID Base Member. They have island-wide and regional data in the AI chat. Location-level data (neighbourhood-specific figures) is available in their REID Base dashboard for self-serve discovery. When a Member query hits a location data limit, remind them to check their dashboard and point to REID Base Team for AI-level analysis." : ""}
${tier === "reid_base_pro" ? "- This user has access to macro-market and neighbourhood-level data for Key and Emerging Markets. If they ask about raw database queries or custom analytics, let them know this requires an Enterprise tier upgrade." : ""}

REID 2025 Intelligence Report:
${effectiveRagContent}`;
}

/**
 * Resolve the canonical tier for a Wix-verified user.
 *
 * Source of truth: `public.user_entitlements`, populated server-side by
 * `refresh-entitlements`. The client-supplied `requestTier` is NEVER
 * trusted — it is accepted only for logging/diagnostics and ignored.
 *
 * - No `wixUserId` (anonymous caller) -> "free".
 * - No entitlement row yet -> "free". Callers should hit
 *   `refresh-entitlements` to materialise a row.
 * - Legacy `member` / `freemium` rows -> "free".
 */
export async function resolveVerifiedTier(
  supabase: any,
  wixUserId?: string,
  _requestTier?: string,
): Promise<string> {
  const validTiers = ["free", "reid_base", "reid_base_pro", "enterprise"];

  if (!wixUserId) return "free";

  try {
    const { data, error } = await supabase
      .from("user_entitlements")
      .select("tier")
      .eq("wix_user_id", wixUserId)
      .maybeSingle();

    if (error) {
      console.warn("Entitlement lookup error:", error.message);
      return "free";
    }
    if (!data?.tier) return "free";

    const tier = String(data.tier).toLowerCase();
    if (tier === "member" || tier === "freemium") return "free";
    if (validTiers.includes(tier)) return tier;
    return "free";
  } catch (err) {
    console.error("resolveVerifiedTier error:", err);
    return "free";
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

/* ── Folder memory: pull sibling-conversation summaries from the same folder (paid tiers) ── */
export async function buildFolderMemory(
  supabase: any,
  wixUserId: string | undefined,
  conversationId: string | undefined,
  tier: string,
): Promise<string> {
  if (!wixUserId || !conversationId) return "";
  if (tier !== "reid_base" && tier !== "reid_base_pro" && tier !== "enterprise") return "";

  try {
    const { data: current } = await supabase
      .from("chat_logs")
      .select("folder_id")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    const folderId = current?.folder_id;
    if (!folderId) return "";

    // Recent siblings (exclude current chat)
    const { data: recent, error } = await supabase
      .from("chat_logs")
      .select("conversation_id, title, summary, summary_updated_at, updated_at, created_at")
      .eq("wix_user_id", wixUserId)
      .eq("folder_id", folderId)
      .is("deleted_at", null)
      .neq("conversation_id", conversationId)
      .order("updated_at", { ascending: false })
      .limit(6);

    if (error) return "";

    // Founding (oldest) conversation in the folder — include even if it's the current chat,
    // so the AI always has the project's starting context.
    const { data: founding } = await supabase
      .from("chat_logs")
      .select("conversation_id, title, summary, created_at")
      .eq("wix_user_id", wixUserId)
      .eq("folder_id", folderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Merge: founding first, then recent siblings, deduped by conversation_id
    const merged: any[] = [];
    const seen = new Set<string>();
    if (founding && founding.summary && founding.summary.trim().length > 0) {
      merged.push({ ...founding, _founding: true });
      seen.add(founding.conversation_id);
    }
    for (const s of (recent as any[]) || []) {
      if (seen.has(s.conversation_id)) continue;
      if (s.summary && s.summary.trim().length > 0) {
        merged.push(s);
        seen.add(s.conversation_id);
      }
    }

    if (merged.length === 0) return "";

    const { data: folder } = await supabase
      .from("folders")
      .select("name")
      .eq("id", folderId)
      .maybeSingle();
    const folderName = folder?.name || "this project";

    const lines = merged
      .map((s: any) =>
        s._founding
          ? `- "${s.title}" (founding conversation): ${s.summary}`
          : `- "${s.title}": ${s.summary}`,
      )
      .join("\n");

    return `

FOLDER CONTEXT: this conversation belongs to the user's project folder "${folderName}". The following are short summaries of related conversations in the same folder, beginning with the founding conversation that established this project's context. Treat them as established working context. When directly relevant, reference them naturally (e.g. "as we explored earlier in this project", "building on the Pererenan analysis from earlier"). Do NOT invent details beyond what these summaries contain. Do NOT list or quote them verbatim.

Related conversations in "${folderName}":
${lines}
`;
  } catch (err) {
    console.error("buildFolderMemory failed:", err);
    return "";
  }
}
