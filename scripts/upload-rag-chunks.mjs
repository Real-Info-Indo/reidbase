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
// 20 CHUNKS -- Updated Q3 2026 (source: REID_RAG_Consolidated_Intelligence_Document_Q3_2026)
// tier: 'all' = all access tiers
// ============================================================
const CHUNKS = [
  {
    chunk_id: 1,
    chunk_name: 'Document header, directives and reconciliation rules',
    tier: 'all',
    always_prepend: true,
    content: `REID RAG - CONSOLIDATED INTELLIGENCE DOCUMENT
Updated: Q3 2026 (trailing 12 months to September 2026, published November 2026)
Source: realinfo.id

PRIORITY PERIOD: Q3 2026 is the current market. Always default to Q3 2026 figures when answering questions about the current market. Use H1 2026, Q1 2026 and 2025 as reference periods only, and label them by period.

DOCUMENT HEADER

Document Title: REID RAG - Consolidated Intelligence Document - Q3 2026

Document Purpose: Narrative-driven market intelligence for the Bali real estate market. The latest period is Q3 2026 (published November 2026). Earlier periods (H1 2026, Q1 2026, 2025) are kept below as reference and must be labelled by period when cited.

Core Strategic Anchors (Q3 2026):

- Market Narrative: Q3 2026 is a phase of Consolidation, not contraction. Volumes and launches have fallen sharply while underlying values are holding and edging higher.
- Asset Shift: Buyers have rotated to larger, completed villas. Completed stock is 66% of sales, villas 95%, four plus bedroom homes 28%. One bedroom sales fell 57% and apartment sales 78%.
- Price Interpretation: Lead with the like for like median, which rose 4.0%, the first clear gain of 2026 (Q1 +0.4%, H1 +1.0%). The headline median (+13.7%) is skewed upward because more large, completed villas sold.
- Supply: New listings fell 69% to 2,374. Developers have paused, especially off plan and apartments.
- Rental Engine: Occupancy is rising (52.4%) but daily rates fell 24%, steepest where rental supply grew fastest (supply to rate correlation -0.69).
- Market Engine: North Badung remains the largest region for listings (35%), sales (31%) and rental stock (43%).
- Price Growth Corridor: North Badung, Mengwi and South Badung recorded the clearest like for like median price growth.

Analytic Directives:

- Period Rule: Always state which period a figure belongs to (Q3 2026, H1 2026, Q1 2026 or 2025). Default to Q3 2026 for questions about the current market.
- Price Logic: Lead with the like for like median change to describe price growth. Then give the headline median change, noting that it is skewed by changes in what sold. Headline medians are best used to describe price levels.
- Yield Logic: Rental income is under rate pressure, not occupancy pressure. Test investment returns against current nightly rates, not 2024 or 2025 rates.
- Regulatory Rigor: Bali is a strictly regulated environment. When a user explicitly asks about ownership, purchasing, construction, permits, or licensing compliance, responses must emphasise zoning (RDTR), building approvals (PBG), and certificates of function (SLF).
- Regional Specificity: RAG content in this document covers Bali-wide and regional data only. It does not contain neighbourhood-level data (e.g. Pererenan, Canggu, Berawa). For paid users asking about a specific neighbourhood, use the live CSV data source, not RAG.

Operational Data Rules:

- All financial data is in USD.
- All measurements are in square metres (SQM).
- Leasehold represents about 80% of available supply and 86% of Q3 2026 sales. Always qualify responses with leasehold context.
- Leasehold and Freehold are structurally distinct. Never compare them as like for like.
- Regulatory responses must reference zoning (RDTR), building approvals (PBG), and certificates of function (SLF).
- Regions covered: Central Badung, Denpasar, Gianyar, Mengwi, North Badung, South Badung, Tabanan. Other and Non Bali areas are excluded from market statistics.

Q3 2026 Data Definitions:

- Sales, prices, sizes and price per sqm: trailing 12 months, October 2025 to September 2026, compared with October 2024 to September 2025.
- Available supply: snapshot at 30 September 2026, compared with 30 September 2025.
- New supply: properties first listed in the trailing 12 months.
- Like for like median price change: REID's mix-adjusted measure of price growth. It compares similar properties (same contract type, property type, bedroom count and region) so shifts in what sold are removed. It is calculated with a statistical model, not as a simple median.
- Time on market: excludes listings on market more than two years.
- Rental data: individually managed properties only. Rental supply growth is September 2026 vs September 2025.
- Gross yield: annual rental income (average daily rate x occupancy x 365) divided by the median leasehold villa sale price, by region and bedroom.
- Daily rate levels are not comparable between report editions because the calculation basis changed. Use year on year changes when comparing periods.

Scope:

- Macro summaries: All tiers

DATA RECONCILIATION AND CALCULATION RULES

Published REID report figures in this document take precedence over any figure calculated from the underlying property or rental CSV files. When a user asks for a figure this document already gives, quote this document and name the period.

Rule 1: Source priority

1. Q3 2026 published figures (this document, Q3 2026 sections) for any question about the current market.
2. Earlier published figures (H1 2026, Q1 2026, 2025 reference sections) only when the user asks about that period.
3. Calculations from the CSV files only for questions this document cannot answer (for example a specific neighbourhood, bedroom and contract combination). Label these "REID data calculation" and apply Rules 3 to 5.

Rule 2: H1 2026 figures exist on two bases

The H1 2026 reference section uses figures as published in July 2026. The 2026 trajectory table recalculates H1 on the Q3 2026 method so periods compare. When asked about H1 2026 on its own, quote the published figure. When comparing H1 with Q3, use the trajectory table.

The table comparing published and recalculated H1 2026 figures is in the 2026 trajectory chunk.

Rule 3: Measures that are not comparable between periods

- Average daily rate level: $178 (2025), $125 (H1 2026) and $151 (Q3 2026) use different calculation bases. Never compare these levels. Use year on year change within a period: 2025 -14%, H1 2026 -23%, Q3 2026 -24%.
- Total rental revenue: $1.21B (2025 full year), $544M (H1 2026 as published) and $1.26B (Q3 2026, trailing 12 months) do not cover the same length of period. Use year on year change only.
- Like for like median vs headline median: Q3 2026 leads with the like for like median (+4.0%); H1 2026 and earlier published the headline median change (H1 +3.1%). Do not compare a like for like median with a headline median.
- Time on market: Q3 2026 excludes listings on market more than two years; the published H1 figure did not.

Rule 4: How Q3 2026 figures are calculated (for CSV calculations)

- Regions: include Central Badung, Denpasar, Gianyar, Mengwi, North Badung, South Badung, Tabanan only. Exclude Other and Non Bali.
- Property columns: use the Availability column for status (Available or Sold). Ignore the Duplicate and Site Status columns. Treat "VIlla" as "Villa".
- Periods: sales, prices, sizes and price per sqm use sold date in the trailing 12 months (October 2025 to September 2026 vs October 2024 to September 2025). Available supply = first listed on or before 30 September 2026 and not sold by then. New supply = first listed in the window.
- Outliers: exclude from price and size statistics any record with price under $20,000 or over $20 million, build size missing or outside 20 to 3,000 sqm, price per sqm outside $250 to $12,000, or under 15 sqm per bedroom. About 1,200 property records are flagged, mostly for missing build size.
- Time on market: average of Days listed for sold records, excluding values over 730 days.
- Rental data: individually managed properties only; exclude Other.
- Occupancy: simple average of monthly occupancy rows (Q3 2026 = 52.4%). Do not weight by listing count; a count weighted average gives about 60% and is not the published figure.
- Average daily rate: weighted by listing count (Q3 2026 = $151).
- Revenue per property: average daily rate x occupancy x 365 (Q3 2026 = about $28,900, -19%). Do not use the TOTAL_USD revenue field for per property figures; it implies 25 to 28 booked nights a month and has a break in the Mengwi series. TOTAL_USD is used only for total market revenue ($1.26B).
- Rental supply growth: listing count in September 2026 vs September 2025 (+1.7%). The 12 month average supply (44,903, +6.3%) is a different measure.
- Gross yield: average daily rate x occupancy x 365, divided by the median leasehold villa sale price for the same region and bedroom count, using only combinations with at least 10 sales.

Rule 5: Data caveats to state when relevant

- Like for like medians cannot be reproduced from simple medians. They come from a statistical model that controls for contract type, property type, bedroom count and region. Never present a headline median change as a like for like median change.
- Small samples: freehold bedroom categories (21 to 169 sales) and region by bedroom cells with fewer than 20 sales carry wide margins of error; say so when quoting them.
- Reversed trends: Q1 2026 and 2025 described compact assets dominating demand. From H1 2026 onward buyers rotated to larger completed villas. Always give the latest direction when asked about current trends.`,
  },
  {
    chunk_id: 2,
    chunk_name: 'Q3 2026 key insights (1 to 7): supply, sales, pricing, time on market, off plan',
    tier: 'all',
    content: `REID RAG | Q3 2026 key insights, part 1 of 2

Q3 2026 BALI REAL ESTATE KEY INSIGHTS

Q3 2026 (trailing 12 months to September 2026) extends the transition identified in H1 2026: Bali's market is consolidating rather than contracting. Development activity and transaction volumes have pulled back sharply, yet underlying values are holding and, for the first time in 2026, edging higher. The result is a smaller, more selective market shaped by product quality, completion status and location rather than broad based growth.

1. Q3 2026: New supply fell 69% as developers paused launches

Only 2,374 new properties entered the market in the 12 months to September 2026, down 69% from 7,618. Available stock fell 11% to 11,177 listings, but held almost flat through Q3 2026 (11,215 in June to 11,177 in September). The pullback is sharpest at the speculative end: off plan made up 15% of new supply (from 37% a year earlier) and apartments 2.2% (from 9.5%). New supply fell between 52% and 72% in every region, so this reflects island wide sentiment rather than local oversupply.

2. Q3 2026: The off plan pipeline is clearing for villas but not for apartments

Off plan's share of available stock fell from 29% to 24%. Only 19% of available villas are off plan (from 24%), while 70% of available apartments are still off plan. One to three bedroom homes make up 89% of off plan stock. Apartments carry the most delivery risk because most unsold units depend on projects completing.

3. Q3 2026: Sales volume fell 33%, a decline that deepened each period of 2026

Transaction volume fell 33% to 3,739 sales over the trailing 12 months, after -15% at Q1 2026 and -21% at H1 2026. North Badung led with 31% of sales, South Badung 25% and Mengwi 19%. South Badung's volume halved and its share fell from 34% to 25%. Denpasar was the only region to grow volume (+47%, from a small base).

4. Q3 2026: Buyers rotated decisively to larger, completed villas

Completed stock rose to 66% of sales (from 53%), villas to 95% (from 84%), and four plus bedroom homes to 28%. Off plan sales fell 51% and apartment sales fell 78%. One bedroom sales fell 57%, and one bedroom share of sales slipped from 15.8% at Q1 2026 to 15.0% at H1 2026 and 14.5% at Q3 2026. Buyer hesitation on compact units reflects two years of heavy supply in that segment, weaker investor sentiment, short term rental licensing uncertainty and falling nightly rates.

5. Q3 2026: The like for like median rose 4.0%, the first clear gain this year

The like for like median rose 4.0% (range 2% to 6%), after flat readings at Q1 2026 (+0.4%) and H1 2026 (+1.0%). On a like for like median basis, freehold rose 9.1% and leasehold 3.2%. The headline median rose 13.7% to $330k (freehold $667k, leasehold $300k), but this is skewed upward because more large, completed villas sold. Like for like median growth was clearest in North Badung (+7.5%), Mengwi (+4.8%) and South Badung (+4.4%); Central Badung, Denpasar, Gianyar and Tabanan were flat to softer.

6. Q3 2026: Selling times lengthened to almost a year

Average time on market rose 37% to 341 days, and 46% of sales took more than a year. Time on market lengthened each period: 280 days at Q1 2026, 314 at H1 2026 and 341 at Q3 2026. South Badung sold fastest (321 days) and Central Badung slowest (363 days). At the past year's sales pace, current stock would take 36 months to clear (from 27); apartments 72 months.

7. Q3 2026: Off plan villas have lost their price premium

Off plan villas now sell 2% below completed villas per sqm, from a 2% premium a year earlier, and take around 60 days longer to sell. Buyers want to see the finished product, and often its rental track record, before committing. Developers who rely on off plan pre sales to fund construction will find funding harder.`,
  },
  {
    chunk_id: 3,
    chunk_name: 'Q3 2026 key insights (8 to 14): price per sqm, size, rental, yields, outlook',
    tier: 'all',
    content: `REID RAG | Q3 2026 key insights, part 2 of 2

8. Q3 2026: Price per sqm fell on average but rose like for like

Average price per sqm eased 4.8% to $2,164, but rose 2.4% like for like; villas rose 3.2%. The average fell because fewer apartments and one bedroom units sold, and those carry the highest per sqm prices. One bedroom stock is the only category with a clear like for like fall (-6.3%). South Badung is the most expensive region at $2,320 per sqm.

9. Q3 2026: The market is selling larger homes, not building bigger ones

Average size of sold properties rose 12.2% to 244 sqm, but two to five bedroom sizes were within 1.5% of last year. Off plan size grew 24% to 183 sqm and total new building area fell 88% to about 55,000 sqm. Developers still launching appear to target families and owner occupiers rather than compact investor units.

10. Q3 2026: Rental supply growth slowed but did not reverse under licensing enforcement

Rental supply reached 47,567 in September 2026 (+1.7% year on year), slowing from +14% at Q1 2026 and +5% at H1 2026. The Ministry of Tourism's March 2026 licensing deadline did not produce a sharp fall; enforcement has favoured registration over removal, and automated platform verification is not due until 2027. Growth moved south and west: Mengwi (+27%) and South Badung (+24%) added stock while North Badung (-7%) and Central Badung (-14%) shrank.

11. Q3 2026: Occupancy rose but daily rates fell 24%

Average occupancy rose to 52.4% (+2.8 points) and has improved each period of 2026. The average daily rate fell 24% to $151 and total rental revenue fell 17% to $1.26B. Revenue per property fell 19% to about $28,900 a year (villas $34,840, -21%). One bedroom units filled best (57.4%); five and six plus bedroom occupancy fell.

12. Q3 2026: Rates fell most where rental supply grew fastest

Across regions, rental supply growth and daily rate change have a correlation of -0.69. Mengwi (+27% supply) cut rates 32% and South Badung (+24%) 25%, while Central Badung (-14% supply) held rates best (-9%). Owners in competitive areas are trading rate for occupancy. North Badung's stock was broadly flat yet rates fell 25%, so competition is wider than local.

13. Q3 2026: Gross yields compressed from 12.5% to 10.2%

Indicative leasehold villa gross yields fell 2.3 points to 10.2% because purchase prices held while nightly rates fell. Large villas took the biggest hit: six plus bedroom yields fell from 16.8% to 10.8% and five bedroom from 13.1% to 10.2%. Central Badung has the highest average yield at 12.5%.

14. Q3 2026 outlook: A consolidating market favours buyers and rate-tested investment cases

Long selling times and steady pricing leave buyers room to negotiate, particularly outside Denpasar, Mengwi and South Badung. Fewer launches now mean less competing stock in 12 to 24 months, which could support completed villa prices once inventory clears. Licensing remains the main swing factor for rental supply in 2027.`,
  },
  {
    chunk_id: 4,
    chunk_name: 'Q3 2026 supply data',
    tier: 'all',
    content: `REID RAG | Q3 2026 market data: supply (trailing 12 months to September 2026; available supply at 30 September 2026)

Q3 2026 SUPPLY TRENDS

Q3 2026 headline supply figures: 11,177 available properties (-11% YoY); 2,374 new properties in 12 months (-69% YoY); leasehold 80% of available supply; off plan 24% of available supply (from 29%); apartments 2.2% of new supply (from 9.5%); 87% of available stock first listed more than a year ago.

Table showing Q3 2026 available properties by bedroom category and property type:

Q3 2026 AVAILABLE PROPERTIES (count) / TYPE   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
VILLA                                         798     2,849   3,108   1,843   817     592
APARTMENT                                     1,010   123     31      5       0       1
TOTAL Q3 2026                                 1,808   2,972   3,139   1,848   817     593
YoY change                                    -11%    -13%    -10%    -11%    -12%    -6%

Table showing Q3 2026 available supply by development status and property type:

AVAILABLE SUPPLY SHARE (%)   COMPLETED   OFF PLAN
DEVELOPMENT STATUS Q3 2026   76%         24%
DEVELOPMENT STATUS Q3 2025   71%         29%
                             VILLA       APARTMENT
PROPERTY TYPE Q3 2026        90%         10%

Table showing Q3 2026 development status by property type:

Q3 2026 STATUS SHARE (%) / TYPE   COMPLETED   OFF PLAN
VILLAS                            81%         19%
APARTMENTS                        30%         70%

Table showing Q3 2026 available supply share by region:

Q3 2026 SUPPLY SHARE (%) / REGION   CENTRAL BADUNG   DENPASAR   GIANYAR   MENGWI   NORTH BADUNG   SOUTH BADUNG   TABANAN
AVAILABLE SUPPLY SHARE              7%               3%         9%        16%      35%            22%            7%
NEW SUPPLY SHARE                    5%               5%         9%        16%      31%            28%            6%

Q3 2026 supply by region notes: available stock fell in every region; Denpasar (-17.6%) and Mengwi (-16.7%) fell most, Gianyar least (-5.3%). New supply fell 52% to 72% in every region, with Mengwi the sharpest (-72%). One bedroom launches fell 75% and six plus bedroom launches 61%.

Table showing Q3 2026 months of inventory by region and bedroom (available stock divided by average monthly sales):

Q3 2026 MONTHS OF INVENTORY (months) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +   ALL
CENTRAL BADUNG                                  36      44      64      51      60      102       52
DENPASAR                                        70      16      18      32      18      20        21
GIANYAR                                         39      51      56      43      29      39        46
MENGWI                                          26      25      36      27      41      52        30
NORTH BADUNG                                    47      38      41      39      33      56        40
SOUTH BADUNG                                    41      24      27      32      37      52        31
TABANAN                                         59      29      40      54      42      39        40
MARKET                                          40      31      37      36      36      50        36

Q3 2026 months of inventory: market 36 (from 27); villas 34; apartments 72; completed stock 41; off plan stock 25.`,
  },
  {
    chunk_id: 5,
    chunk_name: 'Q3 2026 sales and pricing data',
    tier: 'all',
    content: `REID RAG | Q3 2026 market data: sales, like for like median and median prices, time on market

Q3 2026 SALES TRENDS

Q3 2026 headline sales figures: 3,739 sales in 12 months (-33% YoY); like for like median +4.0%; headline median $330k (+13.7%, skewed by mix); leasehold 86% of sales; completed 66% of sales; villas 95% of sales; off plan sales -51%; apartment sales -78%.

Table showing Q3 2026 sales volume share by bedroom category:

Q3 2026 SALES / BEDROOMS   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
SALES SHARE Q3 2026        14.5%   30.7%   27.3%   16.4%   7.3%    3.8%
SALES VOLUME YoY           -57%    -30%    -30%    -19%    -23%    -14%

Table showing Q3 2026 sales volume share by region:

Q3 2026 SALES / REGION   CENTRAL BADUNG   DENPASAR   GIANYAR   MENGWI   NORTH BADUNG   SOUTH BADUNG   TABANAN
SALES SHARE              5%               5%         7%        19%      31%            25%            6%

Table showing Q3 2026 sales by development status and property type:

SALES SHARE BY STATUS AND TYPE (%)   COMPLETED   OFF PLAN   VILLA   APARTMENT
Q3 2026                              66%         34%        95%     5%
Q3 2025                              53%         47%        84%     16%

Table showing Q3 2026 median price and like for like median YoY change by ownership type and bedroom:

Q3 2026 PRICE (USD) AND LIKE FOR LIKE MEDIAN CHANGE / OWNERSHIP   1 BED    2 BED    3 BED   4 BED   5 BED    6 BED    MEDIAN
Freehold median Q3 2026                                           $215k    $329k    $447k   $985k   $1.38M   $1.82M   $667k
Freehold like for like median change                              +10.4%   +14.6%   -1.0%   +8.0%   +20.4%   +15.9%   +9.1%
Leasehold median Q3 2026                                          $170k    $250k    $368k   $610k   $845k    $925k    $300k
Leasehold like for like median change                             -0.3%    +4.0%    +6.2%   +2.4%   +1.2%    -4.1%    +3.2%

Q3 2026 freehold median price note: freehold bedroom categories are based on small samples (21 to 169 sales), so their changes carry wide margins of error.

Table showing Q3 2026 median price by region and bedroom:

Q3 2026 MEDIAN SALE PRICE (USD) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED    6 BED +
CENTRAL BADUNG                             $196k   $245k   $352k   $465k   $1.10M   $813k
DENPASAR                                   $104k   $223k   $320k   $536k   $708k    $1.41M
GIANYAR                                    $169k   $259k   $376k   $700k   $657k    $850k
MENGWI                                     $162k   $255k   $450k   $653k   $1.10M   $1.52M
NORTH BADUNG                               $160k   $260k   $381k   $613k   $852k    $1.50M
SOUTH BADUNG                               $183k   $255k   $378k   $857k   $1.25M   $1.53M
TABANAN                                    $153k   $232k   $306k   $722k   $990k    $986k

Q3 2026 like for like median price change by region: North Badung +7.5%, Mengwi +4.8%, South Badung +4.4%; Central Badung, Denpasar, Gianyar and Tabanan within the margin of error. South Badung has the lowest overall median ($283k) because 58% of its sales are one and two bedroom.

Table showing Q3 2026 average time on market by bedroom (excludes listings over two years):

Q3 2026 TIME ON MARKET   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +   MARKET
DAYS Q3 2026             333     339     342     348     365     310       341

Q3 2026 time on market by region: South Badung 321 days (fastest), Central Badung 363 days (slowest, from 278), Mengwi 361. Share of sales taking more than a year: 46% (from 23%). Off plan villas 380 days vs completed villas 317 days.`,
  },
  {
    chunk_id: 6,
    chunk_name: 'Q3 2026 property size and price per sqm data',
    tier: 'all',
    content: `REID RAG | Q3 2026 market data: property size and price per sqm

Q3 2026 PROPERTY TRENDS

Table showing Q3 2026 average property size by segment:

Q3 2026 PROPERTY SIZE / SEGMENT   FREEHOLD   LEASEHOLD   COMPLETED   OFF PLAN   VILLA     APARTMENT   MARKET
AVERAGE Q3 2026                   418 sqm    217 sqm     278 sqm     183 sqm    253 sqm   84 sqm      244 sqm
YoY change                        +16.1%     +11.2%      -1.2%       +24.3%     +2.3%     +32.9%      +12.2%

Q3 2026 average size by bedroom: 1 bed 75 sqm (+24%), 2 bed 139 sqm, 3 bed 235 sqm, 4 bed 382 sqm, 5 bed 515 sqm, 6 bed + 734 sqm. Average one bedroom apartment 62 sqm. Total new building area about 55,000 sqm (-88%).

Table showing Q3 2026 average property size by region and bedroom:

Q3 2026 AVERAGE PROPERTY SIZE (sqm) / REGION   1 BED    2 BED     3 BED     4 BED     5 BED     6 BED +
CENTRAL BADUNG                                 73 sqm   138 sqm   240 sqm   341 sqm   498 sqm   452 sqm
DENPASAR                                       54 sqm   144 sqm   191 sqm   335 sqm   406 sqm   657 sqm
GIANYAR                                        77 sqm   150 sqm   257 sqm   464 sqm   532 sqm   556 sqm
MENGWI                                         76 sqm   141 sqm   265 sqm   357 sqm   571 sqm   1,062 sqm
NORTH BADUNG                                   72 sqm   136 sqm   235 sqm   360 sqm   493 sqm   657 sqm
SOUTH BADUNG                                   78 sqm   135 sqm   227 sqm   441 sqm   534 sqm   771 sqm
TABANAN                                        62 sqm   154 sqm   232 sqm   464 sqm   523 sqm   805 sqm

Table showing Q3 2026 average price per sqm by region:

Q3 2026 / REGION   CENTRAL BADUNG   DENPASAR   GIANYAR   MENGWI   NORTH BADUNG   SOUTH BADUNG   TABANAN
PRICE PER SQM      $2,180           $1,962     $2,045    $2,140   $2,150         $2,320         $1,960

Q3 2026 price per sqm: market average $2,164 (-4.8% average, +2.4% like for like); villas +3.2% like for like; apartments $3,122 average (-6.1% like for like, small sample); one bedroom -6.3% like for like; two bedroom +4.4%; three bedroom +4.6%. Like for like by region: North Badung +4.3%, South Badung +3.4%, others within margin of error.

Table showing Q3 2026 average price per sqm by bedroom category and property type:

Q3 2026 PRICE PER SQM (USD) / TYPE   1 BED    2 BED    3 BED    4 BED    5 BED    6 BED +
VILLA                                $2,471   $2,042   $1,936   $2,132   $2,422   $2,163
APARTMENT                            $3,284   $2,586
TOTAL                                $2,695   $2,060   $1,943   $2,132   $2,418   $2,163

Table showing Q3 2026 average price per sqm by region and bedroom:

Q3 2026 PRICE PER SQM (USD) / REGION   1 BED    2 BED    3 BED    4 BED    5 BED    6 BED +
CENTRAL BADUNG                         $3,625   $1,990   $1,760   $1,940   $2,720   $2,170
DENPASAR                               $2,610   $1,790   $1,925   $1,910   $2,575   $2,295
GIANYAR                                $2,475   $1,925   $1,915   $2,020   $2,375   $1,835
MENGWI                                 $2,515   $2,100   $1,935   $2,105   $2,205   $1,985
NORTH BADUNG                           $2,650   $2,105   $1,925   $2,085   $2,405   $2,475
SOUTH BADUNG                           $2,750   $2,140   $2,120   $2,345   $2,680   $2,110
TABANAN                                $2,690   $1,760   $1,695   $2,495   $2,245   $2,185`,
  },
  {
    chunk_id: 7,
    chunk_name: 'Q3 2026 rental supply and occupancy data',
    tier: 'all',
    content: `REID RAG | Q3 2026 market data: rental supply and occupancy (individually managed properties)

Q3 2026 RENTAL TRENDS

Q3 2026 headline rental figures: 47,567 rental properties in September 2026 (+1.7% YoY); 12 month average supply 44,903 (+6.3%); occupancy 52.4% (+2.8 points); average daily rate $151 (-24%); total rental revenue $1.26B (-17%); revenue per property about $28,900 (-19%); revenue per villa $34,840 (-21%); leasehold villa gross yield 10.2% (from 12.5%).

Table showing Q3 2026 rental supply, occupancy and daily rate change by region:

Q3 2026 RENTAL MEASURE / REGION   CENTRAL BADUNG   DENPASAR   GIANYAR   MENGWI   NORTH BADUNG   SOUTH BADUNG   TABANAN
RENTAL SUPPLY SHARE               10%              7%         14%       4%       43%            20%            3%
RENTAL SUPPLY YoY                 -14.0%           +13.6%     +7.2%     +26.6%   -7.2%          +23.5%         +11.4%
OCCUPANCY Q3 2026                 52.5%            57.4%      50.7%     58.0%    55.9%          52.6%          41.8%
OCCUPANCY CHANGE (points)         -3.5             +5.3       +1.5      +5.3     +2.6           +2.7           +2.2
DAILY RATE YoY                    -9.4%            -21.0%     -22.5%    -31.7%   -25.4%         -24.7%         -31.5%
REVENUE PER PROPERTY YoY          -15.1%           -12.9%     -20.2%    -24.7%   -21.8%         -20.7%         -27.6%

Q3 2026 rental supply note: North Badung's -7.2% rental supply change compares September 2026 with an unusually high September 2025; its 12 month average rental supply was +1.3%.

Table showing Q3 2026 average occupancy by bedroom category:

Q3 2026 OCCUPANCY / BEDROOMS   1 BED    2 BED   3 BED   4 BED   5 BED   6 BED +
OCCUPANCY Q3 2026              57.4%    54.6%   52.1%   51.3%   47.6%   43.1%
RELATIVE YoY CHANGE            +12.1%   +6.4%   +6.9%   +7.1%   -4.4%   -6.4%

Table of Q3 2026 average occupancy across bedroom categories and regions:

Q3 2026 RENTAL OCCUPANCY (%) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
CENTRAL BADUNG                          54%     52%     48%     56%     54%     50%
DENPASAR                                60%     58%     59%     56%     57%     49%
GIANYAR                                 56%     52%     48%     48%     52%     45%
MENGWI                                  65%     62%     63%     60%     42%     39%
NORTH BADUNG                            61%     58%     56%     56%     49%     46%
SOUTH BADUNG                            60%     55%     50%     50%     47%     44%
TABANAN                                 43%     42%     47%     39%     42%     35%`,
  },
  {
    chunk_id: 8,
    chunk_name: 'Q3 2026 rental daily rates and gross yields',
    tier: 'all',
    content: `REID RAG | Q3 2026 market data: rental daily rates and leasehold villa gross yields

Table of Q3 2026 average daily rate across bedroom categories and regions (USD, individually managed, trailing 12 months):

Q3 2026 AVERAGE DAILY RATE (USD per night) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
CENTRAL BADUNG                                        $69     $134    $207    $293    $434    $939
DENPASAR                                              $44     $107    $177    $297    $480    $456
GIANYAR                                               $48     $100    $172    $240    $308    $493
MENGWI                                                $49     $90     $138    $244    $668    $929
NORTH BADUNG                                          $55     $110    $172    $263    $451    $678
SOUTH BADUNG                                          $71     $121    $223    $359    $472    $737
TABANAN                                               $51     $92     $147    $226    $408    $643
MARKET                                                $57     $112    $184    $284    $446    $715

Table of Q3 2026 YoY change in average daily rate across bedroom categories and regions:

Q3 2026 DAILY RATE YoY CHANGE (%) / REGION   1 BED    2 BED    3 BED    4 BED    5 BED    6 BED +
CENTRAL BADUNG                               -18.2%   -18.2%   -10.0%   -21.1%   -14.8%   +2.8%
DENPASAR                                     -17.2%   -17.2%   -18.4%   -15.3%   -6.6%    -22.7%
GIANYAR                                      -23.2%   -23.2%   -23.3%   -18.3%   -22.6%   -0.9%
MENGWI                                       -26.5%   -22.3%   -24.4%   -21.0%   -4.0%    -2.1%
NORTH BADUNG                                 -24.7%   -20.9%   -20.6%   -26.5%   -17.5%   -15.4%
SOUTH BADUNG                                 -22.4%   -21.6%   -19.9%   -10.3%   -27.7%   -12.1%
TABANAN                                      -24.3%   -27.4%   -17.0%   -28.2%   -30.4%   -39.3%
AVERAGE                                      -23.0%   -21.3%   -19.2%   -21.2%   -18.4%   -11.4%

Table of Q3 2026 leasehold villa gross yield across bedroom categories and regions:

Q3 2026 LEASEHOLD VILLA GROSS YIELD (%) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
CENTRAL BADUNG                                     11.0%   12.9%   12.8%   13.7%   7.8%    12.4%
DENPASAR                                           11.2%   11.2%   12.1%   12.1%   9.8%    10.4%
GIANYAR                                            7.8%    8.5%    10.2%   7.9%    11.0%   13.1%
MENGWI                                             10.0%   8.9%    7.1%    8.9%    10.5%   10.4%
NORTH BADUNG                                       11.4%   10.3%   10.0%   9.3%    10.9%   10.5%
SOUTH BADUNG                                       12.0%   11.0%   13.0%   10.3%   9.0%    9.1%
TABANAN                                            7.2%    7.7%    8.5%    5.3%    7.3%    9.0%

Q3 2026 leasehold villa gross yield notes: market average 10.2% (-2.3 points); Central Badung highest at 12.5%; six plus bedroom yields fell from 16.8% to 10.8% and five bedroom from 13.1% to 10.2%. Gross yields are indicative and before management fees, maintenance, taxes and vacancy costs.`,
  },
  {
    chunk_id: 9,
    chunk_name: '2026 trajectory: Q1 to H1 to Q3 2026',
    tier: 'all',
    content: `REID RAG | 2026 period trajectory, Q1 2026 to H1 2026 to Q3 2026 (recalculated on the Q3 2026 basis)

2026 PERIOD TRAJECTORY: Q1 2026 TO H1 2026 TO Q3 2026

Across 2026 the direction has been consistent: volumes and launches falling, underlying prices firming, occupancy improving and daily rates falling harder each period. The values below are recalculated on the Q3 2026 basis so the three periods are comparable; some differ from figures published in the Q1 and H1 2026 reports (see the H1 2026 reference section for published values).

Table showing 2026 trajectory of key metrics (each period is a trailing 12 months):

METRIC                                        Q1 2026 (to Mar 2026)   H1 2026 (to Jun 2026)   Q3 2026 (to Sep 2026)
New supply, 12 months                         4,111                   2,593                   2,374
Off plan share of new supply                  28%                     20%                     15%
Available stock at period end                 11,845                  11,215                  11,177
Sales volume YoY                              -15%                    -21%                    -33%
One bedroom share of sales                    15.8%                   15.0%                   14.5%
Like for like median price change YoY         +0.4%                   +1.0%                   +4.0%
Like for like price per sqm change YoY        -0.9%                   +1.6%                   +2.4%
Months of inventory                           31                      32                      36
Average time on market (excl. over 2 years)   280 days                314 days                341 days
Share of sales over 1 year on market          30%                     38%                     46%
Rental supply YoY                             +14%                    +5%                     +1.7%
Occupancy relative YoY change                 -1.2%                   +2.1%                   +5.6%
Average daily rate YoY                        -15%                    -18%                    -24%
Total rental revenue YoY                      -5%                     -8%                     -17%

2026 trajectory reading (Q1 to Q3 2026): the like for like median only moved clear of the margin of error at Q3 2026. Time on market and months of inventory rose each period because sales fell faster than stock. Occupancy gains have not offset rate cuts, so revenue declines deepened.

Rule 2: H1 2026 figures exist on two bases

The H1 2026 reference section uses figures as published in July 2026. The 2026 trajectory table recalculates H1 on the Q3 2026 method so periods compare. When asked about H1 2026 on its own, quote the published figure. When comparing H1 with Q3, use the trajectory table.

H1 2026 measure             Published H1 2026   Recalculated on Q3 2026 basis
Available stock             10,885              11,215
New supply, 12 months       2,500               2,593
Average time on market      256 days            314 days (excludes listings over 2 years)
Occupancy change YoY        +10% relative       +2.1% relative
Rental revenue change YoY   -16%                -8%`,
  },
  {
    chunk_id: 10,
    chunk_name: 'H1 2026 reference: key insights and supply and sales data',
    tier: 'all',
    content: `REID RAG | H1 2026 reference (published July 2026): key insights, supply and sales

H1 2026 BALI REAL ESTATE KEY INSIGHTS (REFERENCE, PUBLISHED JULY 2026)

H1 2026 confirmed a structural shift that first emerged through 2025: the market moved from speculative, smaller format development toward established, larger footprint assets. Supply growth slowed as developers pulled back from new launches, while buyer demand consolidated around larger, completed properties. Figures below are as published in the H1 2026 report.

1. H1 2026: Supply discipline continued

2,500 new properties entered the market in H1 2026 against 10,885 available listings. Off plan's share of new supply eased to 20%. The apartment segment's relative market share fell 7%. Leasehold was 82% of inventory. One to three bedroom formats made up 90% of off plan inventory.

2. H1 2026: Sales fell 21% as buyers rotated to completed villas

Transaction volume fell 21% to 4,220. One bedroom relative share of sales fell 19%, off plan sales share fell 26% and apartment share 13%. The completed share of sales rose from 50% to 63% and villas from 87% to 90%.

3. H1 2026: Median prices rose 3.1%, driven by mix

Median prices rose 3.1% because the sales mix tilted toward larger, higher value completed villas, not because of like for like appreciation. Freehold median $529k; leasehold median $293k. Average price per sqm eased 5% to $1,975; apartments fell 8% to $3,060 per sqm.

4. H1 2026: Properties got larger

Average one bedroom size grew 15% and South Badung average size 18%. Average off plan size grew 22% while total new building area fell 78% to 85,000 sqm.

5. H1 2026: Rental supply grew despite regulation; rates fell 23%

Rental supply grew 5% to 44,750 properties, so a regulation driven contraction had not materialised. Occupancy rose to 52% (up a relative 10%), led by one bedroom units at 57% and Mengwi at 60.5%. Average daily rate fell 23% to $125 and total rental revenue fell 16% to $544 million (reported on a different basis from Q3 2026; do not compare levels directly). Central Badung occupancy fell to 46.1%.

6. H1 2026: Time on market rose 5.4%

Average time on market rose 5.4% to 256 days (published H1 basis). Five bedroom assets took longest at 286 days; South Badung was fastest at 220 days.

H1 2026 MARKET DATA (REFERENCE)

Table showing H1 2026 available properties by bedroom category and property type:

H1 2026 AVAILABLE PROPERTIES (count) / TYPE   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
VILLA                                         779     2,815   3,116   1,842   834     321
APARTMENT                                     1,011   127     34      0       0       0
TOTAL H1 2026                                 1,790   2,942   3,150   1,846   834     321

Table showing H1 2026 available supply by development status and property type:

H1 2026 SUPPLY SHARE (%)     AVAILABLE   OFF PLAN
DEVELOPMENT STATUS H1 2026   65%         35%
                             VILLA       APARTMENT
PROPERTY TYPE H1 2026        89%         11%
VILLAS by status             70%         30%
APARTMENTS by status         25%         75%

Table showing H1 2026 regional shares:

H1 2026 MEASURE / REGION   CENTRAL BADUNG   DENPASAR   GIANYAR   MENGWI   NORTH BADUNG   SOUTH BADUNG   TABANAN
AVAILABLE SUPPLY SHARE     6%               3%         10%       17%      35%            22%            7%
SALES SHARE                5%               5%         7%        18%      32%            26%            6%
RENTAL SUPPLY SHARE        10%              7%         13%       4%       45%            19%            3%
OCCUPANCY H1 2026          46.1%            56.9%      53.2%     60.5%    57.1%          54.1%          39.3%
PRICE PER SQM H1 2026      $1,960           $1,745     $1,950    $2,000   $1,965         $2,075         $1,800

Table showing H1 2026 sales volume share by bedroom category:

H1 2026 SALES / BEDROOMS   1 BED      2 BED      3 BED      4 BED      5 BED      6 BED +
SALES SHARE H1 2026        15.5%      31.8%      26.5%      16.6%      7.6%       2%
TIME ON MARKET H1 2026     242 days   252 days   253 days   265 days   286 days   279 days

Table showing H1 2026 median price and YoY change by ownership type and bedroom (median change, as published):

H1 2026 MEDIAN PRICE (USD) AND MEDIAN CHANGE / OWNERSHIP   1 BED   2 BED   3 BED   4 BED   5 BED     6 BED     MEDIAN
Freehold H1 2026                                           $208k   $326k   $455k   $857k   $1.351M   $1.727M   $529k
Change                                                     +2%     +9%     -4%     +2.6%   +16.9%    +20.2%    +4.7%
Leasehold H1 2026                                          $168k   $249k   $356k   $580k   $869k     $850k     $293k
Change                                                     +5%     +1.4%   +2.9%   +9.3%   +9.3%     +6.3%     +4.4%

Table showing H1 2026 median price by region and bedroom:

H1 2026 MEDIAN SALE PRICE (USD) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED     6 BED +
CENTRAL BADUNG                             $210k   $244k   $347k   $465k   $975k     $672k
DENPASAR                                   $104k   $229k   $325k   $536k   $446k     $800k
GIANYAR                                    $155k   $251k   $335k   $644k   $795k     $645k
MENGWI                                     $163k   $254k   $399k   $606k   $1.156M   $1.15M
NORTH BADUNG                               $150k   $250k   $362k   $565k   $810k     $838k
SOUTH BADUNG                               $183k   $250k   $355k   $646k   $810k     $650k
TABANAN                                    $157k   $222k   $281k   $619k   $783k     $925k`,
  },
  {
    chunk_id: 11,
    chunk_name: 'H1 2026 reference: property and rental data',
    tier: 'all',
    content: `REID RAG | H1 2026 reference (published July 2026): property size, price per sqm, occupancy and daily rate

Table showing H1 2026 average property size by segment:

H1 2026 PROPERTY SIZE / SEGMENT   FREEHOLD   LEASEHOLD   COMPLETED   OFF PLAN   VILLA     APARTMENT   MARKET
AVERAGE H1 2026                   365 sqm    213 sqm     266 sqm     173 sqm    241 sqm   74 sqm      230 sqm

Table showing H1 2026 average property size by region and bedroom:

H1 2026 AVERAGE PROPERTY SIZE (sqm) / REGION   1 BED    2 BED     3 BED     4 BED     5 BED     6 BED +
CENTRAL BADUNG                                 67 sqm   139 sqm   234 sqm   349 sqm   508 sqm   436 sqm
DENPASAR                                       40 sqm   263 sqm   285 sqm   377 sqm   421 sqm   800 sqm
GIANYAR                                        71 sqm   147 sqm   238 sqm   424 sqm   572 sqm   395 sqm
MENGWI                                         74 sqm   145 sqm   255 sqm   351 sqm   552 sqm   997 sqm
NORTH BADUNG                                   69 sqm   133 sqm   226 sqm   344 sqm   486 sqm   581 sqm
SOUTH BADUNG                                   74 sqm   132 sqm   227 sqm   415 sqm   512 sqm   689 sqm
TABANAN                                        62 sqm   137 sqm   213 sqm   461 sqm   505 sqm   533 sqm

Table showing H1 2026 average price per sqm by bedroom category and property type:

H1 2026 PRICE PER SQM (USD) / TYPE   1 BED    2 BED    3 BED    4 BED    5 BED    6 BED +
VILLA                                $2,358   $1,915   $1,763   $1,933   $2,183   $2,029
APARTMENT                            $3,063   $2,292   $1,712
TOTAL                                $2,500   $1,921   $1,762   $1,933   $2,169   $2,029

Table showing H1 2026 average price per sqm by region and bedroom:

H1 2026 PRICE PER SQM (USD) / REGION   1 BED    2 BED    3 BED    4 BED    5 BED    6 BED +
CENTRAL BADUNG                         $3,750   $1,970   $1,760   $1,865   $2,555   $1,460
DENPASAR                               $3,450   $1,765   $1,665   $1,825   $1,635   $1,400
GIANYAR                                $2,365   $1,945   $1,760   $1,865   $2,370   $1,650
MENGWI                                 $2,300   $1,945   $1,725   $2,010   $2,280   $2,150
NORTH BADUNG                           $2,535   $1,910   $1,850   $1,900   $2,125   $2,030
SOUTH BADUNG                           $2,500   $1,965   $1,805   $2,170   $2,760   $1,800
TABANAN                                $2,840   $1,800   $1,530   $1,900   $1,610   $2,505

Table of H1 2026 average occupancy across bedroom categories and regions:

H1 2026 RENTAL OCCUPANCY (%) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
CENTRAL BADUNG                          51%     46%     34%     56%     50%     50%
DENPASAR                                59%     56%     56%     54%     54%     43%
GIANYAR                                 56%     51%     48%     45%     49%     39%
MENGWI                                  64%     60%     61%     60%     42%     37%
NORTH BADUNG                            61%     57%     56%     56%     48%     45%
SOUTH BADUNG                            59%     54%     49%     46%     44%     45%
TABANAN                                 44%     27%     45%     36%     37%     33%

Table of H1 2026 average daily rate across bedroom categories and regions (H1 2026 basis; not comparable with Q3 2026 levels):

H1 2026 AVERAGE DAILY RATE (USD per night, H1 basis) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
CENTRAL BADUNG                                                  $52     $85     $155    $266    $390    $843
DENPASAR                                                        $42     $79     $165    $285    $455    $465
GIANYAR                                                         $40     $74     $129    $163    $228    $391
MENGWI                                                          $45     $74     $127    $218    $605    $847
NORTH BADUNG                                                    $54     $80     $123    $185    $308    $452
SOUTH BADUNG                                                    $61     $98     $186    $245    $314    $681
TABANAN                                                         $47     $79     $162    $215    $368    $631`,
  },
  {
    chunk_id: 12,
    chunk_name: 'Q1 2026 reference key insights and 2025 to 2026 continuing themes',
    tier: 'all',
    content: `REID RAG | Q1 2026 reference (published May 2026) and 2025 to 2026 continuing themes

Q1 2026 BALI REAL ESTATE KEY INSIGHTS (REFERENCE, PUBLISHED MAY 2026)

1. Q1 2026: The market entered a phase of controlled consolidation, with supply growth stabilising

Development activity in Q1 2026 remained measured, with available stock accounting for 67% of listings and off plan supply contained at 33%. This continued the 2025 pipeline contraction, where developers shifted from expansion toward inventory absorption. Apartment share stabilised at 13%, indicating that diversification had paused following rapid growth across 2024 to 2025.

2. Q1 2026: Apartment pipeline expansion introduced forward absorption and rental risk

While apartments remained a small share of total supply, 79% of apartment inventory was off plan. The concentration of uncompleted projects created a forward loaded supply pipeline that could increase competition in sales absorption and rental performance as projects complete.

3. Q1 2026: Compact assets continued to dominate demand, but supply expansion slowed

One and two bedroom properties remained the primary drivers of transaction activity, reinforcing the 2025 shift toward yield oriented, accessible assets. Supply growth within these segments began to moderate as developer pipelines tightened. (By H1 2026 and Q3 2026 this trend had reversed, with buyers rotating to larger completed villas.)

4. Q1 2026: Sales volume softened amid regulatory scrutiny and global instability

Transaction activity slowed as buyer sentiment became more cautious. Increased focus on zoning (RDTR), building approvals (PBG) and certificates of function (SLF), combined with global economic uncertainty, lengthened decision timelines.

5. Q1 2026: Pricing remained resilient, driven by composition rather than growth

Median pricing increased +0.7% year on year despite slower sales. Price movements remained largely compositional rather than a systemic value change.

6. Q1 2026: A persistent pricing gap reinforced preference for completed, income ready assets

The price differential between available and off plan properties remained above 20%. Completed apartments attracted a ~10% premium and villas a ~15% premium, reflecting buyer preference for operational readiness, immediate rental yield and reduced delivery risk.

7. Q1 2026: Price per square metre showed early signs of competitive pressure

Average price per sqm softened slightly from the 2025 benchmark of $2,210, reflecting increased competition, particularly within compact segments.

8. Q1 2026: Rental performance remained bifurcated, with occupancy growth offset by revenue decline

Rental occupancy increased 3.4% year on year while total revenue declined approximately 7%, reflecting pressure on daily rates as competition intensified.

9. Q1 2026: Regional divergence increased across sales and rental markets

South Badung recorded a 10% increase in occupancy while Central Badung declined 7%.

10. Q1 2026: Tourism recovery reached a new structural phase, led by international demand

Total tourist arrivals reached their highest level since 2019. Foreign arrivals accounted for 42% of total visitors for the first time.

11. Q1 2026: The market was increasingly defined by discipline, compliance and operational execution

Regulatory compliance around RDTR, PBG and SLF became central to development feasibility and investment decisions. Market performance was increasingly determined by product alignment, legal clarity and operational execution rather than broad based growth.

2025 TO 2026: CONTINUING THEMES

The structural forces that defined 2025 carried through Q1, H1 and Q3 2026, confirming a multi year recalibration now in its consolidation stage.

1. The occupancy and revenue divergence has deepened. 2025: occupancy +2 points, revenue -15%. Q1 2026: occupancy +3.4%, revenue -7%. H1 2026: occupancy +10% relative, revenue -16%. Q3 2026: occupancy 52.4%, daily rate -24%, revenue -17%. Operators are managing for occupancy over rate.
2. Supply contraction has continued and accelerated. 2025: off plan inventory -9% and new build area -34% to 160,000 sqm. Q3 2026: new listings -69% and new build area about 55,000 sqm (-88%).
3. Compact asset dominance has reversed. One and two bedroom homes reached 53% of 2025 sales. Through 2026 buyers rotated toward larger, completed villas; one bedroom sales fell 57% in Q3 2026.
4. Pricing remains compositional, but underlying values are now firming. 2025 median -2% and Q1 2026 median +0.7% were mix driven. In Q3 2026 the like for like median rose 4.0%, the first clear underlying gain.
5. Regulatory tightening is a structural market condition. Enforcement of RDTR, PBG and SLF and the 2026 short term rental licensing push shape buyer timelines, developer feasibility and rental supply. Automated platform verification due by 2027 is the next swing factor.`,
  },
  {
    chunk_id: 13,
    chunk_name: '2025 reference: key insights',
    tier: 'all',
    content: `REID RAG | 2025 reference: key insights

2025 BALI REAL ESTATE KEY INSIGHTS (REFERENCE)

The Bali property market in 2025 underwent a decisive recalibration following the accelerated growth cycle of 2022 to 2024. Both supply and transaction volumes moderated, and developers pivoted toward compact, efficiently designed assets. Supply pipelines narrowed, particularly off plan. Aggregate prices softened, but the decline largely reflected a compositional shift toward smaller format sales rather than falling asset values. In the rental market, a substantial increase in stock placed downward pressure on daily rates while occupancy held steady.

- 2025: Total market median prices softened, falling -2%. Downward pressure came from off plan and apartment sales.
- 2025: One and two bedroom assets led sales volume at over 53%, up from under 35% in 2023.
- 2025: Rental occupancy averaged around 53%, up to 2 percentage points above 2024 before a softer end to the year.
- 2025: Rental supply grew 12%, sharpening competition and pressuring rates and revenue.
- 2025: Over 4,800 property transactions, down just over 5% year on year.
- 2025: Combined sales value over $2B, down 9% year on year.
- 2025: About 160,000 sqm of new property launched, well below the 244,000 sqm peak in 2024.
- 2025: Rental revenue declined 15% to $1.21B despite higher occupancy.`,
  },
  {
    chunk_id: 14,
    chunk_name: '2025 reference: supply, sales and pricing data',
    tier: 'all',
    content: `REID RAG | 2025 reference: supply, sales and median prices

2025 MARKET DATA (REFERENCE)

2025 supply: over 12,300 properties for sale (-7% YoY); leasehold 80.6% of supply, freehold 19.4%; over 3,230 off plan properties (-9%); over 2,390 off plan villas (-12%); over 800 off plan apartments (-55%); apartment share 13.8%. North Badung held 34.9% of supply (over 4,290, -22% YoY) and South Badung grew to 22% (+13%).

Table showing 2025 available properties by bedroom category and property type:

2025 AVAILABLE PROPERTIES (count) / TYPE   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
VILLA                                      875     3,278   3,595   2,140   985     375
APARTMENT                                  1,055   137     25      0       0       0
TOTAL 2025                                 1,930   3,415   3,620   2,140   985     375

Table showing 2025 available supply by development status and property type:

2025 SUPPLY SHARE (%)     AVAILABLE   OFF PLAN
DEVELOPMENT STATUS 2025   67%         33%
VILLAS by status          72%         28%
APARTMENTS by status      25%         75%
                          VILLA       APARTMENT
PROPERTY TYPE 2025        86%         14%

Table showing 2025 regional shares:

2025 SHARE (%) / REGION       CENTRAL BADUNG   DENPASAR   GIANYAR   MENGWI   NORTH BADUNG   SOUTH BADUNG   TABANAN
AVAILABLE SUPPLY SHARE 2025   7.1%             3.6%       8.8%      17.2%    34.9%          21.6%          6.8%
RENTAL SUPPLY SHARE 2025      10.8%            6.2%       12.2%     4.1%     46.9%          17%            2.7%

Table showing 2025 sales volume share by bedroom category:

2025 SALES / BEDROOMS   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
SALES SHARE 2025        20.8%   31.9%   26.4%   13.2%   6.2%    1.5%

2025 pricing: median leasehold price $280k (-5% over 36 months); median freehold price $505k (+10% over 36 months).

Table showing 2024 to 2025 median price by bedroom category:

MEDIAN PRICE (USD) BY YEAR / BEDROOMS   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED   MEDIAN
2024                                    $160k   $246k   $346k   $506k   $786k   $800k   $285k
2025                                    $161k   $246k   $347k   $530k   $795k   $800k   $280k
Change                                  +0.6%   0%      +0.3%   +4.7%   +1.1%   0%      -2.1%

Table showing 2024 to 2025 median price by region:

MEDIAN PRICE (USD) BY YEAR / REGION   CENTRAL BADUNG   DENPASAR   GIANYAR   MENGWI   NORTH BADUNG   SOUTH BADUNG   TABANAN
2024                                  $295k            $328k      $298k     $305k    $297k          $247k          $276k
2025                                  $289k            $320k      $290k     $295k    $295k          $247k          $259k
Change                                -2%              -2.4%      -2.7%     -3.3%    -0.7%          0%             -6.2%

2025 property: average property size 201 sqm (-18% over 36 months); average villa size 229 sqm (-3%); floor space ratio 83% (+3%); 160,000 sqm new build (-34%); market average price per sqm $2,210 (+2%); apartment average $3,400 per sqm (-1%).`,
  },
  {
    chunk_id: 15,
    chunk_name: '2025 reference: property size and price per sqm data',
    tier: 'all',
    content: `REID RAG | 2025 reference: property size and price per sqm

Table showing 2025 average property size by bedroom category:

2025 PROPERTY SIZE / BEDROOMS   1 BED    2 BED     3 BED     4 BED     5 BED     6 BED +   MARKET
AVERAGE 2025                    65 sqm   140 sqm   230 sqm   352 sqm   488 sqm   471 sqm   201 sqm

Table showing 2025 average property size by region and bedroom:

2025 AVERAGE PROPERTY SIZE (sqm) / REGION   1 BED    2 BED     3 BED     4 BED     5 BED     6 BED +
CENTRAL BADUNG                              57 sqm   155 sqm   251 sqm   350 sqm   496 sqm   470 sqm
DENPASAR                                    48 sqm   160 sqm   219 sqm   393 sqm   406 sqm   517 sqm
GIANYAR                                     87 sqm   158 sqm   246 sqm   427 sqm   427 sqm   487 sqm
MENGWI                                      76 sqm   148 sqm   248 sqm   333 sqm   514 sqm   628 sqm
NORTH BADUNG                                65 sqm   145 sqm   229 sqm   348 sqm   481 sqm   575 sqm
SOUTH BADUNG                                62 sqm   137 sqm   213 sqm   388 sqm   477 sqm   563 sqm
TABANAN                                     65 sqm   147 sqm   244 sqm   373 sqm   531 sqm   701 sqm

Table showing 2025 average price per sqm by bedroom category and property type:

2025 PRICE PER SQM (USD) / TYPE   1 BED    2 BED    3 BED    4 BED    5 BED    6 BED +
VILLA                             $2,530   $1,940   $1,770   $1,875   $2,090   $2,005
APARTMENT                         $3,505   $2,580
TOTAL                             $3,077   $1,972   $1,742   $1,839   $1,990   $1,976

Table showing 2025 average price per sqm by region and bedroom:

2025 PRICE PER SQM (USD) / REGION   1 BED    2 BED    3 BED    4 BED    5 BED    6 BED +
CENTRAL BADUNG                      $3,950   $1,990   $1,565   $1,605   $1,745   $1,695
DENPASAR                            $3,180   $1,770   $2,160   $1,615   $1,995   $1,250
GIANYAR                             $2,290   $1,910   $1,685   $1,915   $2,400   $1,940
MENGWI                              $2,535   $1,905   $1,740   $1,855   $2,080   $2,010
NORTH BADUNG                        $3,130   $1,955   $1,740   $1,855   $2,080   $2,010
SOUTH BADUNG                        $3,170   $2,090   $2,050   $1,985   $2,045   $2,155
TABANAN                             $2,745   $1,785   $1,520   $1,640   $1,800   $1,980

2025 rental: 44,490 rental properties (+107% over 36 months); market occupancy 53% (+2%); total rental revenue $1.21B (-15%); South Badung share of revenue 18% (+17%); market average daily rate $178 (-14%, 2025 basis); professionally managed average daily rate $226 (-26%); South Badung one bedroom occupancy 57% (+7 points); three bedroom occupancy 55% (-8 points).`,
  },
  {
    chunk_id: 16,
    chunk_name: '2025 reference: rental data',
    tier: 'all',
    content: `REID RAG | 2025 reference: rental occupancy and daily rate

Table of 2025 average occupancy across bedroom categories and regions:

2025 RENTAL OCCUPANCY (%) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
CENTRAL BADUNG                       50%     51%     56%     55%     56%     57%
DENPASAR                             61%     64%     61%     60%     65%     60%
GIANYAR                              59%     61%     59%     59%     60%     60%
MENGWI                               61%     62%     58%     55%     45%     45%
NORTH BADUNG                         61%     59%     59%     56%     52%     59%
SOUTH BADUNG                         57%     62%     54%     51%     51%     50%
TABANAN                              41%     52%     45%     43%     46%     34%

Table of 2025 average daily rate across bedroom categories and regions (2025 basis; not comparable with Q3 2026 levels):

2025 AVERAGE DAILY RATE (USD per night, 2025 basis) / REGION   1 BED   2 BED   3 BED   4 BED   5 BED   6 BED +
CENTRAL BADUNG                                                 $70     $106    $173    $273    $369    $596
DENPASAR                                                       $63     $118    $208    $352    $503    $563
GIANYAR                                                        $64     $106    $201    $291    $382    $514
MENGWI                                                         $78     $105    $169    $285    $655    $944
NORTH BADUNG                                                   $87     $117    $195    $329    $485    $752
SOUTH BADUNG                                                   $103    $154    $254    $411    $619    $779
TABANAN                                                        $74     $129    $186    $292    $569    $938`,
  },
  {
    chunk_id: 17,
    chunk_name: 'Regulatory landscape: overview and ownership structures',
    tier: 'all',
    content: `REID RAG | Bali regulatory landscape: overview, 2026 licensing update and ownership structures

BALI REGULATORY LANDSCAPE

OVERVIEW

Property acquisition and development in Bali remains viable for foreign investors, but it is no longer a lightly regulated environment. Both the Provincial Government of Bali and central authorities have materially increased enforcement around zoning compliance, building approvals and tourism licensing. The focus has shifted from structural permissibility to operational compliance.

At a structural level, foreign participation must sit within Indonesia's recognised land rights framework. Direct individual freehold ownership is not available to foreign individuals. Investment therefore requires a properly structured approach: an individual right of use for residential occupation, a foreign investment company for commercial development, or a private lease arrangement supported by robust documentation.

The more significant compliance risk sits in land use alignment and licensing. Authorities are actively reviewing villas and small scale hospitality assets operating without correct zoning, building approvals or tourism licences. Properties without the appropriate building approval or certificate of function may face restrictions on use. Short term rental operations without a valid business identification number and sector licence are increasingly exposed to administrative sanctions.

For developers, feasibility must incorporate spatial planning (RDTR) verification at the outset. Green zone and protected areas are under heightened scrutiny. For investors purchasing existing assets, due diligence must extend beyond title to zoning designation, construction approvals, operational permits and corporate compliance.

2026 short term rental licensing update (Q3 2026): The Ministry of Tourism's March 2026 licensing deadline and pressure on booking platforms to list only licensed, tax paying properties did not produce a sharp fall in rental supply. Enforcement through Q3 2026 favoured registration over removal. Automated platform verification is due by 2027 and is the main swing factor for rental supply.

In practical terms, Bali has moved from a relationship based, documentation light market to one that demands formal registration, licensing alignment and transparent business structuring. The key question is not whether foreign ownership is possible, but whether the intended use of the asset is fully aligned with land classification, building approvals and business licensing.

OWNERSHIP STRUCTURES

1. Right of Use (Hak Pakai)

Hak Pakai is the primary title available to foreign individuals holding a valid Indonesian residence permit, such as a KITAS or KITAP. It grants a state recognised, time bound right to use and occupy residential property. It may be issued over state land or structured over land held under Hak Milik or Hak Guna Bangunan, subject to registration and regulatory compliance. It does not provide full ownership but offers a legally recognised tenure that may be extended under prevailing regulations.

2. Right to Build (Hak Guna Bangunan / HGB) via PT PMA

HGB allows the holder to construct and commercially use buildings on land not held under freehold. Foreign individuals cannot hold HGB directly and must establish a PT PMA. HGB is typically granted for 30 years and may be extended in stages up to approximately 80 years, subject to regulation. Through a PT PMA, investors may develop and operate villas, hospitality assets and other income generating property.

3. Leasehold

Leasehold is a private contractual arrangement between landowner and tenant. It is not a state recognised land title under Indonesian agrarian law. The lease is granted for a fixed term and may be extended subject to contract terms. Ownership of the land remains with the landowner. Because protections depend on contract structure rather than statutory land rights, risk and enforceability depend on due diligence and documentation.`,
  },
  {
    chunk_id: 18,
    chunk_name: 'Regulatory landscape: required documents before buying',
    tier: 'all',
    content: `REID RAG | Bali regulatory landscape: required documents before buying (RDTR, PBG, SLF, NIB, OSS)

REQUIRED DOCUMENTS BEFORE BUYING

1. Land Certificate: Hak Pakai or Hak Guna Bangunan (HGB)

The land certificate must clearly reflect the correct title and be registered with the Badan Pertanahan Nasional (BPN). It is the primary proof of legal tenure and confirms the validity, duration and classification of the land right.

2. PBG and SLF: Building Approval and Certificate of Proper Function

The PBG (Persetujuan Bangunan Gedung) confirms formal construction approval, replacing the former IMB system. The SLF (Sertifikat Laik Fungsi) certifies that the completed building is fit for use and compliant with safety and zoning requirements. Together they confirm legal construction and lawful occupancy.

3. Lease Agreement (Leasehold)

A formal Lease Agreement should be executed, typically before a Notary or Land Deed Official (PPAT). It should clearly define lease duration, extension rights, transfer provisions, and renovation and structural permissions. Legal certainty depends heavily on the strength of this document.

4. NIB and Tourism Business Licence

If the villa is operated as short or long term rental accommodation, a Business Identification Number (Nomor Induk Berusaha / NIB) and the relevant tourism operational licence are required. Without them, the rental activity may be classified as non compliant.

5. OSS Registration: Online Single Submission

All business licensing, including NIB issuance and sector approvals, is processed through Indonesia's Online Single Submission (OSS) system. OSS registration applies to both individuals and PT PMA entities engaging in rental activity.`,
  },
  {
    chunk_id: 19,
    chunk_name: 'Neighbourhood classification: Badung regions (North, South, Central Badung and Mengwi)',
    tier: 'all',
    content: `REID RAG | Neighbourhood classification, part 1 of 2: neighbourhood to REID region mapping for Badung

NEIGHBOURHOOD CLASSIFICATION

Each table below lists the neighbourhoods REID groups under one region. Use the REID Neighbourhood name in all outputs.

Neighbourhood classification: North Badung region:

REID Neighbourhood   REID Region    Market Classification   Official Regency / Area
BERAWA               North Badung   Key Market              Badung
CANGGU               North Badung   Key Market              Badung
KEROBOKAN            North Badung   Key Market              Badung
UMALAS               North Badung   Key Market              Badung
PADONAN              North Badung   Emerging Market         Badung
BABAKAN              North Badung   Other                   Badung
BUMBAK               North Badung   Other                   Badung
OTHER NORTH BADUNG   North Badung   Other                   Badung
OTHER BADUNG         North Badung   Other                   Badung

Neighbourhood classification: South Badung region:

REID Neighbourhood   REID Region    Market Classification   Official Regency / Area
BINGIN               South Badung   Key Market              Badung
ULUWATU              South Badung   Key Market              Badung
BALANGAN             South Badung   Emerging Market         Badung
JIMBARAN             South Badung   Other                   Badung
NUSA DUA             South Badung   Other                   Badung
UNGASAN              South Badung   Other                   Badung
MELASTI              South Badung   Other                   Badung
BENOA                South Badung   Other                   Badung
PADANG PADANG        South Badung   Other                   Badung
KUTUH                South Badung   Other                   Badung
NYANG NYANG          South Badung   Other                   Badung
PECATU               South Badung   Other                   Badung
PANDAWA              South Badung   Other                   Badung

Neighbourhood classification: Central Badung region:

REID Neighbourhood   REID Region      Market Classification   Official Regency / Area
SEMINYAK             Central Badung   Key Market              Badung
KUTA                 Central Badung   Other                   Badung
LEGIAN               Central Badung   Other                   Badung

Neighbourhood classification: Mengwi region:

REID Neighbourhood   REID Region   Market Classification   Official Regency / Area
PERERENAN            Mengwi        Key Market              Badung
SESEH                Mengwi        Emerging Market         Badung
BUDUK                Mengwi        Other                   Badung
CEMAGI               Mengwi        Other                   Badung
MUNGGU               Mengwi        Other                   Badung
TUMBAK BAYUH         Mengwi        Other                   Badung
OTHER MENGWI         Mengwi        Other                   Badung

Data routing note: When a paid user asks about a specific neighbourhood listed here, route the query to the live CSV data source.`,
  },
  {
    chunk_id: 20,
    chunk_name: 'Neighbourhood classification: Denpasar, Gianyar, Tabanan, Other and Non Bali',
    tier: 'all',
    content: `REID RAG | Neighbourhood classification, part 2 of 2: neighbourhood to REID region mapping for Denpasar, Gianyar, Tabanan, Other Bali and Non Bali

NEIGHBOURHOOD CLASSIFICATION

Each table below lists the neighbourhoods REID groups under one region. Use the REID Neighbourhood name in all outputs.

Neighbourhood classification: Denpasar region:

REID Neighbourhood   REID Region   Market Classification   Official Regency / Area
SANUR                Denpasar      Key Market              Denpasar
DENPASAR             Denpasar      Other                   Denpasar
OTHER DENPASAR       Denpasar      Other                   Denpasar

Neighbourhood classification: Gianyar region:

REID Neighbourhood   REID Region   Market Classification   Official Regency / Area
UBUD                 Gianyar       Key Market              Gianyar
PEJENG               Gianyar       Other                   Gianyar
SABA                 Gianyar       Other                   Gianyar
KERAMAS              Gianyar       Other                   Gianyar
TEGALALANG           Gianyar       Other                   Gianyar
PAYANGAN             Gianyar       Other                   Gianyar
SUKAWATI             Gianyar       Other                   Gianyar
OTHER GIANYAR        Gianyar       Other                   Gianyar

Neighbourhood classification: Tabanan region:

REID Neighbourhood   REID Region   Market Classification   Official Regency / Area
KABA KABA            Tabanan       Emerging Market         Tabanan
NYANYI               Tabanan       Emerging Market         Tabanan
BUWIT                Tabanan       Other                   Tabanan
CEPAKA               Tabanan       Other                   Tabanan
BALIAN               Tabanan       Other                   Tabanan
BEDUGUL              Tabanan       Other                   Tabanan
KEDIRI               Tabanan       Other                   Tabanan
KEDUNGU              Tabanan       Other                   Tabanan
BERABAN              Tabanan       Other                   Tabanan
TANAH LOT            Tabanan       Other                   Tabanan
OTHER TABANAN        Tabanan       Other                   Tabanan

Neighbourhood classification: Other Bali areas (excluded from REID market statistics):

REID Neighbourhood                            REID Region   Market Classification   Official Regency / Area
SINGARAJA                                     Other         Other                   Buleleng
LOVINA BEACH                                  Other         Other                   Buleleng
LOVINA                                        Other         Other                   Buleleng
MUNDUK                                        Other         Other                   Buleleng
OTHER NORTH BALI                              Other         Other                   Buleleng
CANDIDASA                                     Other         Other                   Karangasem
AMED                                          Other         Other                   Karangasem
KARANGASEM                                    Other         Other                   Karangasem
SIDEMAN                                       Other         Other                   Karangasem
OTHER EAST BALI                               Other         Other                   Karangasem
KINTAMANI                                     Other         Other                   Bangli
MEDEWI                                        Other         Other                   Jembrana
OTHER WEST BALI                               Other         Other                   Jembrana / Tabanan
NUSA PENIDA                                   Other         Other                   Klungkung
NUSA LEMBONGAN                                Other         Other                   Klungkung
OTHER SOUTH EAST BALI & SURROUNDING ISLANDS   Other         Other                   Various
OTHER                                         Other         Other                   Various

Neighbourhood classification: Non Bali areas (excluded from REID market statistics):

REID Neighbourhood         REID Region   Market Classification   Official Regency / Area
GILI ISLANDS               Non Bali      Non Bali                NTB / Lombok
LOMBOK                     Non Bali      Non Bali                NTB
SUMBAWA                    Non Bali      Non Bali                NTB
SUMBA                      Non Bali      Non Bali                NTT
ROTE ISLAND                Non Bali      Non Bali                NTT
LABUAN BAJO                Non Bali      Non Bali                NTT
JAVA                       Non Bali      Non Bali                Java
JAKARTA                    Non Bali      Non Bali                DKI Jakarta
BANDUNG                    Non Bali      Non Bali                West Java
BEKASI                     Non Bali      Non Bali                West Java
YOGYAKARTA                 Non Bali      Non Bali                DIY
SURABAYA                   Non Bali      Non Bali                East Java
MENTAWAI                   Non Bali      Non Bali                West Sumatra
SUMATRA                    Non Bali      Non Bali                Sumatra
KALIMANTAN                 Non Bali      Non Bali                Kalimantan
OTHER INDONESIAN ISLANDS   Non Bali      Non Bali                Various

Columns: REID Neighbourhood (the name REID uses in all outputs); REID Region (the parent region grouping); Market Classification (Key Market, Emerging Market or Other); Official Regency / Area (the formal Indonesian administrative area).

Data routing note: When a paid user asks about a specific neighbourhood listed here, route the query to the live CSV data source.`,
  },
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
