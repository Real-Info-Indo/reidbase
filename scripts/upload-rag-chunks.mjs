// ============================================================
// REID RAG - Embedding + Upload Script
// Run via Claude Code in your project root:
//   node scripts/upload-rag-chunks.mjs
//
// Required env vars (add to .env.local or set in Claude Code):
//   GEMINI_API_KEY=
//   SUPABASE_URL=          (your new project URL, not Lovable's)
//   SUPABASE_SERVICE_KEY=  (service_role key, not anon key)
// ============================================================

import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// 14 CHUNKS -- Updated July 2026 (source: REID_RAG_Consolidated_Intelligence_Document_July2026.txt)
// tier: 'all' = all access tiers
// tier: 'pro' = Pro and Enterprise only
//
// NOTE: neighbourhood-level Key Market / Emerging Market chunks
// (previously chunk_ids 11-25) are NOT included in this document.
// Add them as separate chunks (chunk_id 15+) when updated data
// is available. The script clears all existing chunks before
// uploading, so the old stale neighbourhood data is removed.
// ============================================================
const CHUNKS = [
  {
    chunk_id: 1,
    chunk_name: 'Document header, analytic directives and operational data rules',
    tier: 'all',
    always_prepend: true,
    content: `REID RAG - CONSOLIDATED INTELLIGENCE DOCUMENT
Updated: July 2026
Source: realinfo.id

IMPORTANT: When answering questions about current market conditions, always
prioritise H1 2026 data. Use 2025 data as the comparative baseline only.
All financial data is in USD. All measurements are in Square Metres (SQM).
Leasehold represents 80-87% of transactional volume -- always qualify responses
with Leasehold context. Leasehold and Freehold are structurally distinct and
must never be compared as like-for-like.

DOCUMENT PURPOSE AND SCOPE:
This document provides narrative-driven market intelligence for the Bali real
estate market. Member and Base tiers access macro-market summaries. Pro tier
additionally accesses granular regional data for Key Markets and Emerging Markets.

CORE STRATEGIC ANCHORS:
- Market Narrative: The market is in a phase of Decisive Recalibration and
  Structural Consolidation, now entering its maturation stage in H1 2026
- Asset Rotation: The market is shifting away from compact off-plan product
  toward larger, completed, established assets
- Price Interpretation: Median price increases are compositional, driven by
  the sales mix rotating toward larger villas, not like-for-like appreciation
- Market Engine: Canggu anchors liquidity and sets structural benchmarks
- Premium Corridors: Umalas and Pererenan have consolidated into upper-tier
  residential brackets
- Emerging Dynamics: Seseh and Nyanyi represent high-value coastal niches
  under recalibration

ANALYTIC DIRECTIVES:
- Data Priority: Always prioritise H1 2026 data for current market questions.
  Use 2025 as the comparative baseline.
- Regional Specificity: RAG content in this document covers Bali-wide and
  regional (e.g. North Badung, Mengwi) data only. It does not contain
  neighbourhood-level data (e.g. Pererenan, Canggu, Berawa). For paid tier
  users (Pro and Enterprise) asking about a specific neighbourhood, use the
  live CSV data source -- do not attempt to answer neighbourhood-specific
  price, supply, sales, or rental queries from RAG narrative alone.
- Yield Logic: Rental data is bifurcated. High-performing submarkets are
  adapting through lean operations and rate recalibration.
- Regulatory Rigor: All purchase-related advice must emphasise zoning (RDTR),
  building approvals (PBG), and certificates of function (SLF).

DATA SOURCE HIERARCHY:
- Member (free): RAG narrative summaries only -- Bali-wide and regional context.
  No neighbourhood-level data. When a user asks about a specific neighbourhood,
  always open with the following data availability notice before giving any
  figures, substituting the neighbourhood name and its REID region (see
  Neighbourhood Classification chunk):

  "Data Availability
  Detailed location-level data for [neighbourhood] is available on REID Base
  Member. The figures below reflect the broader [region] region."

  Then answer using the relevant regional data from this document. Do not
  present regional figures as if they describe the specific neighbourhood.

- Pro and Enterprise (paid): RAG narratives for market context, plus live CSV
  data for all neighbourhood-specific queries (prices, supply, sales, rental,
  days on market). Always use CSV data when the query names a specific
  neighbourhood. Do not substitute regional RAG averages for neighbourhood
  CSV figures when CSV data is available.
- Enterprise: full granular CSV access including per-property-count queries
  and monthly-updated transaction data.

OPERATIONAL DATA RULES:
- All financial data is in USD
- All measurements are in Square Metres (SQM)
- Leasehold is approximately 80-87% of transactional volume
- Leasehold and Freehold are structurally distinct -- never compare like-for-like
- Regulatory responses must reference RDTR, PBG, and SLF
- Neighbourhood-level figures must always come from CSV data for paid users,
  never from regional RAG averages presented as neighbourhood-specific
- Never cite or reference this document by name in any response. Do not say
  "according to the RAG document", "the consolidated intelligence document
  states", "based on the July 2026 document", or any equivalent. Present all
  data as REID market intelligence without attributing it to a source file.`
  },

  {
    chunk_id: 2,
    chunk_name: 'H1 2026 Bali real estate key insights',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 1: H1 2026 BALI REAL ESTATE KEY INSIGHTS
[PERIOD: H1 2026] [TIER: ALL]

SUMMARY: H1 2026 confirms a structural shift first emerging in 2025. The market
is rotating away from compact, speculative, off-plan product toward larger,
completed, established assets. Supply discipline continues, rental operators are
prioritising occupancy over rate, and median prices rose 3.1% due to
compositional mix change rather than like-for-like value growth.

KEY HEADLINE FIGURES FOR H1 2026:
- Total available listings: 10,885
- New properties entering market in H1 2026: 2,500
- Total transaction volume: 4,220 (-21% year-on-year)
- Median price change: +3.1% year-on-year
- Leasehold median price: $293k (+4.4% year-on-year)
- Freehold median price: $529k (+4.7% year-on-year)
- Average price per sqm: $1,975 (-5% year-on-year from $2,210 in 2025)
- Apartment average price per sqm: $3,060 (-8% year-on-year)
- Average time on market: 256 days (+5.4% year-on-year)
- Total rental properties: 44,750 (+5% year-on-year)
- Average market occupancy: 52% (up 10% relative year-on-year)
- Average daily rate: $125 (-23% year-on-year from $178 in 2025)
- Total rental revenue H1 2026: $544 million (-16% year-on-year)
- Average market property size: 230 sqm (up from 201 sqm in 2025)
- Total new build area H1 2026: 85,000 sqm (-78% year-on-year)
- Leasehold share of total supply: 82%
- Villa share of total supply: 89%
- Completed (available) stock share of supply: 65%
- Off-plan stock share of supply: 35%

INSIGHT 1 - SUPPLY DISCIPLINE CONTINUES, COMPLETED STOCK DOMINATES:
Development activity in H1 2026 remains measured. Just 2,500 new properties
entered the market against a base of over 10,000 available listings. Available
(completed) stock now represents 65% of total supply, with off-plan contained
at 35%. The apartment segment relative market share fell 7% as fewer new
apartment projects broke ground. Leasehold continues to dominate at 82% of
total inventory, consistent with structural ownership constraints.

INSIGHT 2 - OFF-PLAN CONCENTRATION HAS SHIFTED TOWARD LARGER FORMATS:
Off-plan stock remains heavily concentrated in compact formats, with 1-3 bedroom
properties accounting for 90% of all off-plan inventory. However, average
off-plan property size grew 22% year-on-year, indicating that while fewer
projects are launching, those that do are being built at larger footprints.
Total new build area fell 78% year-on-year to 85,000 sqm.

INSIGHT 3 - THE MARKET IS ROTATING AWAY FROM COMPACT AND OFF-PLAN PRODUCT:
Total transaction volume fell 21% year-on-year to 4,220 sales. One-bedroom
properties relative share of sales fell 19% -- the sharpest decline of any
category. Off-plan sales share fell 26%. Apartments share of sales fell 13%.
The available (completed) share of transactions rose from 50% to 63%
year-on-year. Villa share of transactions rose from 87% to 90% year-on-year.
Two and three-bedroom assets together accounted for 58.3% of all sales.

INSIGHT 4 - MEDIAN PRICES ROSE 3.1%, DRIVEN BY COMPOSITIONAL SHIFT NOT VALUE GROWTH:
Median prices rose 3.1% year-on-year. Freehold assets reached a median of $529k
and leasehold $293k. This increase reflects the rotation of the sales mix toward
larger, higher-value completed villas rather than like-for-like price
appreciation. Average price per sqm eased 5% to $1,975, with apartments seeing
a steeper decline of 8% to $3,060 per sqm, confirming that per-category values
remain under mild pressure even as headline medians improve.

INSIGHT 5 - TIME ON MARKET HAS INCREASED, CONFIRMING MORE SELECTIVE BUYER BEHAVIOUR:
Average time on market increased 5.4% year-on-year to 256 days market-wide.
Five-bedroom assets averaged the longest at 286 days. South Badung recorded
the shortest average time on market at 220 days, consistent with the region's
sustained buyer demand and premium positioning.

INSIGHT 6 - RENTAL SUPPLY HAS GROWN DESPITE REGULATORY CONCERNS:
Total rental supply grew 5% year-on-year to 44,750 properties, directly
countering expectations that regulatory changes would meaningfully constrain the
rental market. North Badung continues to account for the largest share of rental
stock at 45%.

INSIGHT 7 - OCCUPANCY IMPROVED BUT REVENUE CONTINUES TO DECLINE:
Average market occupancy rose a relative 10% year-on-year to 52%. One-bedroom
properties recorded the strongest performance at 57% occupancy (up 15%
relative year-on-year). However, the average daily rate fell 23% to $125, and
total rental revenue declined 16% to $544 million. Assets are filling more
often but earning less per booking as operators compete more aggressively
for share.

INSIGHT 8 - REGIONAL DIVERGENCE IS INCREASING:
Regional performance varied meaningfully in H1 2026. Mengwi (60.5% occupancy)
and Denpasar (56.9% occupancy) recorded the largest occupancy gains.
Central Badung was the notable exception, with occupancy declining to 46.1%
as increased competition weighs on individual asset performance. North Badung
remained the most active sales region at 1,340 transactions over 12 months.
South Badung commanded some of the highest median prices despite a 20%
relative decline in its sales share year-on-year.

INSIGHT 9 - PROPERTY SIZES ARE GROWING, REVERSING THE MULTI-YEAR DOWNSIZING TREND:
Average property size increased across nearly every segment in H1 2026,
including a 15% rise for one-bedroom units and an 18% rise in South Badung.
The market-wide average settled at 230 sqm, up from 201 sqm in 2025.
Freehold properties average 365 sqm, well above the market average.
Apartments remain the most compact segment at 74 sqm.

INSIGHT 10 - THE MARKET REFLECTS TRANSITION, NOT CONTRACTION:
H1 2026 reflects a market in transition rather than contraction. Supply
discipline, a rotation toward established assets, and resilient occupancy sit
alongside softer transaction volumes and intensifying rental competition.
The result is a more mature, selective market where fundamentals are
increasingly shaped by product quality and positioning rather than
broad-based growth.`
  },

  {
    chunk_id: 3,
    chunk_name: 'H1 2026 supply trends',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 2: H1 2026 SUPPLY TRENDS
[PERIOD: H1 2026] [CATEGORY: SUPPLY] [TIER: ALL]

SUMMARY: H1 2026 supply totals 10,885 listings. North Badung leads at 35%,
South Badung at 22%. Completed stock is 65% of supply, off-plan 35%.
Villas are 89% of supply, apartments 11%. Leasehold is 82% of inventory.

H1 2026 AVAILABLE PROPERTIES BY BEDROOM CATEGORY:
- 1 Bedroom: Villa 779, Apartment 1,011, Total 1,790
- 2 Bedroom: Villa 2,815, Apartment 127, Total 2,942
- 3 Bedroom: Villa 3,116, Apartment 34, Total 3,150
- 4 Bedroom: Villa 1,842, Apartment 0, Total 1,846
- 5 Bedroom: Villa 834, Apartment 0, Total 834
- 6 Bedroom+: Villa 321, Apartment 0, Total 321
- TOTAL ALL: 10,885 properties available for sale

H1 2026 SUPPLY BY DEVELOPMENT STATUS:
- Available (completed): 65% of total supply
- Off-plan: 35% of total supply
- Villa share of total supply: 89%
- Apartment share of total supply: 11%

H1 2026 DEVELOPMENT STATUS BY PROPERTY TYPE:
- Villas: 70% available (completed), 30% off-plan
- Apartments: 25% available (completed), 75% off-plan
Note: Apartment off-plan exposure at 75% creates significant forward
delivery and absorption risk.

H1 2026 SUPPLY BY REGION (MARKET SHARE):
- Central Badung: 6%
- Denpasar: 3%
- Gianyar: 10%
- Mengwi: 17%
- North Badung: 35% (largest region by supply)
- South Badung: 22%
- Tabanan: 7%`
  },

  {
    chunk_id: 4,
    chunk_name: 'H1 2026 sales trends',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 3: H1 2026 SALES TRENDS
[PERIOD: H1 2026] [CATEGORY: SALES] [TIER: ALL]

SUMMARY: H1 2026 total transaction volume was 4,220 sales, down 21%
year-on-year. The market is rotating toward larger, completed assets.
Two and three-bedroom villas now dominate at 58.3% of sales volume combined.
One-bedroom relative sales share fell 19% -- the sharpest decline of any
category. Median price rose 3.1% to $293k leasehold and $529k freehold,
driven by compositional mix change not value growth.

H1 2026 SALES VOLUME BY BEDROOM CATEGORY:
- 1 Bedroom: 15.5% of sales (relative share fell 19% year-on-year)
- 2 Bedroom: 31.8% of sales
- 3 Bedroom: 26.5% of sales
- 4 Bedroom: 16.6% of sales
- 5 Bedroom: 7.6% of sales
- 6 Bedroom+: 2% of sales
- 2 and 3 bedroom combined: 58.3% of all H1 2026 sales

H1 2026 SALES BY DEVELOPMENT STATUS AND PROPERTY TYPE:
- Available (completed) share of sales: 63% (up from 50% in 2025)
- Off-plan share of sales: 37% (down from 50% in 2025)
- Off-plan relative sales share fell 26% year-on-year
- Villa share of sales: 90% (up from 87% in 2025)
- Apartment share of sales: 10% (relative share fell 13% year-on-year)

H1 2026 SALES BY REGION:
- Central Badung: 5% of sales
- Denpasar: 5% of sales
- Gianyar: 7% of sales
- Mengwi: 18% of sales
- North Badung: 32% of sales (most active region; 1,340 total sales)
- South Badung: 26% of sales (relative share fell 20% year-on-year)
- Tabanan: 6% of sales

H1 2026 MEDIAN PRICE BY TENURE AND BEDROOM CATEGORY:
Freehold prices:
- 1 Bedroom Freehold: $208k (+2% year-on-year)
- 2 Bedroom Freehold: $326k (+9% year-on-year)
- 3 Bedroom Freehold: $455k (-4% year-on-year)
- 4 Bedroom Freehold: $857k (+2.6% year-on-year)
- 5 Bedroom Freehold: $1.351M (+16.9% year-on-year)
- 6 Bedroom+ Freehold: $1.727M (+20.2% year-on-year)
- Freehold Median (all): $529k (+4.7% year-on-year)

Leasehold prices:
- 1 Bedroom Leasehold: $168k (+5% year-on-year)
- 2 Bedroom Leasehold: $249k (+1.4% year-on-year)
- 3 Bedroom Leasehold: $356k (+2.9% year-on-year)
- 4 Bedroom Leasehold: $580k (+9.3% year-on-year)
- 5 Bedroom Leasehold: $869k (+9.3% year-on-year)
- 6 Bedroom+ Leasehold: $850k (+6.3% year-on-year)
- Leasehold Median (all): $293k (+4.4% year-on-year)

H1 2026 MEDIAN PRICE BY REGION AND BEDROOM:
Central Badung: 1bd $210k | 2bd $244k | 3bd $347k | 4bd $465k | 5bd $975k | 6bd $672k
Denpasar: 1bd $104k | 2bd $229k | 3bd $325k | 4bd $536k | 5bd $446k | 6bd $800k
Gianyar: 1bd $155k | 2bd $251k | 3bd $335k | 4bd $644k | 5bd $795k | 6bd $645k
Mengwi: 1bd $163k | 2bd $254k | 3bd $399k | 4bd $606k | 5bd $1.156M | 6bd $1.15M
North Badung: 1bd $150k | 2bd $250k | 3bd $362k | 4bd $565k | 5bd $810k | 6bd $838k
South Badung: 1bd $183k | 2bd $250k | 3bd $355k | 4bd $646k | 5bd $810k | 6bd $650k
Tabanan: 1bd $157k | 2bd $222k | 3bd $281k | 4bd $619k | 5bd $783k | 6bd $925k

H1 2026 TIME ON MARKET BY BEDROOM:
- 1 Bedroom: 242 days
- 2 Bedroom: 252 days
- 3 Bedroom: 253 days
- 4 Bedroom: 265 days
- 5 Bedroom: 286 days (longest)
- 6 Bedroom+: 279 days
- Market average: 256 days (+5.4% year-on-year)
- South Badung average: 220 days (shortest of all regions)`
  },

  {
    chunk_id: 5,
    chunk_name: 'H1 2026 property trends',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 4: H1 2026 PROPERTY TRENDS
[PERIOD: H1 2026] [CATEGORY: BUILT/PROPERTY] [TIER: ALL]

SUMMARY: H1 2026 marks a decisive reversal of the multi-year downsizing trend.
Average property size grew to 230 sqm market-wide, up from 201 sqm in 2025.
Price per sqm eased 5% to $1,975. Total new build area collapsed 78% to
85,000 sqm. Off-plan properties that are launching are being built larger
(average off-plan size up 22% year-on-year).

H1 2026 AVERAGE PROPERTY SIZE BY SEGMENT:
- Villa average: 241 sqm
- Apartment average: 74 sqm
- Off-plan average: 173 sqm
- Available (completed) average: 266 sqm
- Freehold average: 365 sqm
- Leasehold average: 213 sqm
- Market average: 230 sqm (up from 201 sqm in 2025)

H1 2026 AVERAGE PROPERTY SIZE BY BEDROOM AND REGION (sqm):
Central Badung: 1bd 67 | 2bd 139 | 3bd 234 | 4bd 349 | 5bd 508 | 6bd 436
Denpasar: 1bd 40 | 2bd 263 | 3bd 285 | 4bd 377 | 5bd 421 | 6bd 800
Gianyar: 1bd 71 | 2bd 147 | 3bd 238 | 4bd 424 | 5bd 572 | 6bd 395
Mengwi: 1bd 74 | 2bd 145 | 3bd 255 | 4bd 351 | 5bd 552 | 6bd 997
North Badung: 1bd 69 | 2bd 133 | 3bd 226 | 4bd 344 | 5bd 486 | 6bd 581
South Badung: 1bd 74 | 2bd 132 | 3bd 227 | 4bd 415 | 5bd 512 | 6bd 689
Tabanan: 1bd 62 | 2bd 137 | 3bd 213 | 4bd 461 | 5bd 505 | 6bd 533

H1 2026 AVERAGE PRICE PER SQM BY PROPERTY TYPE AND BEDROOM:
Villa: 1bd $2,358 | 2bd $1,915 | 3bd $1,763 | 4bd $1,933 | 5bd $2,183 | 6bd $2,029
Apartment: 1bd $3,063 | 2bd $2,292 | 3bd $1,712
Total: 1bd $2,500 | 2bd $1,921 | 3bd $1,762 | 4bd $1,933 | 5bd $2,169 | 6bd $2,029
Market average price per sqm: $1,975 (-5% year-on-year from $2,210 in 2025)
Apartment average price per sqm: $3,060 (-8% year-on-year from $3,400 in 2025)

H1 2026 AVERAGE PRICE PER SQM BY REGION AND BEDROOM:
Central Badung: 1bd $3,750 | 2bd $1,971 | 3bd $1,759 | 4bd $1,864 | 5bd $2,556 | 6bd $1,461
Denpasar: 1bd $3,450 | 2bd $1,765 | 3bd $1,666 | 4bd $1,823 | 5bd $1,634 | 6bd $1,402
Gianyar: 1bd $2,367 | 2bd $1,947 | 3bd $1,760 | 4bd $1,863 | 5bd $2,369 | 6bd $1,648
Mengwi: 1bd $2,302 | 2bd $1,947 | 3bd $1,725 | 4bd $2,010 | 5bd $2,282 | 6bd $2,150
North Badung: 1bd $2,534 | 2bd $1,910 | 3bd $1,850 | 4bd $1,900 | 5bd $2,126 | 6bd $2,029
South Badung: 1bd $2,500 | 2bd $1,964 | 3bd $1,805 | 4bd $2,170 | 5bd $2,759 | 6bd $1,801
Tabanan: 1bd $2,839 | 2bd $1,800 | 3bd $1,532 | 4bd $1,900 | 5bd $1,612 | 6bd $2,507

H1 2026 NEW BUILD SUMMARY:
- Total new build area: 85,000 sqm (-78% year-on-year from 160,000 sqm in 2025)
- Average off-plan property size: grew 22% year-on-year
- 1-3 bedroom properties account for 90% of all off-plan inventory`
  },

  {
    chunk_id: 6,
    chunk_name: 'H1 2026 rental trends',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 5: H1 2026 RENTAL TRENDS
[PERIOD: H1 2026] [CATEGORY: RENTAL] [TIER: ALL]

SUMMARY: H1 2026 rental supply grew 5% to 44,750 properties, countering
regulatory contraction fears. Occupancy rose a relative 10% to 52% market-wide.
However, the average daily rate fell 23% to $125 and total revenue declined 16%
to $544 million. The occupancy-revenue divergence is structural: operators are
filling properties more often but earning less per booking.

H1 2026 RENTAL SUPPLY BY REGION:
- Central Badung: 10% of rental supply
- Denpasar: 7% of rental supply
- Gianyar: 13% of rental supply
- Mengwi: 4% of rental supply
- North Badung: 45% of rental supply (primary short-stay hub)
- South Badung: 19% of rental supply
- Tabanan: 3% of rental supply
- Total rental properties: 44,750 (+5% year-on-year from 44,490 in 2025)

H1 2026 AVERAGE OCCUPANCY BY BEDROOM AND REGION:
Central Badung: 1bd 51% | 2bd 46% | 3bd 34% | 4bd 56% | 5bd 50% | 6bd 50%
Denpasar: 1bd 59% | 2bd 56% | 3bd 56% | 4bd 54% | 5bd 54% | 6bd 43%
Gianyar: 1bd 56% | 2bd 51% | 3bd 48% | 4bd 45% | 5bd 49% | 6bd 39%
Mengwi: 1bd 64% | 2bd 60% | 3bd 61% | 4bd 60% | 5bd 42% | 6bd 37%
North Badung: 1bd 61% | 2bd 57% | 3bd 56% | 4bd 56% | 5bd 48% | 6bd 45%
South Badung: 1bd 59% | 2bd 54% | 3bd 49% | 4bd 46% | 5bd 44% | 6bd 45%
Tabanan: 1bd 44% | 2bd 27% | 3bd 45% | 4bd 36% | 5bd 37% | 6bd 33%

H1 2026 OCCUPANCY SUMMARY:
- Market average occupancy: 52% (up 10% relative year-on-year from ~47% in H1 2025)
- 1 bedroom average occupancy: 57% (up 15% relative year-on-year; strongest performer)
- Mengwi: 60.5% average occupancy (largest gain by region)
- Denpasar: 56.9% average occupancy
- Central Badung: 46.1% average occupancy (declined; increased competition)

H1 2026 AVERAGE DAILY RATE BY BEDROOM AND REGION:
Central Badung: 1bd $52 | 2bd $85 | 3bd $155 | 4bd $266 | 5bd $390 | 6bd $843
Denpasar: 1bd $42 | 2bd $79 | 3bd $165 | 4bd $285 | 5bd $455 | 6bd $465
Gianyar: 1bd $40 | 2bd $74 | 3bd $129 | 4bd $163 | 5bd $228 | 6bd $391
Mengwi: 1bd $45 | 2bd $74 | 3bd $127 | 4bd $218 | 5bd $605 | 6bd $847
North Badung: 1bd $54 | 2bd $80 | 3bd $123 | 4bd $185 | 5bd $308 | 6bd $452
South Badung: 1bd $61 | 2bd $98 | 3bd $186 | 4bd $245 | 5bd $314 | 6bd $681
Tabanan: 1bd $47 | 2bd $79 | 3bd $162 | 4bd $215 | 5bd $368 | 6bd $631

H1 2026 RENTAL REVENUE SUMMARY:
- Market average daily rate: $125 (-23% year-on-year from $178 in 2025)
- Total H1 2026 rental revenue: $544 million (-16% year-on-year)
- Central Badung retains the highest ADR at $178 despite steep YoY decline
- Gianyar records the lowest ADRs across most categories`
  },

  {
    chunk_id: 7,
    chunk_name: '2025 to H1 2026 continuing themes and key shifts',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 6: 2025 TO H1 2026 -- CONTINUING THEMES AND KEY SHIFTS
[PERIOD: BRIDGE 2025-2026] [TIER: ALL]

SUMMARY: Several 2025 trends have continued into H1 2026 while others have
evolved or reversed. The key shift is the rotation away from compact off-plan
product. The occupancy-revenue divergence has deepened. Supply contraction
has accelerated. Pricing softening has partially reversed but for compositional
reasons only. Regulatory tightening remains a structural condition.

THEME 1 - SUPPLY CONTRACTION IS CONTINUING BUT THE MIX HAS CHANGED:
Off-plan inventory fell 9% in 2025, and total new build area declined 34%
year-on-year to 160,000 sqm. H1 2026 accelerates this further, with total
new build area falling 78% to 85,000 sqm. Crucially, off-plan property sizes
grew 22% year-on-year in H1 2026, indicating developers are moving away from
small speculative product toward larger, more considered builds.

THEME 2 - THE COMPACT ASSET STORY HAS EVOLVED FROM DOMINANCE TO ROTATION:
In 2025, 1-2 bedroom assets reached 53% of sales volume, up from under 35%
in 2023. H1 2026 introduces a reversal: one-bedroom relative sales share fell
19%, off-plan sales share fell 26%, and apartment share fell 13%. Two and
three-bedroom assets now account for 58.3% of sales. The compact asset wave
has plateaued and the market is rotating toward larger completed product.

THEME 3 - THE OCCUPANCY-REVENUE DIVERGENCE IS DEEPENING:
In 2025, occupancy improved approximately 2 percentage points while total
rental revenue fell 15%, as rate compression outweighed volume gains.
H1 2026 extends this pattern: occupancy rose a further relative 10% to 52%,
while revenue declined a further 16% to $544 million and the average daily
rate fell 23% to $125. This is a structural feature of the market, not a
short-term anomaly. Operators are managing for volume stability over rate
recovery.

THEME 4 - PRICING SOFTENING HAS PARTIALLY REVERSED BUT FOR COMPOSITIONAL REASONS:
The 2025 median price decline of 2% was driven by the growing weight of
compact, lower-value transactions. H1 2026 shows a 3.1% median price increase
-- but this is equally compositional, now driven by the rotation toward larger,
higher-value completed villas lifting the median. Average price per sqm has
softened further from the 2025 benchmark of $2,210 to $1,975 in H1 2026,
confirming that per-category values remain under mild pressure even as
headline medians improve.

THEME 5 - REGULATORY TIGHTENING REMAINS A STRUCTURAL MARKET CONDITION:
The 2025 shift toward a more scrutinised development and investment environment,
driven by enforcement of zoning (RDTR), building approvals (PBG), and
certificates of function (SLF), has continued into H1 2026. Compliance
requirements are a primary driver of buyer decision timelines and developer
feasibility assessments. Notably, rental supply has continued to grow despite
regulatory concerns, suggesting operators have adapted rather than exited.`
  },

  {
    chunk_id: 8,
    chunk_name: '2025 Bali real estate key insights',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 7: 2025 BALI REAL ESTATE KEY INSIGHTS
[PERIOD: 2025 FULL YEAR] [TIER: ALL]

SUMMARY: 2025 was a year of decisive recalibration following the 2022-2024
growth cycle. Supply and transaction volumes moderated. Compact assets (1-2
bedroom) reached 53% of sales volume. Rental occupancy held at 53% but revenue
fell 15% to $1.21 billion as daily rates compressed under supply pressure.
Total transactions fell 5% to just above 4,800. Median leasehold price fell
to $280k, reflecting compositional shift not value decline.

2025 HEADLINE FIGURES:
- Total property transactions: just above 4,800 (-5% year-on-year)
- Combined sales value: over $2 billion (-9% year-on-year)
- Median leasehold price: $280k (-5% over 36 months)
- Median freehold price: $505k (+10% over 36 months)
- Total market median price change: -2%
- 1 and 2 bedroom share of sales: 53% (up from under 35% in 2023)
- Market average occupancy: 53% (+2 percentage points year-on-year)
- Total rental supply: 44,490 (+107% over 36 months)
- Market average daily rate: $178 (-14% year-on-year)
- Total rental revenue: $1.21 billion (-15% year-on-year)
- Total new build area: 160,000 sqm (-34% year-on-year from 244,000 sqm in 2024)
- Market average price per sqm: $2,210 (+2% year-on-year)
- Market average property size: 201 sqm (-18% over 36 months)

KEY INSIGHT 1 - MEDIAN PRICES SOFTENED -2%:
Overall market values stayed stable but downward pressure from off-plan and
apartment sales nudged market prices slightly lower through the year. This
decline reflects compositional shift toward smaller format sales rather than
deterioration in asset value.

KEY INSIGHT 2 - COMPACT ASSETS NOW LEAD MARKET AT 53% OF SALES VOLUME:
1 and 2 bedroom assets reached 53% of sales volume in 2025, up 51% over 36
months from under 35% in 2023. This confirms the ascendancy of compact formats
as dominant market drivers, fundamentally reshaping the make-up of the market.

KEY INSIGHT 3 - RENTAL OCCUPANCY HELD AT 53%, UP 2 PERCENTAGE POINTS:
Rising rental occupancy, fuelled by stronger arrivals, reinforces the market's
core strength. Demand growth continued to underpin market stability despite
significant supply expansion.

KEY INSIGHT 4 - RENTAL COMPETITION INTENSIFIED WITH 12% GROWTH IN SUPPLY:
Increased rental supply sharpened competition, placing downward pressure on
rates and revenues as operators worked to secure occupancy.

KEY INSIGHT 5 - OVER 4,800 PROPERTY TRANSACTIONS IN 2025:
Total transactions fell just over 5% year-on-year as cautious buyer sentiment
set in and regulation tightened across the island.

KEY INSIGHT 6 - COMBINED SALES VALUE OVER $2 BILLION:
Combined sales value fell 9% year-on-year. While lower transaction volume
played a role, the main driver was increased buyer demand for smaller,
lower-value assets.

KEY INSIGHT 7 - NEW BUILD SQUM FELL 34% TO 160,000 SQM:
Well below the 244,000 sqm peak in 2024. The drop highlights a clear cooling
in development activity across the market.

KEY INSIGHT 8 - RENTAL REVENUE DECLINED TO $1.21 BILLION:
Despite a 2 percentage point rise in occupancy, total revenue fell 15% as
growing competition and shifting visitor preferences placed downward pressure
on rates.`
  },

  {
    chunk_id: 9,
    chunk_name: '2025 supply trends',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 8: 2025 SUPPLY TRENDS
[PERIOD: 2025 FULL YEAR] [CATEGORY: SUPPLY] [TIER: ALL]

SUMMARY: 2025 supply totalled over 12,300 listings (-7% year-on-year).
North Badung led at 34.9% but contracted 22%. South Badung grew to 22%
of listings (+13% year-on-year). Leasehold was 80.6% of supply. Off-plan
fell 9% to 3,230 units. Apartment share rose 44% to 13.8% of off-plan.

2025 AVAILABLE PROPERTIES BY BEDROOM CATEGORY:
- 1 Bedroom: Villa 875, Apartment 1,055, Total 1,930
- 2 Bedroom: Villa 3,278, Apartment 137, Total 3,415
- 3 Bedroom: Villa 3,595, Apartment 25, Total 3,620
- 4 Bedroom: Villa 2,140, Apartment 0, Total 2,140
- 5 Bedroom: Villa 985, Apartment 0, Total 985
- 6 Bedroom+: Villa 375, Apartment 0, Total 375
- Total: over 12,300 properties for sale (-7% year-on-year)
- 2 bedroom market share: 32% (+8% year-on-year)

2025 SUPPLY BY DEVELOPMENT STATUS:
- Available (completed): 67% of total supply
- Off-plan: 33% of total supply
- Villa share of total supply: 86%
- Apartment share of total supply: 14%

2025 DEVELOPMENT STATUS BY PROPERTY TYPE:
- Villas: 72% available (completed), 28% off-plan
- Apartments: 25% available (completed), 75% off-plan
- Total off-plan properties: over 3,230 (-9% year-on-year)
- Off-plan apartment share: 13.8% (+44% year-on-year)
- Off-plan villas: over 2,390 (-12% year-on-year)
- Off-plan apartments: over 800 (-55% year-on-year)

2025 SUPPLY BY REGION (MARKET SHARE):
- Central Badung: 7.1%
- Denpasar: 3.6%
- Gianyar: 8.8%
- Mengwi: 17.2%
- North Badung: 34.9% (over 4,290 properties; -22% year-on-year)
- South Badung: 21.6% (+13% year-on-year)
- Tabanan: 6.8%`
  },

  {
    chunk_id: 10,
    chunk_name: '2025 sales trends',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 9: 2025 SALES TRENDS
[PERIOD: 2025 FULL YEAR] [CATEGORY: SALES] [TIER: ALL]

SUMMARY: 2025 sales totalled over 4,800 transactions (-5% year-on-year).
Two-bedroom assets led at 31.9% of sales. Combined 1-2 bedroom share was 53%.
Median leasehold fell to $280k reflecting compositional shift, not value
decline. Freehold rose to $505k (+10% over 36 months).

2025 SALES VOLUME BY BEDROOM CATEGORY:
- 1 Bedroom: 20.8% of sales
- 2 Bedroom: 31.9% of sales
- 3 Bedroom: 26.4% of sales
- 4 Bedroom: 13.2% of sales
- 5 Bedroom: 6.2% of sales
- 6 Bedroom+: 1.5% of sales
- 1 and 2 bedroom combined: 53% of total sales volume

2025 MEDIAN PRICE BY BEDROOM CATEGORY (YEAR-ON-YEAR, FULL CALENDAR YEAR 2024 vs 2025):
- 1 Bedroom: 2024 $160k, 2025 $161k, change +0.6%
- 2 Bedroom: 2024 $246k, 2025 $246k, change 0%
- 3 Bedroom: 2024 $346k, 2025 $347k, change +0.3%
- 4 Bedroom: 2024 $506k, 2025 $530k, change +4.7%
- 5 Bedroom: 2024 $786k, 2025 $795k, change +1.1%
- 6 Bedroom+: 2024 $800k, 2025 $800k, change 0%
- Overall Market Median: 2024 $285k, 2025 $280k, change -2.1%
- Leasehold median: $280k (-5% over 36 months)
- Freehold median: $505k (+10% over 36 months)

2025 MEDIAN PRICE BY REGION (YEAR-ON-YEAR, FULL CALENDAR YEAR 2024 vs 2025):
- Central Badung: 2024 $295k, 2025 $289k, change -2%
- Denpasar: 2024 $328k, 2025 $320k, change -2.4%
- Gianyar: 2024 $298k, 2025 $290k, change -2.7%
- Mengwi: 2024 $305k, 2025 $295k, change -3.3%
- North Badung: 2024 $297k, 2025 $295k, change -0.7%
- South Badung: 2024 $247k, 2025 $247k, change 0%
- Tabanan: 2024 $276k, 2025 $259k, change -6.2%`
  },

  {
    chunk_id: 11,
    chunk_name: '2025 property trends',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 10: 2025 BUILT/PROPERTY TRENDS
[PERIOD: 2025 FULL YEAR] [CATEGORY: BUILT/PROPERTY] [TIER: ALL]

SUMMARY: Average property size stabilised at 201 sqm in 2025 (-18% over 36
months) as the downsizing trend reached equilibrium. Floor space ratio rose
to 83% (+3% year-on-year). New build area fell 34% to 160,000 sqm. Market
average price per sqm rose 2% to $2,210. Apartment average sqm price fell
1% to $3,400.

2025 AVERAGE PROPERTY SIZE BY BEDROOM:
- 1 Bedroom: 65 sqm
- 2 Bedroom: 140 sqm
- 3 Bedroom: 230 sqm
- 4 Bedroom: 352 sqm
- 5 Bedroom: 488 sqm
- 6 Bedroom+: 471 sqm
- Market average: 201 sqm (-18% over 36 months)
- Average villa size: 229 sqm (-3% year-on-year)
- Average floor space ratio: 83% (+3% year-on-year)
- Total new build area: 160,000 sqm (-34% year-on-year from 244,000 sqm in 2024)

2025 AVERAGE PROPERTY SIZE BY BEDROOM AND REGION (sqm):
Central Badung: 1bd 57 | 2bd 155 | 3bd 251 | 4bd 350 | 5bd 496 | 6bd 470
Denpasar: 1bd 48 | 2bd 160 | 3bd 219 | 4bd 393 | 5bd 406 | 6bd 517
Gianyar: 1bd 87 | 2bd 158 | 3bd 246 | 4bd 427 | 5bd 427 | 6bd 487
Mengwi: 1bd 76 | 2bd 148 | 3bd 248 | 4bd 333 | 5bd 514 | 6bd 628
North Badung: 1bd 65 | 2bd 145 | 3bd 229 | 4bd 348 | 5bd 481 | 6bd 575
South Badung: 1bd 62 | 2bd 137 | 3bd 213 | 4bd 388 | 5bd 477 | 6bd 563
Tabanan: 1bd 65 | 2bd 147 | 3bd 244 | 4bd 373 | 5bd 531 | 6bd 701

2025 AVERAGE PRICE PER SQM BY PROPERTY TYPE AND BEDROOM:
Villa: 1bd $2,530 | 2bd $1,940 | 3bd $1,770 | 4bd $1,875 | 5bd $2,090 | 6bd $2,005
Apartment: 1bd $3,505 | 2bd $2,580
Total: 1bd $3,077 | 2bd $1,972 | 3bd $1,742 | 4bd $1,839 | 5bd $1,990 | 6bd $1,976
Market average price per sqm 2025: $2,210 (+2% year-on-year)
Apartment average price per sqm 2025: $3,400 (-1% year-on-year)

2025 AVERAGE PRICE PER SQM BY REGION AND BEDROOM:
Central Badung: 1bd $3,950 | 2bd $1,990 | 3bd $1,565 | 4bd $1,605 | 5bd $1,745 | 6bd $1,695
Denpasar: 1bd $3,180 | 2bd $1,770 | 3bd $2,160 | 4bd $1,615 | 5bd $1,995 | 6bd $1,250
Gianyar: 1bd $2,290 | 2bd $1,910 | 3bd $1,685 | 4bd $1,915 | 5bd $2,400 | 6bd $1,940
Mengwi: 1bd $2,535 | 2bd $1,905 | 3bd $1,740 | 4bd $1,855 | 5bd $2,080 | 6bd $2,010
North Badung: 1bd $3,130 | 2bd $1,955 | 3bd $1,740 | 4bd $1,855 | 5bd $2,080 | 6bd $2,010
South Badung: 1bd $3,170 | 2bd $2,090 | 3bd $2,050 | 4bd $1,985 | 5bd $2,045 | 6bd $2,155
Tabanan: 1bd $2,745 | 2bd $1,785 | 3bd $1,520 | 4bd $1,640 | 5bd $1,800 | 6bd $1,980`
  },

  {
    chunk_id: 12,
    chunk_name: '2025 rental trends',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 11: 2025 RENTAL TRENDS
[PERIOD: 2025 FULL YEAR] [CATEGORY: RENTAL] [TIER: ALL]

SUMMARY: 2025 rental supply reached 44,490 properties (+107% over 36 months).
Market average occupancy held at 53% (+2 percentage points year-on-year).
Market average daily rate fell 14% to $178. Total rental revenue fell 15%
to $1.21 billion. North Badung held 46.9% of rental supply. South Badung
grew its revenue share 17% year-on-year to 18% of total market revenue.

2025 RENTAL SUPPLY BY REGION:
- Central Badung: 10.8%
- Denpasar: 6.2%
- Gianyar: 12.2%
- Mengwi: 4.1%
- North Badung: 46.9% (largest share)
- South Badung: 17%
- Tabanan: 2.7%
- Total: 44,490 rental properties (+107% over 36 months)

2025 AVERAGE OCCUPANCY BY BEDROOM AND REGION:
Central Badung: 1bd 50% | 2bd 51% | 3bd 56% | 4bd 55% | 5bd 56% | 6bd 57%
Denpasar: 1bd 61% | 2bd 64% | 3bd 61% | 4bd 60% | 5bd 65% | 6bd 60%
Gianyar: 1bd 59% | 2bd 61% | 3bd 59% | 4bd 59% | 5bd 60% | 6bd 60%
Mengwi: 1bd 61% | 2bd 62% | 3bd 58% | 4bd 55% | 5bd 45% | 6bd 45%
North Badung: 1bd 61% | 2bd 59% | 3bd 59% | 4bd 56% | 5bd 52% | 6bd 59%
South Badung: 1bd 57% | 2bd 62% | 3bd 54% | 4bd 51% | 5bd 51% | 6bd 50%
Tabanan: 1bd 41% | 2bd 52% | 3bd 45% | 4bd 43% | 5bd 46% | 6bd 34%
Market average occupancy 2025: 53% (+2 percentage points year-on-year)
1 bedroom occupancy South Badung 2025: 57% (+7 percentage points year-on-year)
3 bedroom average occupancy 2025: 55% (-8 percentage points year-on-year)

2025 AVERAGE DAILY RATE BY BEDROOM AND REGION:
Central Badung: 1bd $70 | 2bd $106 | 3bd $173 | 4bd $273 | 5bd $369 | 6bd $596
Denpasar: 1bd $63 | 2bd $118 | 3bd $208 | 4bd $352 | 5bd $503 | 6bd $563
Gianyar: 1bd $64 | 2bd $106 | 3bd $201 | 4bd $291 | 5bd $382 | 6bd $514
Mengwi: 1bd $78 | 2bd $105 | 3bd $169 | 4bd $285 | 5bd $655 | 6bd $944
North Badung: 1bd $87 | 2bd $117 | 3bd $195 | 4bd $329 | 5bd $485 | 6bd $752
South Badung: 1bd $103 | 2bd $154 | 3bd $254 | 4bd $411 | 5bd $619 | 6bd $779
Tabanan: 1bd $74 | 2bd $129 | 3bd $186 | 4bd $292 | 5bd $569 | 6bd $938
Market average daily rate 2025: $178 (-14% year-on-year)
Professionally managed property average daily rate 2025: $226 (-26% year-on-year)
Total rental revenue 2025: $1.21 billion (-15% year-on-year)
South Badung share of total revenue 2025: 18% (+17% year-on-year)`
  },

  {
    chunk_id: 13,
    chunk_name: 'Bali regulatory landscape 2025-2026',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 12: BALI REGULATORY LANDSCAPE
[CATEGORY: REGULATORY] [TIER: ALL]

SUMMARY: Bali is now a strictly regulated property market. All purchase-related
advice must reference zoning (RDTR), building approvals (PBG), and certificates
of function (SLF). Foreign individuals cannot hold direct freehold title.
The three main structures are Hak Pakai (right of use), HGB via PT PMA (right
to build), and Leasehold (contractual arrangement). Required documents include
land certificate, PBG, SLF, lease agreement, NIB, tourism licence, and OSS
registration.

REGULATORY OVERVIEW:
Property acquisition and development in Bali remains viable for foreign
investors, but it is no longer a lightly regulated environment. Over the past
two years, both the Provincial Government of Bali and central authorities have
materially increased enforcement around zoning compliance, building approvals,
and tourism licensing. The focus has shifted from structural permissibility to
operational compliance.

At a structural level, foreign participation must sit within Indonesia's
recognised land rights framework. Direct individual freehold ownership is not
available to foreign individuals. Investment therefore requires a properly
structured approach, whether through an individual right of use for residential
occupation, a foreign investment company for commercial development, or a
private lease arrangement supported by robust documentation.

The more significant compliance risk today sits in land use alignment and
licensing. Authorities are actively reviewing villas and small-scale hospitality
assets operating without correct zoning (RDTR), building approvals (PBG), or
tourism licences. Properties lacking a certificate of function (SLF) may face
restrictions on use. Short-term rental operations without a valid NIB and
sector licence are increasingly exposed to administrative sanctions.

For developers: feasibility must incorporate spatial planning (RDTR) verification
at the outset. Green zones and protected areas are under heightened scrutiny.

For investors purchasing existing assets: due diligence must extend beyond title
validity to include zoning designation, construction approvals (PBG), operational
permits, certificates of function (SLF), and corporate compliance.

OWNERSHIP STRUCTURE 1 - HAK PAKAI (RIGHT OF USE):
Hak Pakai is the primary title available to foreign individuals holding a valid
Indonesian residence permit (KITAS or KITAP). It grants a state-recognised,
time-bound right to use and occupy residential property. It does not provide
full ownership but offers a legally recognised tenure that may be extended.

OWNERSHIP STRUCTURE 2 - HGB VIA PT PMA (RIGHT TO BUILD):
Hak Guna Bangunan (HGB) allows the holder to construct and commercially utilise
buildings on land not held under freehold. Foreign individuals cannot hold HGB
directly and must establish a PT PMA. HGB is typically granted for 30 years,
extendable to approximately 80 years. Through a PT PMA, investors may develop
and operate villas, hospitality assets, and income-generating property.

OWNERSHIP STRUCTURE 3 - LEASEHOLD:
Leasehold is a private contractual arrangement between landowner and tenant.
It is not a state-recognised land title under Indonesian agrarian law. The lease
is granted for a fixed term and may be extended subject to contract terms.
Ownership of the land remains with the landowner at all times. Risk and
enforceability are determined by due diligence and documentation quality.

REQUIRED DOCUMENTS BEFORE BUYING:

1. LAND CERTIFICATE (HAK PAKAI OR HGB):
The land certificate must clearly reflect the correct title and be formally
registered with the Badan Pertanahan Nasional (BPN). This is the primary proof
of legal tenure confirming validity, duration, and classification of the land
right.

2. PBG AND SLF (BUILDING APPROVAL AND CERTIFICATE OF FUNCTION):
The PBG (Persetujuan Bangunan Gedung) confirms formal construction approval
under current regulations, replacing the former IMB system. The SLF (Sertifikat
Laik Fungsi) certifies the completed building is fit for use and compliant with
safety and zoning requirements. Together these confirm legal construction and
lawful occupancy.

3. LEASE AGREEMENT (LEASEHOLD ONLY):
For leasehold acquisitions, a formal Lease Agreement must be executed before a
Notary or Land Deed Official (PPAT). Must clearly define: lease duration,
extension rights, transfer provisions, and renovation and structural permissions.

4. NIB AND TOURISM BUSINESS LICENCE:
If the villa is to be operated as short-term or long-term rental accommodation,
a Business Identification Number (NIB) and relevant tourism operational licence
are required. Without these, rental activity may be classified as non-compliant.

5. OSS REGISTRATION (ONLINE SINGLE SUBMISSION):
All business licensing including NIB issuance and sector approvals is processed
through Indonesia's Online Single Submission (OSS) system. OSS registration
forms the legal foundation for operating accommodation businesses.

KEY REGULATORY TERMS:
- RDTR: Spatial planning and zoning designation
- PBG (Persetujuan Bangunan Gedung): Building approval, replacing former IMB
- SLF (Sertifikat Laik Fungsi): Certificate confirming building is fit for use
- NIB (Nomor Induk Berusaha): Business Identification Number for rental operations
- OSS: Online Single Submission system for all business licensing`
  },

  {
    chunk_id: 14,
    chunk_name: 'Neighbourhood classification -- REID regions and market tiers',
    tier: 'all',
    always_prepend: false,
    content: `SECTION 13: NEIGHBOURHOOD CLASSIFICATION
[CATEGORY: REFERENCE] [TIER: ALL]

IMPORTANT: Do not add or remove neighbourhoods without updating both the RAG
and the AI system prompts. Format per entry: REID Neighbourhood | REID Region
| Market Classification | Official Regency/Area

DATA ROUTING NOTE: This table identifies which region a neighbourhood belongs
to and its market classification. It does not contain market data. When a paid
user (Pro or Enterprise) asks about a specific neighbourhood listed here, route
the query to the live CSV data source for prices, supply, sales, and rental
figures. Use this table only to confirm region mapping and classification tier.

DENPASAR REGION:
SANUR | Denpasar | Key Market | Denpasar
OTHER DENPASAR | Denpasar | Other | Denpasar
DENPASAR | Denpasar | Other | Denpasar

SOUTH BADUNG REGION:
BINGIN | South Badung | Key Market | Badung
ULUWATU | South Badung | Key Market | Badung
BALANGAN | South Badung | Emerging Market | Badung
JIMBARAN | South Badung | Other | Badung
NUSA DUA | South Badung | Other | Badung
UNGASAN | South Badung | Other | Badung
MELASTI | South Badung | Other | Badung
BENOA | South Badung | Other | Badung
PADANG PADANG | South Badung | Other | Badung
KUTUH | South Badung | Other | Badung
NYANG NYANG | South Badung | Other | Badung
PECATU | South Badung | Other | Badung
PANDAWA | South Badung | Other | Badung

CENTRAL BADUNG REGION:
SEMINYAK | Central Badung | Key Market | Badung
KUTA | Central Badung | Other | Badung
LEGIAN | Central Badung | Other | Badung

NORTH BADUNG REGION:
BERAWA | North Badung | Key Market | Badung
CANGGU | North Badung | Key Market | Badung
UMALAS | North Badung | Key Market | Badung
PADONAN | North Badung | Emerging Market | Badung
BABAKAN | North Badung | Other | Badung
KEROBOKAN | North Badung | Other | Badung
BUMBAK | North Badung | Other | Badung
OTHER NORTH BADUNG | North Badung | Other | Badung
OTHER BADUNG | North Badung | Other | Badung

MENGWI REGION:
PERERENAN | Mengwi | Key Market | Badung
SESEH | Mengwi | Emerging Market | Badung
BUDUK | Mengwi | Other | Badung
CEMAGI | Mengwi | Other | Badung
MUNGGU | Mengwi | Other | Badung
TUMBAK BAYUH | Mengwi | Other | Badung
OTHER MENGWI | Mengwi | Other | Badung

GIANYAR REGION:
UBUD | Gianyar | Key Market | Gianyar
PEJENG | Gianyar | Other | Gianyar
SABA | Gianyar | Other | Gianyar
KERAMAS | Gianyar | Other | Gianyar
TEGALALANG | Gianyar | Other | Gianyar
PAYANGAN | Gianyar | Other | Gianyar
SUKAWATI | Gianyar | Other | Gianyar
OTHER GIANYAR | Gianyar | Other | Gianyar

TABANAN REGION:
KABA KABA | Tabanan | Emerging Market | Tabanan
NYANYI | Tabanan | Emerging Market | Tabanan
BUWIT | Tabanan | Other | Tabanan
CEPAKA | Tabanan | Other | Tabanan
BALIAN | Tabanan | Other | Tabanan
BEDUGUL | Tabanan | Other | Tabanan
KEDIRI | Tabanan | Other | Tabanan
KEDUNGU | Tabanan | Other | Tabanan
BERABAN | Tabanan | Other | Tabanan
TANAH LOT | Tabanan | Other | Tabanan
OTHER TABANAN | Tabanan | Other | Tabanan

OTHER BALI REGIONS:
SINGARAJA | Other | Other | Buleleng
LOVINA BEACH | Other | Other | Buleleng
LOVINA | Other | Other | Buleleng
MUNDUK | Other | Other | Buleleng
OTHER NORTH BALI | Other | Other | Buleleng
CANDIDASA | Other | Other | Karangasem
AMED | Other | Other | Karangasem
KARANGASEM | Other | Other | Karangasem
SIDEMAN | Other | Other | Karangasem
OTHER EAST BALI | Other | Other | Karangasem
KINTAMANI | Other | Other | Bangli
MEDEWI | Other | Other | Jembrana
NUSA PENIDA | Other | Other | Klungkung
NUSA LEMBONGAN | Other | Other | Klungkung
OTHER | Other | Other | Various
OTHER WEST BALI | Other | Other | Jembrana / Tabanan
OTHER SOUTH EAST BALI AND SURROUNDING ISLANDS | Other | Other | Various

NON BALI:
GILI ISLANDS | Non Bali | Non Bali | NTB / Lombok
JAVA | Non Bali | Non Bali | Java
ROTE ISLAND | Non Bali | Non Bali | NTT
MENTAWAI | Non Bali | Non Bali | West Sumatra
SUMBA | Non Bali | Non Bali | NTT
SUMBAWA | Non Bali | Non Bali | NTB
LOMBOK | Non Bali | Non Bali | NTB
LABUAN BAJO | Non Bali | Non Bali | NTT
SUMATRA | Non Bali | Non Bali | Sumatra
YOGYAKARTA | Non Bali | Non Bali | DIY
BEKASI | Non Bali | Non Bali | West Java
SURABAYA | Non Bali | Non Bali | East Java
KALIMANTAN | Non Bali | Non Bali | Kalimantan
JAKARTA | Non Bali | Non Bali | DKI Jakarta
BANDUNG | Non Bali | Non Bali | West Java
OTHER INDONESIAN ISLANDS | Non Bali | Non Bali | Various`
  }
];

// ============================================================
// EMBED A SINGLE TEXT VIA GEMINI
// ============================================================
async function getEmbedding(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
        outputDimensionality: 768
      })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini embedding failed: ${err}`);
  }
  const data = await res.json();
  return data.embedding.values; // float array of length 768
}

// ============================================================
// MAIN - clear existing chunks, embed all new chunks, upsert
// ============================================================
async function main() {
  // Remove all existing chunks so stale data does not persist
  console.log('Clearing existing chunks from Supabase...');
  const { error: deleteError } = await supabase
    .from('rag_chunks')
    .delete()
    .neq('chunk_id', 0); // chunk_id is always > 0; this deletes all rows
  if (deleteError) {
    console.error(`Failed to clear existing chunks: ${deleteError.message}`);
    process.exit(1);
  }
  console.log(`Cleared. Uploading ${CHUNKS.length} chunks...\n`);

  for (const chunk of CHUNKS) {
    process.stdout.write(`Chunk ${chunk.chunk_id.toString().padStart(2, '0')} / ${CHUNKS.length} - ${chunk.chunk_name}... `);

    try {
      const embedding = await getEmbedding(chunk.content);

      const { error } = await supabase
        .from('rag_chunks')
        .upsert({
          chunk_id:       chunk.chunk_id,
          chunk_name:     chunk.chunk_name,
          tier:           chunk.tier,
          always_prepend: chunk.always_prepend,
          content:        chunk.content,
          embedding:      embedding
        }, { onConflict: 'chunk_id' });

      if (error) throw error;

      console.log('done');

      // Small delay to avoid hitting Gemini rate limits
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.error(`FAILED - ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\nAll ${CHUNKS.length} chunks uploaded successfully.`);
}

main();
