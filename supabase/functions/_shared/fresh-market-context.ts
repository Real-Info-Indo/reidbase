// Fresh market context builder.
//
// Detects "current market" intents on pre-loaded landing/widget prompts
// and runs safe read-only aggregate queries against the REID database so
// the AI answers from the latest data instead of static RAG copy.
//
// Tier handling:
// - Free users: Bali-wide and REID regional aggregates only. Never inject
//   neighbourhood/location-level rows.
// - Member, Team, Enterprise: same Bali-wide + regional context (this block
//   is intentionally aggregate; deeper drill-downs are handled by the normal
//   RAG / SQL paths once the user follows up).

export type FreshIntent =
  | "market_overview"
  | "top_markets"
  | "off_plan"
  | "yield_estimator"
  | "none";

interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[\u2018\u2019']/g, "").replace(/\s+/g, " ").trim();

// Exact triggers from NewAnalysis suggestions and ChatWidget quick buttons.
const EXACT_MARKET_OVERVIEW = [
  "give me an overview of the current bali property market, what are the key trends right now?",
  "give me an overview of the current bali property market , what are the key trends right now?",
  "give me an overview of the current bali property market",
  "what are the latest property market trends in bali?",
  "what are the latest property market trends in bali",
];
const EXACT_TOP_MARKETS = [
  "which locations are showing the strongest market fundamentals across sales and rental performance?",
  "which locations are showing the strongest market fundamentals across sales and rental performance",
];
const EXACT_OFF_PLAN = [
  "what does the data show about balis off-plan property market?",
  "what does the data show about balis off-plan property market",
];
const EXACT_YIELD = [
  "id like to estimate the yield on a property im looking at, how does this work?",
  "id like to estimate the yield on a property im looking at , how does this work?",
  "id like to estimate the yield on a property in bali. can you walk me through how this works and what information you need from me?",
  "what are the current yield figures across bali locations?",
  "what are the current yield figures across bali locations",
];

const CURRENT_TOKENS = ["current", "latest", "right now", "recent", "today", "at the moment", "this quarter", "this year"];

export function classifyFreshIntent(message: string): FreshIntent {
  if (!message) return "none";
  const m = norm(message);
  const isCurrent = CURRENT_TOKENS.some(t => m.includes(t));

  if (EXACT_MARKET_OVERVIEW.some(p => m === p || m.startsWith(p))) return "market_overview";
  if (EXACT_TOP_MARKETS.some(p => m === p || m.startsWith(p))) return "top_markets";
  if (EXACT_OFF_PLAN.some(p => m === p || m.startsWith(p))) return "off_plan";
  if (EXACT_YIELD.some(p => m === p || m.startsWith(p))) return "yield_estimator";

  // Off-plan intent (any phrasing).
  if (/\boff[- ]?plan\b/.test(m) && (isCurrent || /(market|supply|pipeline|data)/.test(m))) {
    return "off_plan";
  }

  // Yield estimator intent.
  if (/(yield estimator|estimate (the )?yield|calculate (the )?yield)/.test(m)) {
    return "yield_estimator";
  }
  if (isCurrent && /\byield(s)?\b/.test(m)) return "yield_estimator";

  // Top markets / strongest fundamentals.
  if (/(top markets|strongest (market )?fundamentals|best performing (markets|locations)|which (locations|markets) (are )?(performing|showing))/.test(m)) {
    return "top_markets";
  }

  // Generic "current market overview" intent.
  if (isCurrent && /(market|trend|overview|fundamentals|property market)/.test(m)) {
    return "market_overview";
  }
  if (/(overview of the (current )?bali (property )?market|key trends right now|state of the market)/.test(m)) {
    return "market_overview";
  }

  return "none";
}

async function safeQuery(supabase: SupabaseLike, sql: string): Promise<unknown[] | null> {
  try {
    const { data, error } = await supabase.rpc("execute_readonly_query", { query_text: sql });
    if (error) {
      console.warn("[fresh-market-context] query error:", (error as { message?: string })?.message || error);
      return null;
    }
    if (!data) return [];
    return Array.isArray(data) ? (data as unknown[]) : [data as unknown];
  } catch (e) {
    console.warn("[fresh-market-context] query threw:", e instanceof Error ? e.message : e);
    return null;
  }
}

const fmt = (rows: unknown[] | null) => (rows && rows.length ? JSON.stringify(rows) : "no data");

// ── Aggregate queries (Bali-wide + regional only; safe for all tiers) ──

const Q_LATEST_PERIODS = `
SELECT
  (SELECT TO_CHAR(MAX(TO_DATE(scrape_date, 'Mon/YY')), 'Mon YYYY') FROM reid_properties WHERE scrape_date IS NOT NULL) AS latest_scrape,
  (SELECT TO_CHAR(MAX(TO_DATE(sold_date, 'Mon/YY')), 'Mon YYYY')   FROM reid_properties WHERE availability='Sold' AND sold_date IS NOT NULL) AS latest_sold,
  (SELECT TO_CHAR(MAX(TO_DATE(date, 'Mon/YY')), 'Mon YYYY')        FROM reid_rentals) AS latest_rental
`;

const Q_BALI_TXN = `
SELECT
  COUNT(*) AS sold_count_t12,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd))::int AS median_sold_price_usd,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd))::int AS median_price_per_sqm_usd
FROM reid_properties
WHERE availability='Sold' AND sold_date IS NOT NULL AND price_usd IS NOT NULL
  AND TO_DATE(sold_date,'Mon/YY') >= (SELECT MAX(TO_DATE(sold_date,'Mon/YY')) FROM reid_properties WHERE availability='Sold' AND sold_date IS NOT NULL) - INTERVAL '11 months'
`;

const Q_BALI_SUPPLY = `
SELECT
  COUNT(*) AS active_supply,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd))::int AS median_asking_price_usd,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd))::int AS median_asking_per_sqm_usd
FROM reid_properties
WHERE availability='Available' AND price_usd IS NOT NULL
  AND TO_DATE(scrape_date,'Mon/YY') >= (SELECT MAX(TO_DATE(scrape_date,'Mon/YY')) FROM reid_properties) - INTERVAL '5 months'
`;

const Q_BALI_OFFPLAN = `
SELECT
  COUNT(*) FILTER (WHERE off_plan ILIKE 'Off Plan') AS off_plan_count,
  COUNT(*) FILTER (WHERE off_plan ILIKE 'Available' OR off_plan IS NULL) AS available_count
FROM reid_properties
WHERE TO_DATE(scrape_date,'Mon/YY') >= (SELECT MAX(TO_DATE(scrape_date,'Mon/YY')) FROM reid_properties) - INTERVAL '5 months'
`;

const Q_BALI_RENTAL = `
SELECT
  ROUND(AVG(occupancy)::numeric, 1) AS avg_occupancy_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rate_usd))::int AS median_adr_usd,
  ROUND(AVG(monthly_usd))::int AS avg_monthly_revenue_usd
FROM reid_rentals
WHERE TO_DATE(date,'Mon/YY') >= (SELECT MAX(TO_DATE(date,'Mon/YY')) FROM reid_rentals) - INTERVAL '11 months'
`;

const Q_REGIONAL_TXN = `
SELECT region,
  COUNT(*) AS sold_count_t12,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd))::int AS median_sold_price_usd,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd))::int AS median_price_per_sqm_usd
FROM reid_properties
WHERE availability='Sold' AND sold_date IS NOT NULL AND price_usd IS NOT NULL AND region IS NOT NULL
  AND TO_DATE(sold_date,'Mon/YY') >= (SELECT MAX(TO_DATE(sold_date,'Mon/YY')) FROM reid_properties WHERE availability='Sold' AND sold_date IS NOT NULL) - INTERVAL '11 months'
GROUP BY region
HAVING COUNT(*) >= 5
ORDER BY sold_count_t12 DESC
LIMIT 12
`;

const Q_REGIONAL_SUPPLY = `
SELECT region,
  COUNT(*) AS active_supply,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd))::int AS median_asking_price_usd
FROM reid_properties
WHERE availability='Available' AND region IS NOT NULL AND price_usd IS NOT NULL
  AND TO_DATE(scrape_date,'Mon/YY') >= (SELECT MAX(TO_DATE(scrape_date,'Mon/YY')) FROM reid_properties) - INTERVAL '5 months'
GROUP BY region
ORDER BY active_supply DESC
LIMIT 12
`;

const Q_REGIONAL_RENTAL = `
SELECT region,
  ROUND(AVG(occupancy)::numeric, 1) AS avg_occupancy_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rate_usd))::int AS median_adr_usd,
  ROUND(AVG(monthly_usd))::int AS avg_monthly_revenue_usd
FROM reid_rentals
WHERE region IS NOT NULL
  AND TO_DATE(date,'Mon/YY') >= (SELECT MAX(TO_DATE(date,'Mon/YY')) FROM reid_rentals) - INTERVAL '11 months'
GROUP BY region
ORDER BY avg_monthly_revenue_usd DESC NULLS LAST
LIMIT 12
`;

const Q_OFFPLAN_BY_TYPE = `
SELECT property_type,
  COUNT(*) FILTER (WHERE off_plan ILIKE 'Off Plan') AS off_plan_count,
  COUNT(*) FILTER (WHERE off_plan ILIKE 'Available' OR off_plan IS NULL) AS available_count,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE off_plan ILIKE 'Off Plan'))::int AS median_offplan_price_usd,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd) FILTER (WHERE off_plan ILIKE 'Off Plan'))::int AS median_offplan_per_sqm_usd
FROM reid_properties
WHERE property_type IS NOT NULL
  AND TO_DATE(scrape_date,'Mon/YY') >= (SELECT MAX(TO_DATE(scrape_date,'Mon/YY')) FROM reid_properties) - INTERVAL '5 months'
GROUP BY property_type
`;

const Q_OFFPLAN_BY_REGION = `
SELECT region,
  COUNT(*) FILTER (WHERE off_plan ILIKE 'Off Plan') AS off_plan_count
FROM reid_properties
WHERE region IS NOT NULL
  AND TO_DATE(scrape_date,'Mon/YY') >= (SELECT MAX(TO_DATE(scrape_date,'Mon/YY')) FROM reid_properties) - INTERVAL '5 months'
GROUP BY region
ORDER BY off_plan_count DESC
LIMIT 8
`;

const Q_YIELD_LEASEHOLD = `
SELECT
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_usd))::int AS median_leasehold_price_usd
FROM reid_properties
WHERE contract_type='Leasehold' AND availability='Available' AND price_usd IS NOT NULL
  AND TO_DATE(scrape_date,'Mon/YY') >= (SELECT MAX(TO_DATE(scrape_date,'Mon/YY')) FROM reid_properties) - INTERVAL '5 months'
`;

export async function buildFreshMarketContext(
  supabase: SupabaseLike,
  userMessage: string,
  effectiveTier: string,
): Promise<{ intent: FreshIntent; block: string }> {
  const intent = classifyFreshIntent(userMessage);
  if (intent === "none") return { intent, block: "" };

  const isFree = effectiveTier === "free" || effectiveTier === "freemium";
  const lines: string[] = [];
  lines.push("LATEST REID DATABASE CONTEXT (use these figures in preference to any older RAG numbers; state the period naturally, e.g. \"based on the latest REID data through [period]\"):");

  const periods = await safeQuery(supabase, Q_LATEST_PERIODS);
  if (periods?.[0]) lines.push(`- Latest data periods: ${JSON.stringify(periods[0])}`);

  if (intent === "market_overview") {
    // Transaction-side first, then rental-side.
    const txn = await safeQuery(supabase, Q_BALI_TXN);
    const supply = await safeQuery(supabase, Q_BALI_SUPPLY);
    const offplan = await safeQuery(supabase, Q_BALI_OFFPLAN);
    const rental = await safeQuery(supabase, Q_BALI_RENTAL);
    lines.push("- [Transaction] Bali-wide sold (T12): " + fmt(txn));
    lines.push("- [Transaction] Bali-wide active supply (last 6mo): " + fmt(supply));
    lines.push("- [Transaction] Off-plan vs available split: " + fmt(offplan));
    lines.push("- [Rental] Bali-wide rental performance (T12): " + fmt(rental));
  } else if (intent === "top_markets") {
    const txnRegional = await safeQuery(supabase, Q_REGIONAL_TXN);
    const supplyRegional = await safeQuery(supabase, Q_REGIONAL_SUPPLY);
    const rentalRegional = await safeQuery(supabase, Q_REGIONAL_RENTAL);
    lines.push("- [Transaction] Regional sold volume + median sold price (T12): " + fmt(txnRegional));
    lines.push("- [Transaction] Regional active supply + median asking price (last 6mo): " + fmt(supplyRegional));
    lines.push("- [Rental] Regional rental performance (T12): " + fmt(rentalRegional));
    if (isFree) {
      lines.push("- TIER NOTE: caller is Free. Present the regional groupings narratively. Do NOT name neighbourhood-level winners or quote location-level figures. Fire the upgrade prompt if the user asks to drill into a specific location.");
    }
  } else if (intent === "off_plan") {
    const byType = await safeQuery(supabase, Q_OFFPLAN_BY_TYPE);
    const byRegion = await safeQuery(supabase, Q_OFFPLAN_BY_REGION);
    const balOffplan = await safeQuery(supabase, Q_BALI_OFFPLAN);
    lines.push("- [Transaction] Bali-wide off-plan vs available counts: " + fmt(balOffplan));
    lines.push("- [Transaction] Off-plan supply and pricing by property type: " + fmt(byType));
    lines.push("- [Transaction] Off-plan supply by region: " + fmt(byRegion));
    if (isFree) {
      lines.push("- TIER NOTE: caller is Free. Stay at Bali-wide and regional level. Do not name neighbourhood-level off-plan figures.");
    }
  } else if (intent === "yield_estimator") {
    const rental = await safeQuery(supabase, Q_BALI_RENTAL);
    const lease = await safeQuery(supabase, Q_YIELD_LEASEHOLD);
    lines.push("- [Yield benchmark] Bali-wide rental T12 (use for ADR + occupancy benchmarks): " + fmt(rental));
    lines.push("- [Yield benchmark] Bali-wide median leasehold asking price (last 6mo): " + fmt(lease));
    lines.push("- Use these latest figures when explaining the calculation. Compute: gross = ADR x 365 x occupancy / price; net = gross x 0.5.");
    if (isFree) {
      lines.push("- TIER NOTE: caller is Free. Keep the explanation island-wide, do not model a specific property, and fire the upgrade prompt.");
    }
  }

  lines.push("END LATEST REID DATABASE CONTEXT.");
  lines.push("Ordering rule: when presenting mixed market context, lead with transaction-side metrics (volume, sold price, price per sqm, active supply, asking price, off-plan supply) before rental-side metrics (occupancy, ADR, revenue, yield), unless the prompt is explicitly rental-led.");

  return { intent, block: lines.join("\n") };
}
