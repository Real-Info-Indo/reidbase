# Fix Y axis widths per chart instead of one fixed value

The single 40px Y axis width now suits number-only charts but clips or wraps longer labels such as `1,250 sqm`, `25.5 yrs` and `$12,500`, while short labels look over-indented. Fix: size the axis to the labels each chart actually renders, and keep units out of the axis where they add no meaning.

## Changes

All in `src/components/dashboard/charts.tsx` (presentation only):

1. Add an optional `axisFormat` prop alongside the existing `format` prop on every numeric-axis chart. `format` keeps full units for tooltips and KPIs; `axisFormat` renders the compact axis label. Where not supplied, the axis falls back to `format`.
2. Add a small internal helper that estimates the needed axis width from the longest formatted tick label (character count at 11px, clamped to roughly 28-62px) and pass it to `YAxis width`, keeping `tickMargin={4}`. This gives short numeric axes a tight left edge aligned with the card title, and gives longer labels enough room without wrapping. Set `tick={{ ...AXIS }}` with no wrapping so labels stay single-line.
3. Add compact axis formatters in `src/components/dashboard/primitives.tsx`:
   - sqm axis: numeric only, no `sqm` suffix (unit stays in the chart subtitle and tooltip)
   - years axis: numeric only, no `yrs` suffix
   - exact USD axis: compact form (`$12.5K`, `$1.25M`) rather than the full `$12,500`
   - percent and count axes: unchanged
4. In `src/components/dashboard/modules.tsx`, pass the compact `axisFormat` to the charts that use `formatSqm`, `formatYears` and `formatUsdExact` (build size, lease, price per sqm, price per year, ADR, revenue). Tooltips keep the full formatter.
5. For `BedsBarChart` in horizontal-bar layout, size the category axis to the `"N bed"` labels (they are short and fixed) instead of the shared numeric width.

Charts, colours, heights, data and layout logic stay untouched.

## Verification

Screenshot each dashboard tab at the current viewport and confirm: no axis label is clipped or wrapped to two lines, the leftmost label sits at the card title edge on numeric charts, and unit context is still visible in the subtitle or tooltip.
