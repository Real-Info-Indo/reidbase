# Market Overview dashboard refinements

Scope: the Market overview module only (`/dashboard-v2`). Other modules keep their current layout and data.

## Layout

Two rows inside the chart area, on the existing 3-column grid.

```text
Row 1: [ Ownership type (square) ] [ Median sold price  (2 cols) ]
Row 2: [ Rental property supply  ] [ Available property supply (2 cols) ]
```

- Ownership type: card becomes a square frame, with the donut scaled up to fill it.
- Median sold price: widens to two columns and matches the square card's height.
- Rental property supply and Available property supply: both cards stretch to the same height so their bottoms align.

## Chart details

- Available property supply (stacked tenure bars):
  - Freehold rendered on top of the stack, Leasehold below.
  - Rounded corners only on the outer top of the stack; the joint between the two segments is square.
  - Legend restyled to match the Ownership type donut legend (same size, charcoal text, same vertical offset).

## Data

Confirmed against the database:

- Rental property supply chart currently sums bedroom counts across every month in the rentals table (about 2.09m). It will instead use only the latest month present in the filtered set (June 2026), which gives 1 bed 21,749, 2 bed 13,608, 3 bed 11,016, 4 bed 4,779, 5 bed 2,099, 6 bed 2,668.
- Rental records scorecard uses the same all-months sum today. It will use the same latest-month basis as the chart, so it will read 55,919 rather than 2,094,225.
- Available properties scorecard: display the full number with thousands separators (11,429 rather than the abbreviated form).
- Clearance rate: change to a period-based calculation, defaulting to the trailing 12 months. Sold properties in the period divided by (total available properties currently plus sold properties in the period), as a percentage. The period follows the dashboard date filters when set, otherwise the trailing 12-month window already used by the charts. On the current data that window is July 2025 to June 2026, with 4,274 sold and 11,429 total available, giving 27.2% rather than the 59.1% shown today.

## Technical notes

- `src/components/dashboard/modules.tsx`: restructure `MarketOverviewModule` chart grid into the two rows above, with column spans and equal-height cards.
- `src/components/dashboard/primitives.tsx` / `charts.tsx`: add a square/fill frame option for the donut, order the tenure bars with Freehold on top and set per-segment radii, and share the donut legend styling with `TenureBedsChart`.
- Scorecard formatting: use an exact thousands-separated formatter for Available properties and Rental records instead of `formatCount`.
- Database function `public.reid_dashboard_metrics` (market-overview branch): scope `rental_supply_by_beds` and the `rental_records` KPI to `max(reid_month(date))` of the filtered rentals set, via a migration.
