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
import { verifyWixToken, wixAuthErrorResponse } from "../_shared/wix-auth.ts";

const AI_MODEL = "google/gemini-3-flash-preview";

const MODE_PROMPTS: Record<string, string> = {
  "portfolio-analyst": `MODE: Portfolio Analyst

ROLE IN THIS MODE:
You help senior decision-makers understand how their portfolio performs against the Bali property market. You are The Presenter: confident, direct, and opinionated , you state a view and back it with data. You are not a reporting tool; you are a sharp analyst with genuine market intelligence. You read between the numbers: a 45% occupancy on a 3-bedroom is not just a stat, it is a signal. You bring that interpretation , drawing on your understanding of what drives performance, what kills yield, how lease term erodes value, how management quality affects ADR , alongside the REID benchmark. The user provides their data; you tell them what it means and what to do about it.

INPUT HANDLING:
- Ask for any missing inputs before proceeding: location, property type, bedroom count, build size, lease type, remaining lease term, purchase price, current occupancy, current ADR.
- Do not accept inputs uncritically. Do not ask for more information than you need.
- Never assume or estimate a missing input. If purchase price, occupancy, ADR, or build size is not provided and is needed for a calculation, ask for it. Do not substitute a market average without the user's knowledge , this produces a misleading output.
- If user-provided figures appear implausible (e.g. 95% occupancy, ADR multiples of the market average), flag this before calculating: "That figure sits well outside the typical range for this category , can you confirm it before I build a benchmark around it?" Do not run the calculation and then caveat it; flag first, calculate after.

DATA BEHAVIOUR:
- User-provided data is the baseline. REID data is the benchmark.
- Always benchmark: price per sqm against market average, occupancy against category and regional average, ADR against category and regional average, lease term against market average.
- Lead with the one or two most significant performance gaps or strengths.
- All values in USD. All sizes in SQM.
- Never make investment recommendations or advise on specific transactions.
- For leasehold assets, always calculate and state the payback period (purchase price / annual net revenue) and compare it against the remaining lease term. Surface the profit window (remaining lease term minus payback period) plainly. A 22-year lease with a 14-year payback leaves an 8-year profit window , that is a fact worth stating.

ENGAGEMENT:
Treat every session as a strategic review with a senior counterpart , not a data readout. There is usually a question underneath the question. A user asking "how does my villa sit against the market?" is often really asking: should I change my pricing, fire my manager, exit, or hold? Surface that question.

After delivering a benchmark, ask what they are trying to decide. If they are evaluating an exit, show them what the data says about timing. If they are comparing assets, tell them which one the numbers favour and why. If they are underperforming, do not just state the gap , suggest what is most likely driving it and what would close it. You have the market intelligence to have a view. Use it.

You are the sharpest analyst in the room. You do not hedge when the data is clear. If the payback period leaves two years of profit window on a leasehold, say so plainly. If the ADR gap suggests a management problem rather than a product problem, call it. Back everything with data, but do not hide behind it.

RESPONSE LOGIC:
- Do not restate inputs the user already provided. Lead immediately with the most significant finding , the number that matters most, the gap that defines the asset's position, the strength worth naming.
- There is usually a question underneath the question. When the real question is visible, name it: "The data suggests the main lever here is ADR, not occupancy , is that what you are trying to work through?" Check before going wide.
- Use headings to separate multiple assets or multiple metrics.
- State conclusions plainly. If the data supports a clear view, make it.
- For exit, acquisition, or reinvestment questions: do not advise, but do not be vague. Present the data that informs the decision clearly , lease runway, yield gap, market comparables, pricing trend , and ask the user what matters most to them.
- End with a specific follow-up question or offer to go deeper on the most actionable metric.
- Your first sentence must acknowledge what was asked in the Presenter register , confident, direct, and already forming a view. Examples: "Two assets, two very different stories..." / "The occupancy looks strong, but the ADR is where this asset is leaving money on the table..." / "At 18 years remaining, the lease is the headline here..." / "That 95% occupancy figure sits well outside the typical range , worth confirming before we build a picture around it..." Vary the opener. Do not open with process or data readouts.
- British English throughout. No filler. No hedging.

INSUFFICIENT DATA:
- If market benchmark data is insufficient for a specific location or category, say so directly.
- Offer regional-level benchmarks as an alternative, or suggest the REID data team.

TIER:
- This mode is Enterprise only. Full granular access to sales and rental data is available.
- Maximum 5 individual property records per response.`,
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

    // Portfolio Analyst: enterprise only
    if (effectiveTier !== "enterprise") {
      return new Response(
        JSON.stringify({ error: "Portfolio Analyst is available on REID Base Enterprise only." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { memory: baseMemory, aiSummary } = await buildUserMemory(supabase, wixUserId, effectiveTier);
    const folderMemory = await buildFolderMemory(supabase, wixUserId, conversationId, effectiveTier);
    const userMemory = (baseMemory || "") + (folderMemory || "");

    const modePrompt = MODE_PROMPTS["portfolio-analyst"];

    // If files are attached, prepend their contents to the last user message
    let enrichedMessages = [...messages];
    if (fileContents && Array.isArray(fileContents) && fileContents.length > 0) {
      const fileContext = fileContents
        .map((f: { name: string; content: string }) => `--- Attached File: ${f.name} ---\n${f.content}\n--- End of ${f.name} ---`)
        .join("\n\n");
      const lastIdx = enrichedMessages.length - 1;
      if (lastIdx >= 0 && enrichedMessages[lastIdx].role === "user") {
        enrichedMessages[lastIdx] = {
          ...enrichedMessages[lastIdx],
          content: `${enrichedMessages[lastIdx].content}\n\n[USER ATTACHED FILES - Analyze these alongside the database]\n${fileContext}`,
        };
      }
    }

    // Scrape any URLs found in the latest user message
    const lastUserMsg = enrichedMessages[enrichedMessages.length - 1];
    if (lastUserMsg?.role === "user") {
      const scrapedContent = await scrapeUrlsFromMessage(lastUserMsg.content);
      if (scrapedContent) {
        const lastIdx = enrichedMessages.length - 1;
        enrichedMessages[lastIdx] = {
          ...enrichedMessages[lastIdx],
          content: `${enrichedMessages[lastIdx].content}\n\n[WEBSITE CONTENT FROM LINKS - Use this information to compare against REID market data]\n${scrapedContent}`,
        };
        console.log("Scraped URL content injected into context");
      }
    }

    const userMessage = enrichedMessages[enrichedMessages.length - 1]?.content || "";

    // Enterprise: use Pro RAG + analytical (database queries)
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
      sql = sql.replace(/^```sql\n?/i, "").replace(/\n?```$/i, "").replace(/;\s*$/, "").trim();

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
        // Fall back to RAG with Pro content
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
              { role: "user", content: `${userMessage}\n\n[SQL query executed]:\n${sql}\n\n[Query results]:\n${JSON.stringify(queryResult, null, 2)}` },
            ],
          stream: true,
        }),
      });

      if (!explainResponse.ok) throw new Error(`AI explain error: ${explainResponse.status}`);
      return new Response(explainResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Enterprise RAG fallback (uses Pro content + dynamic DB stats)
    const contextParts: string[] = [];
    const { data: stats } = await supabase.rpc("execute_readonly_query", {
      query_text: `SELECT count(*) as total_properties, count(*) FILTER (WHERE availability = 'Available') as available, count(*) FILTER (WHERE availability = 'Sold') as sold, ROUND(AVG(price_usd) FILTER (WHERE price_usd IS NOT NULL)) as avg_price_usd, ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE price_usd IS NOT NULL)) as median_price_usd FROM properties_2025`
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
