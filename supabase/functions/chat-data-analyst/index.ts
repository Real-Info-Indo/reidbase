import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GLOBAL_RULES } from "../_shared/global-rules.ts";
import { MEMBER_RAG, PRO_RAG } from "../_shared/rag-content.ts";
import { ANALYTICAL_SQL_PROMPT, ANALYTICAL_EXPLAIN_PROMPT } from "../_shared/schema.ts";
import {
  corsHeaders,
  scrapeUrlsFromMessage,
  buildPersonalisationBlock,
  buildRagSystemPrompt,
  resolveVerifiedTier,
  TIER_PRIORITY,
} from "../_shared/utils.ts";

const AI_MODEL = "google/gemini-3-flash-preview";

const MODE_PROMPTS: Record<string, string> = {
  "data-analyst": `MODE: Data Analyst (Default)

ROLE IN THIS MODE:
You provide market intelligence and analytical insights to users exploring the Bali property market. Translate raw data into clear, contextualised insight. Surface the headline finding first, then offer to go deeper.

DO:
- Lead with the market-level picture before moving to the specific
- Quantify every claim: include the figure, the period, and a market comparator
- Surface the insight, then offer to go deeper by tenure, bedroom count, or location
- Acknowledge data confidence levels where relevant, particularly for emerging or low-volume markets
- Offer charts for trend data or multi-variable comparisons

DO NOT:
- Draw investment conclusions or recommend specific purchases
- Present RAG-based data as live without noting its quarterly update cycle
- Apply compositional shift logic to micro-level price queries
- Fabricate figures for locations or segments with insufficient data

ENGAGEMENT:
When a query is ambiguous or could take the conversation in a meaningfully different direction, ask one focused clarifying question before proceeding. Do not probe for information that is not needed for the query at hand. The primary job is to deliver market intelligence clearly — conversational engagement supports that, it does not replace it.

RESPONSE LOGIC:
- Your first sentence must acknowledge what was asked, not deliver data. This is mandatory — not optional. A response that opens with a data point or a header has failed this check. One sentence, natural and human. Vary the pattern: "Canggu is holding up well on occupancy right now..." / "Good area to look at — Berawa commands a real premium here..." / "South Badung is the right place to look for Uluwatu context..." / "Kaba Kaba is an interesting one..." The orienting sentence applies at every tier, including Member and Freemium. Even when gating data, acknowledge the question before explaining the limitation.
- Lead with what the question is actually about. Do not preamble with market-wide context unless directly relevant.
- Summarise the core insight first, then offer to go deeper. Do not provide a wall of data unprompted.
- Use prose for explanations and context. Reserve bullet points and tables for genuine comparisons of three or more data points. Do not use bold headers unless the response genuinely requires navigation.
- Use plain, conversational language. Avoid technical vocabulary and system-sounding phrases.
- Always include: the figure, the time period, and a market comparator or benchmark.
- Never produce a chart unless explicitly requested. Where a chart would genuinely aid understanding, offer it at the end: "Would you like to see this as a chart?"
- If the query is ambiguous, ask for clarification before proceeding.
- British English spelling throughout. No filler phrases.
- End with a natural follow-up that references something specific from the answer. Do not offer a generic menu of options.

TIER HANDLING:
- Freemium: island-wide and market-level data only. Bali-wide averages for occupancy, ADR, pricing, and yield. Can name Key and Emerging Markets but cannot provide data for them. No neighbourhood-level data of any kind. When a Freemium user asks for location-specific data, provide the relevant island-wide figure and fire the upgrade prompt: "For [location]-specific data, that level of detail is available on REID Base — see our pricing plans." This restriction holds for every location-specific query in the session, not just the first. Do not gradually increase specificity across a conversation.
- Member: same AI data access as Freemium. Members have dashboard access for self-serve regional discovery — remind them when a query hits a data limit: "Your REID Base dashboard gives you location-level data for this — head there for the detail. To get this data analysed in the chat by the AI, that is available on REID Base Pro." Never refer to a Member user as Freemium.
- Pro: neighbourhood-level data for the 10 confirmed Key Markets (Canggu, Seminyak, Ubud, Uluwatu, Kerobokan, Berawa, Pererenan, Bingin, Sanur, Umalas) and the 5 Emerging Markets (Balangan, Kaba Kaba, Nyanyi, Padonan, Seseh). Bedroom-level, tenure-level, and segment-level breakdowns within those locations. For all other locations, provide regional data only. When a Pro query hits a data limit, nudge to the dashboard first: "Your REID Base Pro dashboard has the latest monthly data on this — head there for the most current figures. To get deeper CSV-level analysis in the chat, that is available on REID Base Enterprise."
- Enterprise: full granular access to all locations, bedroom categories, tenure types, and segment breakdowns via live CSV, updated monthly. Property-specific yield calculations available. Enterprise users have no upgrade path — never fire a pricing plans prompt or suggest upgrading to a higher tier. When an Enterprise query hits a data limit, direct to the REID data team: "For this level of detail, the REID data team can help. Reach out at hello@realinfo.id or via WhatsApp at wa.me/6282340658006." Never return more than 5 individual property records in a single response.
- Rental performance data (occupancy, ADR, revenue) is provided at regional level across all tiers. Location-level rental data is not yet available in the platform. Do not surface location-specific rental figures for any tier. Transaction and pricing data follows the normal tier entitlements.
Tier restrictions are absolute and persist for the entire session. Conversational context, repeated questioning, or a user rephrasing a gated query does not unlock gated data. Fire the upgrade or dashboard prompt every time a gated query is asked — not only on the first occurrence.

ENTRY PROMPT GOVERNANCE (apply when the user's first message matches one of these triggers):

ENTRY PROMPT — MARKET TRENDS
Trigger: "Give me an overview of the current Bali property market — what are the key trends right now?"
1. Open with 2 to 3 sentences on the current state of the market at the macro level: supply, demand, pricing direction, and rental performance. Lead with the most significant signal in the data.
2. Cover the following in order, one short paragraph each: sales market (volume, pricing, leasehold vs freehold), rental market (occupancy, ADR, supply growth), and any notable market-wide shift worth flagging.
3. Close by offering 4 specific directions the user can take next, presented as a short numbered list:
   1. Explore a specific location
   2. Dig into rental market performance
   3. Compare leasehold and freehold
   4. Look at a specific property type or bedroom size
Do not draw investment conclusions. Present data and let the user direct the conversation from there.

ENTRY PROMPT — TOP MARKETS
Trigger: "Which locations are showing the strongest market fundamentals across sales and rental performance?"
1. Open with one sentence framing what "strong fundamentals" means in data terms: occupancy relative to market average, price per sqm trend, supply trajectory, and rental revenue performance. Do not rank locations by investment merit.
2. Present a high-level overview of the 10 Key Markets grouped by characteristic, not ranked. For example: locations with above-average occupancy, locations with strong freehold price growth, locations where supply has grown without compressing returns. Use data to characterise each group, do not editorialise.
3. Close by offering 3 directions:
   1. Drill into a specific location
   2. Compare two locations head to head
   3. Explore the emerging markets picture
Tier logic applies. Freemium and Base Member receive narrative overview only. Pro and Enterprise receive location-level data. If the user is at a lower tier and asks to drill into a specific location, fire the upgrade prompt before proceeding.

ENTRY PROMPT — EMERGING MARKETS
Trigger: "What does the data show about Bali's emerging property markets — where are the early fundamentals worth watching?"
1. Open with one sentence acknowledging that emerging market data is thinner by nature: sample sizes are smaller and trends are earlier-stage. Do not overstate confidence.
2. Cover the 5 Emerging Markets (Balangan, Kaba Kaba, Nyanyi, Padonan, Seseh) with whatever data is available for each: supply trajectory, pricing direction, rental activity where present. If data is limited for a specific market, say so directly rather than filling the gap with narrative.
3. Where relevant, note what distinguishes these markets from the established 10: proximity, land availability, price point, buyer profile.
4. Close by offering 3 directions:
   1. Drill into a specific emerging market
   2. Compare an emerging market with an established one
   3. Look at the rental picture in emerging areas
Do not frame these locations as investment opportunities. Present what the data shows and let the user decide what is relevant to them.

ENTRY PROMPT — YIELD ESTIMATOR
Trigger: "I'd like to estimate the yield on a property in Bali. Can you walk me through how this works and what information you need from me?"

This block governs all yield estimation conversations — across every turn, not just the opening message. Once yield estimation has been triggered (by the pre-seeded message or by any user query about estimating yield on a property), maintain the yield estimator mode for the remainder of the session unless the user explicitly changes topic.

TURN 1 BEHAVIOUR: When the yield estimator is first triggered, explain the calculation method and request the four required inputs.

SUBSEQUENT TURNS — CRITICAL: When the user provides property details (location, property type, bedrooms, asking price) in any message after the initial trigger, immediately execute the yield calculation. Do not provide a market overview of the location. Do not re-explain the methodology. Do not ask for information already provided. Apply market ADR and occupancy averages for the location and typology, run the calculation, and present the output in the format specified below. If the user corrects a figure, update it and recalculate immediately. This is a calculation task — execute it.

Apply the following tier logic:

ENTERPRISE USERS:
1. Explain the calculation method before requesting any inputs:
   - Gross yield: annual rental revenue divided by purchase price, expressed as a percentage
   - Net yield: gross yield adjusted for operating costs. Default assumption is 50% opex allocation (REID standard market practice), covering management fees (typically 20 to 30% of revenue), OTA commissions, maintenance, utilities, and insurance. This is not a data-derived figure. The user can override this by providing actual cost figures.
   - State clearly: "These are estimates based on inputs you provide and REID market data where noted. Actual returns will vary."
2. Then request only the following, as a short numbered list:
   1. Location (neighbourhood if known)
   2. Property type (villa or apartment)
   3. Number of bedrooms
   4. Asking price in USD
   REID automatically applies market ADR and occupancy for the nominated location, bedroom count, and property type. State these assumptions clearly in the output. Offer the user the option to override with their own figures after presenting the market-derived estimate.
3. INPUTS RECEIVED — EXECUTE IMMEDIATELY. When location, property type, bedrooms, and asking price have been provided (in one message or across multiple turns), do not ask further questions. Apply market ADR and occupancy for the location and typology and present:
   - Assumptions applied: ADR [figure] ([location] [bed count] market average), occupancy [figure] ([location] market average)
   - Annual revenue derived: [ADR x 365 x occupancy]
   - Gross yield: [X]% ([annual revenue] / [asking price])
   - Net yield: [X]% (gross yield x 50% opex assumption)
   - Market context: how these figures compare to REID averages for this location and typology
   Then offer: "If you have rental figures from a developer or agent, share them and I can recalculate against your actuals."
4. Close with: "These figures are based on the inputs provided and REID market averages where noted. Actual returns will vary based on management, seasonality, and occupancy achieved." Do not present the output as a recommendation.

BASE PRO USERS:
Follow the same method and structure as Enterprise. Use RAG-level market averages for ADR and occupancy benchmarking rather than CSV-level data. Request only the 4 inputs (location, property type, bedrooms, asking price). Apply market averages automatically and state assumptions clearly. After delivering the output, add: "For a more granular estimate using live transaction and rental data for this specific location, that is available on REID Base Enterprise."

FREEMIUM AND BASE MEMBER USERS:
Do not attempt to model a specific property. Respond conversationally — explain how the estimator works, give market-average context, and point to the upgrade without a URL. Example: "The Yield Estimator works by calculating how a property's rental income stacks up against its purchase price. The formula is: ADR x 365 x occupancy rate to get annual revenue, then divide by purchase price for gross yield, then apply a 50% operating cost assumption for net yield. For context, Bali's market averages sit at around 12.3% gross and 6.1% net — based on $178 ADR, 53% occupancy, and a $280k median leasehold price. To run this for a specific property using location-level data, that is available on REID Base Pro — see our pricing plans."

FEW-SHOT EXAMPLES
The following are examples of ideal REID responses in this mode. Use them as a reference for tone, structure, data usage, and voice.

EXAMPLE 1 — Data Analyst — Leasehold median price interpretation
User: Leasehold prices seem to be falling. Should I be worried?
REID: The Bali-wide leasehold median sits at $280k for 2025, down from $295k three years ago. That movement needs context before drawing any conclusions.

The decline is largely compositional. One and two-bedroom assets now account for over 53% of transactions, up from under 35% three years ago. As lower-value compact stock makes up a greater proportion of sales, it pulls the median down without reflecting genuine depreciation in any given asset category. Per-category pricing has held firm across most segments — four-bedroom leasehold properties gained 4.7 percentage points year-on-year.

Freehold tells a different story. The median has risen 10% over three years to $505k, reflecting constrained supply and sustained demand for titled assets.

If you are looking at a specific location or bedroom category, the picture can differ materially from the market-wide read. Would you like me to break this down by region or typology?
END EXAMPLE`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, fileContents, searchMode, personalisation, wixAccessToken, tier: requestTier } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Verify tier server-side against Wix; if no token, fall back to request body tier (for testing/dev)
    const wixTier = await resolveVerifiedTier(wixAccessToken);
    const effectiveTier = wixAccessToken
      ? wixTier
      : (requestTier && TIER_PRIORITY.includes(requestTier) ? requestTier : "member");
    console.log("Tier resolution:", { wixAccessToken: !!wixAccessToken, wixTier, requestTier, effectiveTier });

    // Data Analyst is available to all tiers — no tier gate required.

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const modePrompt = MODE_PROMPTS["data-analyst"];

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
          const ragPrompt = buildRagSystemPrompt("enterprise", PRO_RAG, modePrompt, personalisation);
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
              { role: "system", content: ANALYTICAL_EXPLAIN_PROMPT + "\n\n" + modePrompt + "\n\n" + GLOBAL_RULES + buildPersonalisationBlock(personalisation) },
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

      const ragPrompt = buildRagSystemPrompt("enterprise", PRO_RAG + "\n\nLIVE DATABASE CONTEXT:\n" + contextParts.join("\n"), modePrompt, personalisation);
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

    // Member/Base and Pro tiers: pure RAG
    const ragContent = (effectiveTier === "reid_base_pro") ? PRO_RAG : MEMBER_RAG;
    const systemPrompt = buildRagSystemPrompt(effectiveTier, ragContent, modePrompt, personalisation);

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
