import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GLOBAL_RULES } from "../_shared/global-rules.ts";
import { moderateMessage } from "../_shared/moderation.ts";
import { RAG_CONTENT } from "../_shared/rag-content.ts";
import { ANALYTICAL_SQL_PROMPT, ANALYTICAL_EXPLAIN_PROMPT } from "../_shared/schema.ts";
import {
  corsHeaders,
  scrapeUrlsFromMessage,
  buildPersonalisationBlock,
  buildRagSystemPrompt,
  buildUserMemory,
  buildFolderMemory,
  resolveVerifiedTier,
} from "../_shared/utils.ts";
import { validateFileContents, buildAttachmentBlock } from "../_shared/file-attachments.ts";
import { verifyWixToken, wixAuthErrorResponse } from "../_shared/wix-auth.ts";

const AI_MODEL = "google/gemini-3-flash-preview";

const MODE_PROMPTS: Record<string, string> = {
  "marketing-assistant": `MODE: Marketing Assistant

ROLE IN THIS MODE:
You are The Marketer , friendly, punchy, curious, and genuinely interested in helping users get to content they are proud of. You think in angles and hooks. You treat every request as a creative brief, not a task.

For every content request, always produce a draft , never let the brand voice question replace the content. Acknowledge the task, produce a draft in REID's default Marketer voice, then invite feedback alongside it: "Here's a first pass , happy to adjust the angle, tone, or data hook if this isn't quite right."

BRAND VOICE:
If the user has not specified a brand voice, do not block on this. Produce a draft in REID's default Marketer voice and ask alongside it: "Happy to tailor this to your brand voice , just share your brand name, tone (e.g. professional, warm, direct), any phrases you always use or avoid, and an example of content you like. Or if this default style works, we can run with it."
If the user provides brand details, apply them consistently throughout the session: tone, vocabulary, structure, sign-off style.
If the user declines or provides no detail, default to REID's Marketer voice: punchy, concise, data-led, accessible.

FORMAT RULES:
- Instagram caption: 3 to 5 sentences, punchy opener, one data hook, relevant hashtags. Hashtags must use the # symbol (e.g. #BaliProperty #RentalYields). No spaces within a hashtag. Place hashtags on a new line at the end of the caption.
- LinkedIn post: 150 to 250 words, clear point of view, data-backed, direct.
- EDM: 200 to 400 words, subject line included, single CTA, warm but data-led.
- Blog article: 500 to 900 words, structured argument, data points throughout, accessible to a non-specialist reader.
- Sales deck snapshot: 3 to 5 bullet points, numbers only, no narrative padding. No bold sub-headers or category labels. Each bullet is a standalone data point with context in plain language. Example: "North Badung accounts for 34.9% of total island supply , the largest share of any sub-region" not "Inventory Leadership: North Badung remains the primary engine..."

DATA BEHAVIOUR:
- Back every factual claim with a figure from REID data. Draw freely on broader context , Bali's global destination standing, regional tourism demographic trends, the appeal of the short-term rental model , to give content genuine depth and narrative. This is what makes the copy feel authoritative rather than generic. Never manufacture statistics or attribute figures to sources other than REID.
- All values in USD. All sizes in SQM.
- Never make investment return promises or specific yield guarantees.
- Do not use manufactured urgency or scarcity language. If the user asks for content with urgency or scarcity framing ("limited opportunity", "don't miss out", "secure your piece of paradise"), flag the conflict directly before producing anything: "That framing sits outside what REID's data can support , we don't use urgency or scarcity language because the market data makes a stronger case on its own. Here's what I can do instead..." Then offer a data-led alternative that achieves the same commercial intent.

RESPONSE LOGIC:
- If format is not specified, make a smart choice based on context, state it, and produce. Do not just ask.
- Your first sentence should sound like The Marketer , curious, energised, direct. Not "I will help you with that" or "Here is your caption." Examples: "Good hook in this data , here is a take on it..." / "Occupancy story is the angle here, here is how I would open it..." / "South Badung is doing something worth writing about right now..." Vary the opener.
- After delivering a piece, always offer one alternative: a different angle, a different data hook, or a different format. Iteration is the job.
- British English throughout.

TIER:
- This mode is Enterprise only. Full granular data available for location and category-specific content.
- Maximum 5 individual property records per response.

SCOPE BOUNDARIES:
This mode creates data-backed marketing content. When a request falls clearly outside that, respond with what this mode can contribute and name the right mode.

Market analysis as its own endpoint (not in service of content):
This mode can pull market data to anchor content and will do so freely. If the user appears to want to understand or explore the market for its own sake rather than turn the findings into content, note: "I can pull that data and build it into content here. If you want to explore what the numbers mean on their own terms without a content output, Data Analyst is the better place to start."

Property benchmarking for a deal (positioning a specific property for a vendor or buyer conversation):
This mode can write about a property and create listing-anchored content. For deal-stage benchmarking; where a property sits against the market, positioning points for a vendor or buyer conversation; that is Sales Assistant's job. Respond: "I can write the listing content once you have the positioning. Sales Assistant is the place to build the benchmark first."

Portfolio performance analysis:
This mode does not analyse portfolio performance. Respond: "Portfolio Analyst handles performance reviews. Once you have the numbers, bring them here and I can turn them into content."`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify Wix identity. Tier-gated chat modes require an authenticated
    // caller , anonymous requests are rejected before any work happens.
    let wixUserId: string;
    try {
      const identity = await verifyWixToken(req.headers.get("Authorization"));
      wixUserId = identity.wixUserId;
    } catch (err) {
      return wixAuthErrorResponse(err, corsHeaders);
    }

    const { messages, fileContents, searchMode, personalisation, conversationId } = await req.json();

    // Moderate the latest user message (silent, non-blocking)
    const lastMsg = messages?.[messages.length - 1];
    if (lastMsg?.role === "user" && lastMsg.content) {
      moderateMessage(lastMsg.content, { conversationId: conversationId || "unknown", wixUserId });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const effectiveTier = await resolveVerifiedTier(supabase, wixUserId);
    console.log("Tier resolution:", { wixUserId, effectiveTier });

    // Marketing Assistant: enterprise only
    if (effectiveTier !== "enterprise") {
      return new Response(
        JSON.stringify({ error: "Marketing Assistant is available on REID Base Enterprise only." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { memory: baseMemory, aiSummary } = await buildUserMemory(supabase, wixUserId, effectiveTier);
    const folderMemory = await buildFolderMemory(supabase, wixUserId, conversationId, effectiveTier);
    const userMemory = (baseMemory || "") + (folderMemory || "");

    const modePrompt = MODE_PROMPTS["marketing-assistant"];

    // Validate any attached files BEFORE any expensive work.
    const attachmentResult = validateFileContents(fileContents);
    if (!attachmentResult.ok) {
      return new Response(
        JSON.stringify({ error: attachmentResult.error.code, message: attachmentResult.error.message }),
        { status: attachmentResult.error.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const attachmentBlock = buildAttachmentBlock(attachmentResult.files);

    // Capture the typed prompt BEFORE injecting attachments. URL scraping,
    // classifier and SQL generation use the typed prompt only.
    const typedPrompt: string = messages?.[messages.length - 1]?.content || "";

    let scrapedSuffix = "";
    if (typedPrompt) {
      const scrapedContent = await scrapeUrlsFromMessage(typedPrompt);
      if (scrapedContent) {
        scrapedSuffix = `\n\n[WEBSITE CONTENT FROM LINKS - Use this information to compare against REID market data]\n${scrapedContent}`;
        console.log("Scraped URL content injected into context");
      }
    }

    const userMessage = typedPrompt + scrapedSuffix;

    const enrichedMessages = [...messages];
    const lastIdx = enrichedMessages.length - 1;
    if (lastIdx >= 0 && enrichedMessages[lastIdx]?.role === "user") {
      enrichedMessages[lastIdx] = {
        ...enrichedMessages[lastIdx],
        content: `${typedPrompt}${scrapedSuffix}${attachmentBlock}`,
      };
    }

    // Enterprise: full RAG + analytical (database queries)
    // First try to determine if the question needs a database query
    const classifyResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: `You classify user questions about Bali real estate.
If the question requires specific data lookups, custom filtering, or calculations that need raw database access, respond with exactly "ANALYTICAL".
If the question can be answered from general market knowledge, trends, or the intelligence report, respond with exactly "RAG".
Respond with only one word: ANALYTICAL or RAG.` },
          { role: "user", content: userMessage },
        ],
      }),
    });

    let classification = "RAG";
    if (!classifyResponse.ok) {
      console.error("Classification failed, falling back to RAG:", classifyResponse.status);
    } else {
      const classifyData = await classifyResponse.json();
      classification = (classifyData.choices?.[0]?.message?.content?.trim() || "RAG").toUpperCase();
    }

    if (classification === "ANALYTICAL") {
      // SQL generation path
      const sqlResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: ANALYTICAL_SQL_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!sqlResponse.ok) {
        const status = sqlResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      const sqlData = await sqlResponse.json();
      let sql = sqlData.choices?.[0]?.message?.content?.trim() || "";
      sql = sql.replace(/^```sql\n?/i, "").replace(/\n?```$/i, "").trim();
      while (/(;|--[^\n]*)\s*$/.test(sql)) {
        sql = sql.replace(/;\s*$/, "").replace(/--[^\n]*\s*$/, "").trim();
      }

      console.log("Generated SQL:", sql);

      const upperSql = sql.toUpperCase().trim();
      if (!upperSql.startsWith("SELECT")) {
        return new Response(JSON.stringify({ error: "Invalid query generated." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const forbidden = ["DELETE", "DROP", "INSERT", "UPDATE", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE"];
      for (const kw of forbidden) {
        if (upperSql.includes(kw)) {
          return new Response(JSON.stringify({ error: `Forbidden SQL keyword: ${kw}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", { query_text: sql });

      if (queryError) {
        console.error("Query error:", queryError);
        // Fall back to RAG content
        const ragPrompt = buildRagSystemPrompt("enterprise", RAG_CONTENT, modePrompt, personalisation, userMemory, aiSummary);
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "system", content: ragPrompt }, ...enrichedMessages], stream: true }),
        });
        if (!response.ok) throw new Error(`AI error: ${response.status}`);
        return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      // Explain results
      const explainResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
            messages: [
              { role: "system", content: ANALYTICAL_EXPLAIN_PROMPT + "\n\n" + modePrompt + "\n\n" + GLOBAL_RULES + buildPersonalisationBlock(personalisation, aiSummary, effectiveTier) + (userMemory || "") },
              ...enrichedMessages.slice(0, -1),
              { role: "user", content: `${userMessage}\n\n[SQL query executed]:\n${sql}\n\n[Query results]:\n${JSON.stringify(queryResult, null, 2)}${attachmentBlock}` },
            ],
          stream: true,
        }),
      });

      if (!explainResponse.ok) throw new Error(`AI explain error: ${explainResponse.status}`);
      return new Response(explainResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Enterprise RAG fallback (uses full RAG content + dynamic DB stats)
    const contextParts: string[] = [];
    const { data: stats } = await supabase.rpc("execute_readonly_query", {
      query_text: `SELECT count(*) as total_properties, count(*) FILTER (WHERE availability = 'Available') as available, count(*) FILTER (WHERE availability = 'Sold') as sold, ROUND(AVG(price_usd) FILTER (WHERE price_usd IS NOT NULL)) as avg_price_usd, ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE price_usd IS NOT NULL)) as median_price_usd FROM reid_properties`
    });
    if (stats) contextParts.push(`Live Database Overview: ${JSON.stringify(stats)}`);

    const ragPrompt = buildRagSystemPrompt("enterprise", RAG_CONTENT + "\n\nLIVE DATABASE CONTEXT:\n" + contextParts.join("\n"), modePrompt, personalisation, userMemory, aiSummary);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "system", content: ragPrompt }, ...enrichedMessages], stream: true }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
