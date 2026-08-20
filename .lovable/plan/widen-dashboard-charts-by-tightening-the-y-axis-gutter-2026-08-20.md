# Widen dashboard charts by tightening the Y axis gutter

The charts on /dashboard-v2 leave dead space between the card edge and the Y axis labels, so the plot area is narrower than it needs to be. The goal: Y axis labels start at the same left edge as the chart card title, the small gap between labels and the plotted area stays, and the plot area gains that reclaimed width.

## Changes

All in `src/components/dashboard/charts.tsx` (presentation only, no data or layout logic changes):

- Reduce the reserved Y axis width from 56px (48px on the volume chart) to a tighter value sized to the actual formatted labels (~38-42px), so the axis no longer over-reserves space.
- Left-align the axis gutter with the card title by removing the residual left inset: set chart `margin.left` to 0 (or a small negative value where recharts still pads) and keep a `tickMargin` of ~4px so the labels do not touch the grid lines.
- Apply the same treatment consistently to every chart that renders a numeric Y axis: `MonthLineChart`, `MonthBarChart`, `BedsBarChart` (both layouts, including the category axis width for horizontal bars), `TenureBedsChart`, and `VolumeLinesChart`.
- Leave the right margin, chart heights, donut chart, colours, and formatters untouched.

## Verification

Screenshot each dashboard tab at the current viewport to confirm the leftmost Y axis label lines up with the card title text, the label-to-plot gap is preserved, and no labels are clipped on the longest values (for example `$1.25M`).
