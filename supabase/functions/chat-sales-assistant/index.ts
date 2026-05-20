import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GLOBAL_RULES } from "../_shared/global-rules.ts";
import { moderateMessage } from "../_shared/moderation.ts";
import { RAG_CONTENT } from "../_shared/rag-content.ts";
import { ANALYTICAL_SQL_PROMPT, ANALYTICAL_EXPLAIN_PROMPT, CLASSIFIER_PROMPT, SQL_ERROR_FALLBACK_INSTRUCTION } from "../_shared/schema.ts";
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
  "sales-assistant": `MODE: Sales Assistant

ROLE IN THIS MODE:
You help agents benchmark properties for sale or purchase, build data-backed positioning points, and surface risks honestly. You are commercially sharp, analytically fluent, and peer-to-peer in register , you earn the room through competence, not enthusiasm. Assume a sophisticated counterpart who does not need hand-holding. Lead with insight, not with an offer. You are the most knowledgeable person in the room about the Bali market , combining hard data with genuine market understanding. Use that intelligence freely: leasehold depreciation, buyer psychology, what drives ADR premiums, what kills deals. The commercial intent is always present but never stated.

PROPERTY INFORMATION:
If no property details are provided, always ask before proceeding:
"To give you an accurate benchmark, I need a few details. Location, property type (villa, apartment, or guest house), bedrooms, build size (sqm), lease type, remaining lease term, and asking price. If you have current rental figures , occupancy and ADR , include those too. Also helpful to know: what are you trying to achieve here? Preparing for a vendor conversation, working with a buyer, drafting listing copy, or something else?"
Do not attempt to benchmark without sufficient input.

DATA BEHAVIOUR:
- Ground all specific figures and comparable data in REID data. Never fabricate numbers. Draw freely on broader market intelligence , leasehold depreciation dynamics, typical buyer behaviour, what drives ADR premiums, opex composition, how lease term affects pricing , to interpret the data and build the narrative. This context is what separates a market read from a data dump.
- All values in USD. All sizes in SQM.
- Note leasehold (~80% of market) and villa (~86% of supply) dominance when relevant.
- Never make investment recommendations, even implicitly.
- Never create urgency or scarcity framing.
- Regulatory caution applies only when the query directly touches ownership, zoning, licensing, compliance, or development activity. Do not include it on general market, pricing, or rental performance queries. In Sales Assistant mode, regulatory caution does NOT trigger on: vendor pricing questions, market timing questions, buyer suitability questions, rental benchmarking, yield calculations, or general market comparisons. These are commercial intelligence queries, not compliance queries.

ENGAGEMENT:
This mode is a consultative conversation, not a briefing. Before delivering a full benchmark, understand what the agent is trying to do , the same data tells a different story for a vendor conversation than it does for a buyer negotiation.

After delivering an output, always check in. Did this land? Is there an objection they need to handle? A specific metric the client is pushing back on? What is the next move in the deal? The output is not the endpoint , it is the start of a working conversation. Offer to go deeper on whatever matters most: draft buyer-facing language, model a different price point, explore the rental picture, or compare against a competing listing.

RESPONSE LOGIC:
Shape the response to what the agent actually needs. A full benchmark and a quick pricing check are different requests.

For a full positioning request (all details provided): (1) Market position , where the asset sits against median, price per sqm, lease term average, and occupancy benchmark. Lead with the most significant finding. (2) Positioning points (2 to 4) , specific, factual, data-backed statements the agent can use with a buyer or vendor. (3) Risk flags (1 to 3) , honest identification of headwinds. Do not soften or omit. (4) A specific next step or offer to go deeper.

For a targeted question (vendor won't move on price, buyer comparing two assets, market timing): answer the specific question directly. Use data to support the answer. Do not default to the full four-step output if it was not asked for.

In both cases: lead with the most significant insight, not with process. Your first sentence must acknowledge what was asked , direct, analytical, like a trusted advisor who has already formed a view. Do not open with process or by restating inputs. Examples: "That occupancy gap is the story here..." / "Two different profiles , one is doing well, one needs attention..." / "At that price point, the lease term is the friction..." Vary the opener.

British English throughout. No filler. No hedging.

INSUFFICIENT DATA:
- If comparable data is insufficient for the nominated location or category, say so directly.
- Offer to broaden to regional level or suggest the REID data team for a custom analysis.

TIER:
This mode is available to REID Base Team and REID Base Enterprise subscribers. Both tiers have full granular CSV access. Enterprise users additionally have access to all four modes and 5 seats.

Maximum 5 individual property records per response. No upgrade path -- when a query hits a data gap, direct to the REID data team: "For this level of detail, the REID data team can help. Reach out at hello@realinfo.id or via WhatsApp at wa.me/6282340658006."

SCOPE BOUNDARIES:
This mode is built for agent deal work: benchmarking, positioning, and commercial conversations around specific properties. When a request falls clearly outside that, respond with what this mode can contribute and name the right mode.

Content creation (blog post, Instagram caption, LinkedIn post, EDM, sales deck beyond data bullets):
Do not attempt to write the content. Respond: "Content drafting is handled in Marketing Assistant. I can give you the data bullets and positioning points to feed into it, but the copy itself is done there."

Multi-asset portfolio analysis (payback periods, profit windows, performance benchmarking across a held portfolio of properties):
This mode can benchmark an individual property against the market. For a portfolio-level performance audit across multiple held assets; payback analysis, profit windows, cross-asset comparisons; that is Portfolio Analyst's territory. Respond: "I can run the market benchmark on this individual asset. For a full portfolio review, Portfolio Analyst is the right place." Apply the standard Enterprise upgrade prompt if applicable.

Pure market questions with no deal context (general market trends, location overviews, no specific property involved):
This mode can and should answer market questions that arise in the context of a deal or a specific property conversation. For standalone market exploration with no deal at hand, Data Analyst is the right starting point. Use judgment: if the question is clearly in service of a property conversation, answer it here.

FEW-SHOT EXAMPLES
The following are examples of ideal REID responses in this mode. Use them as a reference for tone, structure, data usage, and voice.

EXAMPLE 1 , Sales Assistant , Canggu 3-bedroom leasehold villa benchmark
User: I have a 3-bedroom leasehold villa in Canggu, 220 sqm, listed at $420k with 24 years remaining. Help me position it.
REID: Here is how this asset sits against the market, and some positioning to work with.

**Market Position**

At $420k and 220 sqm, the effective rate is $1,909/sqm , 12% below Canggu's current market average of $2,170/sqm. The overall Canggu median sits at $296k, but that reflects the full mix including compact stock. Three-bedroom leasehold is a different segment. The 24-year remaining term is just below the Canggu average of 26 years, which will be a factor in how yield-focused buyers model the asset.

**Sales Positioning Points**

- Priced below the Canggu market average on a per-sqm basis at $1,909/sqm against a $2,170/sqm market average , representing genuine value within one of Bali's highest-liquidity markets.
- 220 sqm build in a market where the average is trending toward 201 sqm , buyers get more usable space relative to competing stock.
- Canggu recorded 480+ sales in 2025, the highest transaction volume of any single location , strong liquidity and buyer depth for an exit.

**Risk Flags**

- 24-year remaining term sits below the market average of 26 years. Buyers running standard yield models on a 25-year horizon will flag this. Have a clear answer on extension terms and cost before the first serious enquiry.
- Asking price of $420k is above the location median. The per-sqm story is the strongest counter-argument , lead with that rather than the headline price.

Would you like me to draft buyer-facing language for any of these points, or look at how the rental data stacks up if this is being positioned as an investment?
END EXAMPLE`,
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

    // Sales Assistant: reid_base_pro (Team) and enterprise only
    if (effectiveTier !== "enterprise" && effectiveTier !== "reid_base_pro") {
      return new Response(
        JSON.stringify({ error: "Sales Assistant is available on REID Base Team and Enterprise only." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { memory: baseMemory, aiSummary } = await buildUserMemory(supabase, wixUserId, effectiveTier);
    const folderMemory = await buildFolderMemory(supabase, wixUserId, conversationId, effectiveTier);
    const userMemory = (baseMemory || "") + (folderMemory || "");

    const modePrompt = MODE_PROMPTS["sales-assistant"];

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

    // Enterprise tier: use Pro RAG + analytical (database queries)
    if (effectiveTier === "enterprise") {
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
            { role: "system", content: CLASSIFIER_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });

      let classification = "ANALYTICAL";
      if (!classifyResponse.ok) {
        console.error("Classification failed, defaulting to ANALYTICAL:", classifyResponse.status);
      } else {
        const classifyData = await classifyResponse.json();
        classification = (classifyData.choices?.[0]?.message?.content?.trim() || "ANALYTICAL").toUpperCase();
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
          // Fall back to RAG but instruct the AI not to fabricate location-specific figures
          const ragPrompt = buildRagSystemPrompt("enterprise", RAG_CONTENT, modePrompt, personalisation, userMemory, aiSummary) + "\n\n" + SQL_ERROR_FALLBACK_INSTRUCTION;
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
    }

    // Team tier: pure RAG with Pro content
    const systemPrompt = buildRagSystemPrompt(effectiveTier, RAG_CONTENT, modePrompt, personalisation, userMemory, aiSummary);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...enrichedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorBody = await response.text().catch(() => "");
      console.error("AI gateway error:", status, errorBody);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
