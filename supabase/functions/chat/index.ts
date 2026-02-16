import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA_DESCRIPTION = `
Table: properties_2025
Columns:
- uqid (integer, PK)
- id (text) — property listing ID
- region (text) — e.g. North Badung, South Badung, Gianyar, Mengwi, Denpasar, Tabanan, Central Badung, Non Bali, Other
- location (text) — e.g. Canggu, Ubud, Seminyak, Berawa, Pererenan, Sanur, Uluwatu, Kerobokan, Jimbaran, Ungasan, etc.
- contract_type (text) — Leasehold or Freehold
- property_type (text) — Villa or Apartment
- years (numeric) — lease duration in years (null for freehold)
- bedrooms (numeric)
- bathrooms (numeric)
- land_size_sqm (numeric)
- build_size_sqm (numeric)
- fsr (text) — floor space ratio as percentage string like "77%"
- price_idr (numeric) — price in Indonesian Rupiah
- price_usd (numeric) — price in USD
- price_per_sqm_usd (numeric) — price per sqm in USD
- price_per_year_usd (numeric) — price per year in USD (leasehold annualized)
- availability (text) — Available or Sold
- sold_date (text) — month/year sold e.g. "Jul/23"
- scrape_date (text) — month/year scraped e.g. "Dec/25"
- days_listed (numeric)
- off_plan (text) — "Off Plan" or "Available"

Total rows: ~26,951 properties in Bali real estate market.
Use PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col) for medians.
Use AVG() for averages. Always ROUND() numeric results.
Always filter out nulls for the columns being analyzed.
`;

const RAG_SYSTEM_PROMPT = `You are REID, an expert Bali real estate market analyst. You answer questions about the Bali property market using the provided data context.

Guidelines:
- Provide clear, concise, data-backed answers
- When citing statistics, mention the sample size
- Format numbers with commas for readability
- Use bullet points and structured formatting for clarity
- If the data doesn't fully answer the question, say so
- Always mention the data source is the REID 2025 property database
- For price ranges use USD unless user asks for IDR`;

const ANALYTICAL_SYSTEM_PROMPT = `You are REID's SQL analyst. Given a user question about Bali real estate, generate a PostgreSQL query against the properties_2025 table.

${SCHEMA_DESCRIPTION}

Rules:
- Return ONLY a valid SQL SELECT query, nothing else
- No markdown, no explanation, just the raw SQL
- Always use proper aggregation functions
- Limit results to 50 rows max for non-aggregate queries
- Use ILIKE for text matching
- Handle nulls properly with WHERE col IS NOT NULL
- For median calculations use: PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY col)
- Never use DELETE, UPDATE, INSERT, DROP, ALTER, CREATE or any DDL/DML statements
- Only SELECT queries are allowed`;

const ANALYTICAL_EXPLAIN_PROMPT = `You are REID, an expert Bali real estate analyst. You've just run a SQL query against the REID 2025 property database and received results. 

Present the findings in a clear, insightful way:
- Lead with the key insight
- Use formatted numbers (commas, rounding)
- Add brief market context when relevant
- Use bullet points for multiple data points
- Keep it concise but informative`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const userMessage = messages[messages.length - 1]?.content || "";

    if (mode === "analytical") {
      // Step 1: Generate SQL from user question
      const sqlResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: ANALYTICAL_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!sqlResponse.ok) {
        const status = sqlResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      const sqlData = await sqlResponse.json();
      let sql = sqlData.choices?.[0]?.message?.content?.trim() || "";
      
      // Clean up SQL - remove markdown fences if present
      sql = sql.replace(/^```sql\n?/i, "").replace(/\n?```$/i, "").trim();

      console.log("Generated SQL:", sql);

      // Validate - only SELECT allowed
      const upperSql = sql.toUpperCase().trim();
      if (!upperSql.startsWith("SELECT")) {
        return new Response(JSON.stringify({ error: "Invalid query generated. Only SELECT queries are allowed." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Reject dangerous keywords
      const forbidden = ["DELETE", "DROP", "INSERT", "UPDATE", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE"];
      for (const kw of forbidden) {
        if (upperSql.includes(kw)) {
          return new Response(JSON.stringify({ error: `Forbidden SQL keyword detected: ${kw}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Step 2: Execute the SQL
      const { data: queryResult, error: queryError } = await supabase.rpc("execute_readonly_query", { query_text: sql });

      if (queryError) {
        console.error("Query execution error:", queryError);
        // Fall back to explaining the error
        return new Response(JSON.stringify({ 
          error: `Query failed: ${queryError.message}`,
          sql 
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 3: Have AI explain the results (streaming)
      const explainResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: ANALYTICAL_EXPLAIN_PROMPT },
            { role: "user", content: `User question: ${userMessage}\n\nSQL query executed:\n${sql}\n\nResults:\n${JSON.stringify(queryResult, null, 2)}` },
          ],
          stream: true,
        }),
      });

      if (!explainResponse.ok) throw new Error(`AI explain error: ${explainResponse.status}`);

      return new Response(explainResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else {
      // RAG mode: fetch relevant data as context
      // Extract keywords for data retrieval
      const contextParts: string[] = [];

      // Get summary stats
      const { data: stats } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT 
          count(*) as total_properties,
          count(*) FILTER (WHERE availability = 'Available') as available,
          count(*) FILTER (WHERE availability = 'Sold') as sold,
          ROUND(AVG(price_usd) FILTER (WHERE price_usd IS NOT NULL)) as avg_price_usd,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE price_usd IS NOT NULL)) as median_price_usd,
          count(DISTINCT region) as regions,
          count(DISTINCT location) as locations
        FROM properties_2025`
      });
      if (stats) contextParts.push(`Market Overview: ${JSON.stringify(stats)}`);

      // Get region breakdown
      const { data: regionStats } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT region, count(*) as listings, 
          ROUND(AVG(price_usd) FILTER (WHERE price_usd IS NOT NULL)) as avg_price,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE price_usd IS NOT NULL)) as median_price,
          ROUND(AVG(price_per_sqm_usd) FILTER (WHERE price_per_sqm_usd IS NOT NULL)) as avg_price_sqm
        FROM properties_2025 
        WHERE availability = 'Available'
        GROUP BY region ORDER BY listings DESC`
      });
      if (regionStats) contextParts.push(`Region Breakdown (Available): ${JSON.stringify(regionStats)}`);

      // Get top locations by listing count
      const { data: locationStats } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT location, region, count(*) as listings,
          ROUND(AVG(price_usd) FILTER (WHERE price_usd IS NOT NULL)) as avg_price,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE price_usd IS NOT NULL)) as median_price
        FROM properties_2025
        WHERE availability = 'Available'
        GROUP BY location, region ORDER BY listings DESC LIMIT 20`
      });
      if (locationStats) contextParts.push(`Top 20 Locations (Available): ${JSON.stringify(locationStats)}`);

      // Contract type breakdown
      const { data: contractStats } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT contract_type, property_type, count(*) as listings,
          ROUND(AVG(price_usd) FILTER (WHERE price_usd IS NOT NULL)) as avg_price,
          ROUND(AVG(price_per_year_usd) FILTER (WHERE price_per_year_usd IS NOT NULL)) as avg_annual_cost
        FROM properties_2025
        WHERE availability = 'Available'
        GROUP BY contract_type, property_type ORDER BY listings DESC`
      });
      if (contractStats) contextParts.push(`Contract & Property Type Breakdown: ${JSON.stringify(contractStats)}`);

      const dataContext = contextParts.join("\n\n");

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: `${RAG_SYSTEM_PROMPT}\n\nCurrent data context from REID 2025 Database:\n${dataContext}` },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI gateway error: ${status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
