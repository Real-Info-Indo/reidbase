/* -- RAG CONTENT: 2025-Q1 2026 REID Consolidated Intelligence Document -- */
/* Single export for all tiers. Tier differences control AI output depth, not RAG access. */
export const RAG_CONTENT = `
REID 2025-Q1 2026 BALI PROPERTY MARKET INTELLIGENCE
All prices in USD. All sizes in SQM. Leasehold represents approximately 80% of transactional volume.
Data currency: updated quarterly. This reflects 2025 annual data with Q1 2026 updates as of the most recent quarterly revision.

NEIGHBOURHOOD DIRECTORY
Use this table to correctly classify any location a user mentions before responding.
REID Region is the parent grouping used in all regional data. Market Classification indicates data depth available.

REID Neighbourhood     | REID Region    | Market Classification | Official Regency
SANUR                  | Denpasar       | Key Market            | Denpasar
OTHER DENPASAR         | Denpasar       | Other                 | Denpasar
DENPASAR               | Denpasar       | Other                 | Denpasar
BINGIN                 | South Badung   | Key Market            | Badung
JIMBARAN               | South Badung   | Other                 | Badung
NUSA DUA               | South Badung   | Other                 | Badung
ULUWATU                | South Badung   | Key Market            | Badung
UNGASAN                | South Badung   | Other                 | Badung
MELASTI                | South Badung   | Other                 | Badung
BENOA                  | South Badung   | Other                 | Badung
PADANG PADANG          | South Badung   | Other                 | Badung
KUTUH                  | South Badung   | Other                 | Badung
BALANGAN               | South Badung   | Emerging Market       | Badung
NYANG NYANG            | South Badung   | Other                 | Badung
PECATU                 | South Badung   | Other                 | Badung
PANDAWA                | South Badung   | Other                 | Badung
KUTA                   | Central Badung | Other                 | Badung
SEMINYAK               | Central Badung | Key Market            | Badung
LEGIAN                 | Central Badung | Other                 | Badung
BABAKAN                | North Badung   | Other                 | Badung
BERAWA                 | North Badung   | Key Market            | Badung
CANGGU                 | North Badung   | Key Market            | Badung
KEROBOKAN              | North Badung   | Other                 | Badung
BUMBAK                 | North Badung   | Other                 | Badung
PADONAN                | North Badung   | Emerging Market       | Badung
UMALAS                 | North Badung   | Key Market            | Badung
OTHER NORTH BADUNG     | North Badung   | Other                 | Badung
OTHER BADUNG           | North Badung   | Other                 | Badung
BUDUK                  | Mengwi         | Other                 | Badung
CEMAGI                 | Mengwi         | Other                 | Badung
MUNGGU                 | Mengwi         | Other                 | Badung
PERERENAN              | Mengwi         | Key Market            | Badung
SESEH                  | Mengwi         | Emerging Market       | Badung
TUMBAK BAYUH           | Mengwi         | Other                 | Badung
OTHER MENGWI           | Mengwi         | Other                 | Badung
SINGARAJA              | Other          | Other                 | Buleleng
LOVINA BEACH           | Other          | Other                 | Buleleng
OTHER NORTH BALI       | Other          | Other                 | Buleleng
UBUD                   | Gianyar        | Key Market            | Gianyar
PEJENG                 | Gianyar        | Other                 | Gianyar
SABA                   | Gianyar        | Other                 | Gianyar
KERAMAS                | Gianyar        | Other                 | Gianyar
TEGALALANG             | Gianyar        | Other                 | Gianyar
PAYANGAN               | Gianyar        | Other                 | Gianyar
SUKAWATI               | Gianyar        | Other                 | Gianyar
OTHER GIANYAR          | Gianyar        | Other                 | Gianyar
BUWIT                  | Tabanan        | Other                 | Tabanan
CEPAKA                 | Tabanan        | Other                 | Tabanan
KABA KABA              | Tabanan        | Emerging Market       | Tabanan
BALIAN                 | Tabanan        | Other                 | Tabanan
BEDUGUL                | Tabanan        | Other                 | Tabanan
KEDIRI                 | Tabanan        | Other                 | Tabanan
KEDUNGU                | Tabanan        | Other                 | Tabanan
NYANYI                 | Tabanan        | Emerging Market       | Tabanan
BERABAN                | Tabanan        | Other                 | Tabanan
TANAH LOT              | Tabanan        | Other                 | Tabanan
OTHER TABANAN          | Tabanan        | Other                 | Tabanan
CANDIDASA              | Other          | Other                 | Karangasem
AMED                   | Other          | Other                 | Karangasem
KARANGASEM             | Other          | Other                 | Karangasem
SIDEMAN                | Other          | Other                 | Karangasem
OTHER EAST BALI        | Other          | Other                 | Karangasem
KINTAMANI              | Other          | Other                 | Bangli
LOVINA                 | Other          | Other                 | Buleleng
MEDEWI                 | Other          | Other                 | Jembrana
NUSA PENIDA            | Other          | Other                 | Klungkung
NUSA LEMBONGAN         | Other          | Other                 | Klungkung
MUNDUK                 | Other          | Other                 | Buleleng
OTHER WEST BALI        | Other          | Other                 | Jembrana / Tabanan
OTHER SOUTH EAST BALI  | Other          | Other                 | Various
GILI ISLANDS           | Non Bali       | Non Bali              | NTB / Lombok
JAVA                   | Non Bali       | Non Bali              | Java
ROTE ISLAND            | Non Bali       | Non Bali              | NTT
MENTAWAI               | Non Bali       | Non Bali              | West Sumatra
SUMBA                  | Non Bali       | Non Bali              | NTT
SUMBAWA                | Non Bali       | Non Bali              | NTB
LOMBOK                 | Non Bali       | Non Bali              | NTB
LABUAN BAJO            | Non Bali       | Non Bali              | NTT
SUMATRA                | Non Bali       | Non Bali              | Sumatra
YOGYAKARTA             | Non Bali       | Non Bali              | DIY
BEKASI                 | Non Bali       | Non Bali              | West Java
SURABAYA               | Non Bali       | Non Bali              | East Java
KALIMANTAN             | Non Bali       | Non Bali              | Kalimantan
JAKARTA                | Non Bali       | Non Bali              | DKI Jakarta
BANDUNG                | Non Bali       | Non Bali              | West Java
OTHER INDONESIAN ISLANDS | Non Bali     | Non Bali              | Various
OTHER                  | Other          | Other                 | Various
Note: Do not add or remove neighbourhoods without updating both the RAG and the AI system prompts.

CRITICAL CLASSIFICATION NOTES: apply before every location response:
- Seminyak = Central Badung (not North Badung)
- Kuta = Central Badung (not North Badung)
- Legian = Central Badung (not North Badung)
- Kerobokan = North Badung
- Umalas = North Badung
- Pererenan = Mengwi (not North Badung)
- Seseh = Mengwi (not Tabanan)
- Kaba Kaba = Tabanan
- Nyanyi = Tabanan
- Sanur = Denpasar
- Mengwi is a distinct REID region within Badung regency: never group Mengwi locations under North Badung
- For any location not in the directory, classify under the nearest parent region and note data may be limited


2026 Q1 BALI REAL ESTATE KEY INSIGHTS

1. The market has entered a phase of controlled consolidation, with supply growth stabilising
Development activity in Q1 2026 remains measured, with available stock accounting for 67% of listings and off-plan supply contained at 33%. This reflects a continuation of the 2025 pipeline contraction, where developers shifted from expansion toward inventory absorption. The stabilisation of apartment share at 13% further reinforces this transition, indicating that diversification has paused following rapid growth across 2024-2025.

2. Apartment pipeline expansion introduces forward absorption and rental risk
While apartments remain a small share of total supply, 79% of inventory is off-plan, highlighting continued developer focus on scaling this segment. However, the concentration of uncompleted projects creates a forward-loaded supply pipeline. As these developments reach completion, the market may face increased competition, impacting both sales absorption and rental performance, particularly if demand growth moderates.

3. Compact assets continue to dominate demand, but supply expansion has slowed
One- and two-bedroom properties remain the primary drivers of transaction activity, accounting for the majority of sales and reinforcing the structural shift toward yield-oriented, accessible assets first established in 2025. However, supply growth within these segments has begun to moderate as developer pipelines tighten, signalling a transition from rapid expansion to consolidation.

4. Sales volume has softened amid regulatory scrutiny and global instability
Transaction activity in Q1 2026 reflects a slowdown in overall sales volume, as buyer sentiment becomes more cautious. Increased focus on regulatory compliance, including zoning (RDTR), building approvals (PBG), and certificates of function (SLF), combined with broader global economic uncertainty, has contributed to longer decision timelines and reduced transaction velocity. This indicates a shift toward a more deliberate and risk-aware buyer profile.

5. Pricing remains resilient, with stability driven by composition rather than growth
Median pricing increased modestly by +0.7% year-on-year despite slower sales activity, reinforcing the market's underlying stability. As in 2025, price movements remain largely compositional, driven by the continued dominance of compact asset transactions rather than systemic value change. This highlights sustained price integrity across categories.

6. A persistent pricing gap reinforces preference for completed, income-ready assets
The price differential between available and off-plan properties remains above 20%, indicating a stable risk-adjusted pricing structure. Completed apartments attract a ~10% premium, while villas command a ~15% premium, reflecting strong buyer preference for operational readiness, immediate rental yield, and reduced delivery risk.

7. Price per square metre shows early signs of competitive pressure
Average price per sqm has softened slightly from the 2025 benchmark of $2,210, suggesting mild pricing compression at the efficiency level. This trend reflects increased competition, particularly within compact segments where supply expanded significantly in prior periods, leading to a gradual normalisation of pricing premiums.

8. Rental market performance remains bifurcated, with occupancy growth offset by revenue decline
Rental occupancy increased by 3.4% year-on-year, demonstrating continued demand resilience and the market's ability to absorb expanding supply. However, total revenue declined by approximately 7%, reflecting ongoing pressure on daily rates as competition intensifies. This divergence reinforces a volume-driven rental environment.

9. Regional divergence is increasing across both sales and rental markets
Performance across regions is becoming more uneven, with some areas benefiting from shifting demand patterns while others face increased competition. South Badung recorded a 10% increase in occupancy, while Central Badung declined by 7%, highlighting changing demand distribution and the growing importance of location-specific performance.

10. Tourism recovery has reached a new structural phase, led by international demand
Total tourist arrivals reached their highest level since 2019, marking a full recovery in travel demand. Foreign arrivals accounted for 42% of total visitors for the first time, indicating a structural shift toward international tourism. This change is likely to influence rental demand patterns, asset performance, and location-specific absorption across the market.

11. The market is increasingly defined by discipline, compliance, and operational execution
Q1 2026 reinforces Bali's transition into a more regulated and performance-driven environment. Regulatory compliance around zoning (RDTR), building approvals (PBG), and certificates of function (SLF) is becoming central to both development feasibility and investment decision-making. As a result, market performance is increasingly determined by product alignment, legal clarity, and operational execution rather than broad-based growth.


2025 TO Q1 2026: CONTINUING THEMES

The structural forces that defined 2025 have carried directly into Q1 2026, confirming that the market's current phase is not a single-year correction but a multi-year recalibration now entering its consolidation stage.

1. Compact asset dominance is sustained. The structural shift toward 1 and 2 bedroom properties, which reached 53% of sales volume in 2025 after growing from under 35% in 2023, has continued into Q1 2026. Supply growth within these segments has moderated as developer pipelines tighten, but compact formats remain the primary driver of both transaction activity and market composition.

2. The occupancy-revenue divergence is deepening. In 2025, occupancy improved approximately 2 percentage points while total rental revenue fell 15%, as rate compression outweighed volume gains. Q1 2026 extends this pattern: occupancy rose a further 3.4% year-on-year while revenue declined approximately 7%. The consistent direction across both periods confirms this is a structural feature of the current market, not a short-term anomaly. Operators are increasingly managing for volume stability over rate recovery.

3. Supply contraction is continuing. Off-plan inventory fell 9% in 2025, and total new build area declined 34% year-on-year to 160,000 sqm. Q1 2026 reflects the downstream effect of this pipeline reduction, with available stock stabilising and off-plan supply contained at 33% of listings. Developer appetite remains measured, with the focus on absorbing existing inventory rather than launching new volume.

4. Pricing softening remains compositional, not systemic. The 2025 median price decline of 2% was driven by the growing weight of compact, lower-value transactions rather than underlying asset depreciation. Q1 2026 reflects the same dynamic, with a modest 0.7% year-on-year increase in median pricing suggesting that per-category values are holding despite continued compositional pressure. Price per sqm has softened slightly from the 2025 benchmark of $2,210, indicating mild efficiency-level compression rather than broad value decline.

5. Regulatory tightening is becoming a structural market condition. The 2025 shift toward a more scrutinised development and investment environment, driven by enforcement of zoning (RDTR), building approvals (PBG), and certificates of function (SLF), has intensified in Q1 2026. Compliance requirements are now a primary driver of buyer decision timelines and developer feasibility assessments, reinforcing a longer-term transition from a relationship-based market to one defined by formal legal and operational standards.


2025 BALI REAL ESTATE KEY INSIGHTS

The Bali property market in 2025 underwent a decisive recalibration following the accelerated growth cycle experienced between 2022 and 2024. This year marked a shift toward structural consolidation, as both supply and transaction volumes moderated across key segments. Developer sentiment adjusted to evolving demand patterns, with a strategic pivot toward compact and efficiently designed assets that responded to affordability pressures without compromising on yield potential.

Supply pipelines narrowed, particularly within off-plan inventory, indicating a more selective approach to project releases. While aggregate prices showed signs of softening, the decline largely reflects a compositional shift toward smaller format sales rather than a deterioration in asset value. Developers increasingly prioritised density and land efficiency, as evidenced by a multi-year contraction in average build size and concurrent rise in floor space ratios.

In the rental market, a substantial increase in available stock placed downward pressure on daily rates. However, occupancy levels remained steady, supported by consistent inbound demand and strategic rate recalibrations. Revenue metrics declined year-on-year, driven primarily by pricing compression and an altered asset mix, with compact properties gaining market share.

Collectively, 2025 signals the emergence of a more mature and disciplined marketplace. The prevailing theme is one of recalibrated growth, with the market poised for performance grounded in operational sophistication and sustainable delivery.

Key headline figures:
- Total market median prices softened, falling -2%. Overall market values stayed stable, but downward pressure from off-plan and apartment sales nudged market prices slightly lower.
- 1 & 2 bed assets now lead the market in sales volume at over 53%. A heavier concentration of smaller asset sales has materially affected market medians, as opposed to material value decline.
- Rental occupancies performed up to 2 percentage points above 2024 levels. Averaging around 53% across the entire market for 2025.
- Rental competition intensified with 12% growth in total available supply.
- 2025 registered over 4,800 property transactions; -5% YoY.
- Total combined sales value over $2B; -9% YoY (driven by increased buyer demand for smaller, lower-value assets).
- New project square meterage fell: just over 160,000 sqm launched in 2025, vs 244,000 sqm peak in 2024.
- Rental revenue declined to $1.2B for 2025; -15% YoY (driven by rate compression despite 2pp occupancy gain).


SUPPLY TRENDS

The supply landscape in 2025 demonstrated strategic contraction, with developers scaling back volumes while rebalancing regional focus. The decline in new inventory was matched by changes in product composition, favouring mid-sized and compact assets. North Badung's dominance tapered, while South Badung and emerging precincts gained ground.

Leasehold properties continued to dominate, comprising 80.6% of total supply. The modest presence of freehold (19.4%) remains constrained by access limitations for foreign buyers, reinforcing leasehold's role as the principal transaction structure.

Available properties by bedroom category:
TYPE      | 1 BED | 2 BED | 3 BED | 4 BED | 5 BED | 6 BED+
VILLA     | 875   | 3,278 | 3,595 | 2,140 | 985   | 375
APARTMENT | 1,055 | 137   | 25    | 0     | 0     | 0
TOTAL     | 1,930 | 3,415 | 3,620 | 2,140 | 985   | 375

Over 12,300 total properties for sale; -7% YoY.
2 Bedroom market share = 32%; +8% YoY.
Two-bedroom and three-bedroom assets maintained their lead, comprising 27.8% and 29.4% of listings respectively. One-bedroom units accounted for 15.7% of supply.

Development status breakdown:
Available vs Off-Plan: 67% available, 33% off-plan.
Villa vs Apartment: 86% villa, 14% apartment.

        | AVAILABLE | OFF PLAN
VILLAS  | 72%       | 28%
APARTMENTS | 75%    | 25%

Over 3,230 total off-plan properties for sale; -9% YoY.
Apartment market share up to 13.8%; +44% YoY.
Off-plan apartment supply declined sharply by 55% YoY. Off-plan villa inventory fell 12% YoY to 2,390 units.

Supply by region:
REGION          | MARKET SHARE
Central Badung  | 7.1%
Denpasar        | 3.6%
Gianyar         | 8.8%
Mengwi          | 17.2%
North Badung    | 34.9%
South Badung    | 21.6%
Tabanan         | 6.8%

North Badung retained the largest supply share (34.9%) despite a 22% YoY contraction in available properties.
South Badung grew its market share to 22% (+13% YoY), positioning itself as an increasingly strategic growth corridor.


SALES TRENDS

Sales activity in 2025 reflected a maturing buyer base with sharpened focus on efficient, income-generating formats. Compact dwellings dominated transactions while freehold premiums held firm.

Sales volume by bedroom category:
1 BED  | 2 BED  | 3 BED  | 4 BED  | 5 BED  | 6 BED+
20.8%  | 31.9%  | 26.4%  | 13.2%  | 6.2%   | 1.5%

Two-bedroom assets captured 31.9% of sales. Three-bedroom properties followed at 26.4%. One-bedroom properties made up 20.8%.
1 & 2 bedroom property sales volume = 53%; +51% over 36 months.
Over 4,800 total property sales across 2025; -5% YoY.

Median prices:
Median Leasehold property price = $280k; -5% change across 36 months.
Median Freehold property price = $505k; +10% change across 36 months.

Leasehold median prices declined -5% over the past three years to $280k. This reflects the market's compositional shift toward compact asset sales rather than actual depreciation. Freehold values rose 10% over the same period, underscoring sustained appreciation.

Price by bedroom category (YoY):
        | 1 BED  | 2 BED  | 3 BED  | 4 BED  | 5 BED  | 6 BED  | MEDIAN
2024    | $160k  | $246k  | $346k  | $506k  | $786k  | $800k  | $285k
2025    | $161k  | $246k  | $347k  | $530k  | $795k  | $800k  | $280k
Change  | +0.6%  | 0%     | +0.3%  | +4.7%  | +1.1%  | 0%     | -2.1%

Price by region (YoY):
              | Central Badung | Denpasar | Gianyar | Mengwi | North Badung | South Badung | Tabanan
2024          | $295k          | $328k    | $298k   | $305k  | $297k        | $247k        | $276k
2025          | $289k          | $320k    | $290k   | $295k  | $295k        | $247k        | $259k
Change        | -2%            | -2.4%    | -2.7%   | -3.3%  | -0.7%        | 0%           | -6.2%

Price movements remained contained, with sub -1% changes across most typologies. The most notable adjustment was in Tabanan (-6.2%), likely driven by a growing concentration of compact, lower-value stock in the transaction mix. Leasehold and multi-bedroom segments held firm, suggesting that price softening is largely compositional rather than systemic.


BUILT TRENDS

Average property sizes remained stable across configurations in 2025, signalling the end of the downsizing trend that characterised the prior two years.

Average property size by bedroom:
1 BED    | 2 BED   | 3 BED   | 4 BED   | 5 BED   | 6 BED+  | MARKET AVG
65 sqm   | 140 sqm | 230 sqm | 352 sqm | 488 sqm | 471 sqm | 201 sqm

Average Bali property size = 201 sqm; -18% 36-month change.
Average floor space ratio (FSR) = 83%; +3% YoY.
Average villa size declined to 229 sqm; -3% YoY.
160,000 sqm total new build in 2025; -34% YoY.

Average property size by bedroom and region (sqm):
              | 1 BED | 2 BED | 3 BED | 4 BED | 5 BED | 6 BED+
Central Badung| 57    | 155   | 251   | 350   | 496   | 470
Denpasar      | 48    | 160   | 219   | 393   | 406   | 517
Gianyar       | 87    | 158   | 246   | 427   | 427   | 487
Mengwi        | 76    | 148   | 248   | 333   | 514   | 628
North Badung  | 65    | 145   | 229   | 348   | 481   | 575
South Badung  | 62    | 137   | 213   | 388   | 477   | 563
Tabanan       | 65    | 147   | 244   | 373   | 531   | 701

Average price per sqm by type and bedroom:
TYPE      | 1 BED  | 2 BED  | 3 BED  | 4 BED  | 5 BED  | 6 BED+
VILLA     | $2,530 | $1,940 | $1,770 | $1,875 | $2,090 | $2,005
APARTMENT | $3,505 | $2,580 | n/a    | n/a    | n/a    | n/a
TOTAL     | $3,077 | $1,972 | $1,742 | $1,839 | $1,990 | $1,976

$2,210 market average sqm price; +2% YoY.
$3,400 apartment average sqm price; -1% YoY.

Average price per sqm by region and bedroom:
              | 1 BED  | 2 BED  | 3 BED  | 4 BED  | 5 BED  | 6 BED+
Central Badung| $3,950 | $1,990 | $1,565 | $1,605 | $1,745 | $1,695
Denpasar      | $3,180 | $1,770 | $2,160 | $1,615 | $1,995 | $1,250
Gianyar       | $2,290 | $1,910 | $1,685 | $1,915 | $2,400 | $1,940
Mengwi        | $2,535 | $1,905 | $1,740 | $1,855 | $2,080 | $2,010
North Badung  | $3,130 | $1,955 | $1,740 | $1,855 | $2,080 | $2,010
South Badung  | $3,170 | $2,090 | $2,050 | $1,985 | $2,045 | $2,155
Tabanan       | $2,745 | $1,785 | $1,520 | $1,640 | $1,800 | $1,980

Regional price data reveal the highest values in North and Central Badung, with average rates surpassing $3,000 per sqm across several bedroom types. Lower sqm rates in peripheral regions, particularly Tabanan and Gianyar, reflect affordability-led appeal with secondary investor focus.


RENTAL TRENDS

Rental markets in 2025 exhibited operational resilience under pressure. Expanding supply placed downward pressure on daily rates and total revenue, but occupancy levels improved year-on-year. The rental sector is increasingly bifurcated: high-performing submarkets are adapting through rate recalibration and lean operations, while lower-performing assets face absorption and revenue challenges.

Rental supply by region:
REGION          | MARKET SHARE
Central Badung  | 10.8%
Denpasar        | 6.2%
Gianyar         | 12.2%
Mengwi          | 4.1%
North Badung    | 46.9%
South Badung    | 17%
Tabanan         | 2.7%

53% Bali market average occupancy; +2% YoY.
44,490 total rental properties; +107% over 36 months.
Despite a 107% increase in rental supply over the past three years, market occupancy improved modestly to 53% (+2% YoY).

Average occupancy by bedroom and region:
              | 1 BED | 2 BED | 3 BED | 4 BED | 5 BED | 6 BED+
Central Badung| 50%   | 51%   | 56%   | 55%   | 56%   | 57%
Denpasar      | 61%   | 64%   | 61%   | 60%   | 65%   | 60%
Gianyar       | 59%   | 61%   | 59%   | 59%   | 60%   | 60%
Mengwi        | 61%   | 62%   | 58%   | 55%   | 45%   | 45%
North Badung  | 61%   | 59%   | 59%   | 56%   | 52%   | 59%
South Badung  | 57%   | 62%   | 54%   | 51%   | 51%   | 50%
Tabanan       | 41%   | 52%   | 45%   | 43%   | 46%   | 34%

57% 1-bedroom occupancy South Badung; +7pp YoY.
55% average 3-bedroom occupancy; -8pp YoY.

Occupancy by asset size (YoY):
              | 1-3 BED | 4-6 BED
2024          | 50%     | 50%
2025          | 63%     | 37%

$1.21B 2025 total rental revenue; -15% YoY.
South Badung share of total revenue 18%; +17% YoY.
Total rental revenue declined 15% YoY to $1.21B, driven by declining daily rates and a shifting composition toward compact assets.

Average daily rate by bedroom and region:
              | 1 BED | 2 BED | 3 BED | 4 BED | 5 BED  | 6 BED+
Central Badung| $70   | $106  | $173  | $273  | $369   | $596
Denpasar      | $63   | $118  | $208  | $352  | $503   | $563
Gianyar       | $64   | $106  | $201  | $291  | $382   | $514
Mengwi        | $78   | $105  | $169  | $285  | $655   | $944
North Badung  | $87   | $117  | $195  | $329  | $485   | $752
South Badung  | $103  | $154  | $254  | $411  | $619   | $779
Tabanan       | $74   | $129  | $186  | $292  | $569   | $938

$178 2025 market average daily rate (ADR); -14% YoY.
$226 2025 professionally managed property average ADR; -26% YoY.
Despite the broad reduction, premium configurations particularly in North and South Badung retained pricing power. Operators are increasingly focusing on volume stability rather than price expansion.


BALI KEY MARKETS

BERAWA
Berawa continues to function as one of Bali's core lifestyle investment corridors. Its relatively large supply base and strong pricing trajectory indicate a mature yet resilient market. The area attracts investors seeking established infrastructure, walkability, and consistent rental performance. With mid-to-upper pricing tiers and steady transaction activity, Berawa positions itself as a balanced, high-liquidity coastal market rather than a speculative growth play.
Supply: 840+ | Median Price: $394k (+0.5%) | 2025 Sales: 250+ (-20%)
Largest category: 3 bed | Avg size: 265 sqm (+1.5%) | Avg $/sqm: $2,210 (0%) | Avg lease term: 25 yrs (0%)

BINGIN
Bingin represents a boutique coastal enclave characterised by tighter supply and focused product composition. The prevalence of smaller format villas aligns with its positioning as a lifestyle-driven market appealing to shorter-stay rental demand and individual investors. Price appreciation without excessive supply expansion reinforces its reputation as a niche but desirable southern peninsula location.
Supply: 160+ | Median Price: $306k (-0.9%) | 2025 Sales: 230+ (+5%)
Largest category: 2 bed | Avg size: 190 sqm (+1%) | Avg $/sqm: $2,330 (+1.5%) | Avg lease term: 28 yrs (0%)

CANGGU
Canggu remains the structural centre of Bali's villa market. As the island's largest market by supply and sales volume, it anchors investor activity and sets pricing benchmarks for surrounding areas. Its broad stock profile and sustained absorption reflect both end-user demand and rental-led acquisition. Canggu operates as the liquidity engine of Bali's west coast, with scale supporting pricing stability.
Supply: 1,300+ | Median Price: $350k (+2.5%) | 2025 Sales: 490+ (-2%)
Largest category: 3 bed | Avg size: 255 sqm (+3%) | Avg $/sqm: $2,070 (+1%) | Avg lease term: 26 yrs (0%)

PERERENAN
Pererenan has transitioned from an extension of Canggu into a premium submarket in its own right. Larger villa formats and stronger median pricing growth indicate movement toward higher-end residential positioning. The area attracts buyers seeking proximity to Canggu's amenities while favouring lower density and more residential character. Its performance profile suggests consolidation into Bali's upper-tier coastal bracket.
Supply: 870+ | Median Price: $399k (-1.4%) | 2025 Sales: 390+ (-9%)
Largest category: 3 bed | Avg size: 285 sqm (-2%) | Avg $/sqm: $2,215 (+9%) | Avg lease term: 27 yrs (0%)

SANUR
Sanur operates as a more traditional, family-oriented coastal market on the island's east side. Pricing growth alongside softer per-square-metre movement suggests larger residential-style villas rather than compact rental stock. Compared to west coast hubs, Sanur reflects a steadier, end-user driven environment with moderate turnover and less speculative supply expansion.
Supply: 390+ | Median Price: $386k (+4.3%) | 2025 Sales: 110+ (-8%)
Largest category: 3 bed | Avg size: 285 sqm (-1%) | Avg $/sqm: $2,060 (+8%) | Avg lease term: 27 yrs (+1%)

SEMINYAK
Seminyak represents one of Bali's original prime villa markets. While pricing remains elevated, relative moderation in per-square-metre growth and shorter lease terms suggest a mature cycle phase. The area continues to command recognition and infrastructure advantage, but its profile reflects consolidation rather than acceleration. It functions as an established premium address with stable but measured activity.
Supply: 730+ | Median Price: $357k (-0.5%) | 2025 Sales: 230+ (+5%)
Largest category: 3 bed | Avg size: 200 sqm (-2.5%) | Avg $/sqm: $1,975 (+2%) | Avg lease term: 23 yrs (+2%)

UBUD
Ubud occupies a distinct inland niche centred on wellness, retreat, and longer-stay residency. Market behaviour reflects steady demand rather than rapid growth, with larger villas and moderate pricing positioning. Unlike coastal tourism hubs, Ubud's appeal lies in lifestyle differentiation, drawing buyers seeking tranquillity and natural surroundings. Its performance profile suggests stability over volatility.
Supply: 890+ | Median Price: $313k (+1.7%) | 2025 Sales: 270+ (+1%)
Largest category: 3 bed | Avg size: 265 sqm (-5%) | Avg $/sqm: $1,930 (+7%) | Avg lease term: 26 yrs (0%)

ULUWATU
Uluwatu stands out for structural repositioning. The shift toward smaller villas combined with elevated per-square-metre pricing indicates densification of premium cliffside and ocean-view product. Despite softer median values, the area demonstrates strong absorption, reflecting continued demand for compact, high-yield formats. Uluwatu increasingly caters to design-led, view-oriented developments rather than expansive residential compounds.
Supply: 735+ | Median Price: $287k (-5.6%) | 2025 Sales: 400+ (+2%)
Largest category: 2 bed | Avg size: 210 sqm (-10%) | Avg $/sqm: $2,225 (-2%) | Avg lease term: 31 yrs (-7%)

UMALAS
Umalas reflects one of the clearest moves toward upper-tier residential positioning. Larger average villa sizes and strong median pricing growth signal buyer appetite for expansive properties within proximity to Canggu and Seminyak. Rather than functioning as a short-term rental hotspot, Umalas aligns more closely with private residential and long-stay investors, supporting its premium orientation.
Supply: 830+ (-10% YoY) | Median Price: $391k (+6%) | 2025 Sales: 300+ (+6%)
Largest category: 3 bed | Avg size: 300 sqm (+0.5%) | Avg $/sqm: $1,860 (+2.6%) | Avg lease term: 26 yrs (0%)

UNGASAN
Ungasan represents a more price-accessible southern market relative to Uluwatu. Softer pricing metrics and smaller average formats indicate repositioning toward entry-level and mid-market buyers. While sales activity remains active, its overall scale and price correction suggest an adjustment phase rather than premium consolidation.
Supply: 275+ | Median Price: $260k (-4%) | 2025 Sales: 220+ (+0.5%)
Largest category: 3 bed | Avg size: 220 sqm (-10%) | Avg $/sqm: $1,775 (-1.2%) | Avg lease term: 20 yrs (0%)


BALI EMERGING MARKETS

BALANGAN
Balangan operates as a secondary southern enclave with limited supply and measured demand. Pricing moderation and compact villa formats suggest early-stage development activity. The area appeals to buyers seeking exposure to the Bukit Peninsula at lower entry points compared to Uluwatu, though liquidity remains comparatively modest.
Supply: 120+ | Median Price: $274k (+5.9%) | 2025 Sales: 90+ (+12%)
Largest category: 3 bed | Avg size: 195 sqm (+0.7%) | Avg $/sqm: $2,165 (+1.1%) | Avg lease term: 29 yrs (-6%)

KABA KABA
Kaba Kaba reflects a nascent inland market with minimal supply and low transaction depth. Its pricing recalibration and moderate villa sizing indicate a developmental phase rather than established demand concentration. The area's growth trajectory will likely depend on infrastructure expansion and spillover from western coastal hubs.
Supply: 75+ | Median Price: $279k (+2%) | 2025 Sales: 55+ (-7%)
Largest category: 3 bed | Avg size: 310 sqm (-2.4%) | Avg $/sqm: $1,665 (+6.4%) | Avg lease term: 28 yrs (-3%)

NYANYI
Nyanyi presents a contrasting profile among emerging areas. Despite limited transaction volume, pricing indicators suggest premium aspirations, supported by proximity to high-end resort and master-planned developments. It occupies a strategic position between Canggu expansion zones and lower-density coastal land, positioning it as a potential high-value niche rather than a mass-market location.
Supply: 145+ | Median Price: $600k (+0.3%) | 2025 Sales: 60+ (-3.2%)
Largest category: 2 bed | Avg size: 280 sqm (-10%) | Avg $/sqm: $2,530 (+8.9%) | Avg lease term: 29 yrs (-2.3%)

PADONAN
Padonan functions as an affordability-driven extension of Canggu. Price compression and mid-sized villas suggest repositioning toward accessible entry points for investors priced out of core areas. While demand remains moderate, its identity is closely tied to spillover activity rather than independent destination appeal.
Supply: 160+ | Median Price: $258k (+0.1%) | 2025 Sales: 70+ (-12%)
Largest category: 3 bed | Avg size: 200 sqm (-2.9%) | Avg $/sqm: $1,690 (+1%) | Avg lease term: 25 yrs (+0.5%)

SESEH
Seseh reflects an emerging coastal residential enclave with relatively larger villas and premium ambitions. However, recent pricing adjustments suggest recalibration following earlier growth phases. Its appeal lies in low-density beachfront positioning, though absorption remains measured relative to more central west coast locations.
Supply: 180+ (-11% YoY) | Median Price: $375k (+2.1%) | 2025 Sales: 80+ (-2%)
Largest category: 3 bed | Avg size: 310 sqm (-2%) | Avg $/sqm: $1,670 (+6.4%) | Avg lease term: 29 yrs (-3%)


BALI REGULATORY LANDSCAPE

Overview
Property acquisition and development in Bali remains viable for foreign investors, but it is no longer a lightly regulated environment. Over the past two years, both the Provincial Government of Bali and central authorities have materially increased enforcement around zoning compliance, building approvals, and tourism licensing. The focus has shifted from structural permissibility to operational compliance.

At a structural level, foreign participation must sit within Indonesia's recognised land rights framework. Direct individual freehold ownership is not available to foreign individuals. Investment therefore requires a properly structured approach: either through an individual right of use (Hak Pakai) for residential occupation, a foreign investment company (PT PMA) for commercial development, or a private lease arrangement supported by robust documentation.

The more significant compliance risk today sits in land use alignment and licensing. Authorities are actively reviewing villas and small-scale hospitality assets operating without correct zoning, building approvals, or tourism licences. Properties constructed without the appropriate building approval (PBG) or lacking a certificate confirming lawful function (SLF) may face restrictions on use.

For developers, feasibility must now incorporate spatial planning (RDTR) verification at the outset. For investors purchasing existing assets, due diligence must extend beyond title validity to include zoning designation, construction approvals, operational permits, and corporate compliance where applicable.

Bali has moved from a relationship-based, documentation-light market to one that demands formal registration, licensing alignment, and transparent business structuring. Well-structured projects with correct approvals continue to operate without issue. Informal or partially compliant arrangements carry growing risk.

Ownership Structures
1. Right of Use (Hak Pakai)
Hak Pakai is the primary title available to foreign individuals holding a valid Indonesian residence permit (KITAS or KITAP). It grants a state-recognised, time-bound right to use and occupy residential property. It does not provide full ownership but offers a legally recognised tenure that may be extended under prevailing regulations.

2. Right to Build (Hak Guna Bangunan / HGB) via PT PMA
HGB allows the holder to construct and commercially utilise buildings on land not held under freehold. Foreign individuals cannot hold HGB directly and must establish a PT PMA. HGB is typically granted for 30 years and may be extended in stages up to approximately 80 years, subject to regulation.

3. Leasehold
Leasehold is a private contractual arrangement between landowner and tenant. It is not a state-recognised land title under Indonesian agrarian law. The lease is granted for a fixed term agreed between the parties. Because protections depend on contract structure rather than statutory land rights, risk and enforceability are determined by due diligence and documentation.

Required Documents Before Buying
1. Land Certificate: Hak Pakai or HGB
The land certificate must clearly reflect the correct title and be formally registered with the Badan Pertanahan Nasional (BPN). This is the primary proof of legal tenure and confirms the validity, duration, and classification of the land right.

2. PBG and SLF: Building Approval and Certificate of Proper Function
The PBG (Persetujuan Bangunan Gedung) confirms that the building has received formal construction approval under current regulations, replacing the former IMB system. The SLF (Sertifikat Laik Fungsi) certifies that the completed building is fit for use and compliant with safety and zoning requirements.

3. Lease Agreement (Leasehold)
For long-term leasehold acquisitions, a formal Lease Agreement must be executed, typically before a Notary or Land Deed Official (PPAT). The agreement should clearly define: lease duration, extension rights, transfer provisions, and renovation and structural permissions.

4. NIB and Tourism Business Licence
If the villa is to be operated as short-term or long-term rental accommodation, a Business Identification Number (Nomor Induk Berusaha / NIB) and the relevant tourism operational licence are required.

5. OSS Registration: Online Single Submission
All business licensing, including NIB issuance and sector approvals, is processed through Indonesia's Online Single Submission (OSS) system. OSS registration applies to both individuals and PT PMA entities engaging in rental activity.
`;
