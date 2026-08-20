# Measure axis labels properly so nothing clips or wraps

Two problems remain with the estimated axis widths: the character-count estimate under-reserves for labels containing `$`, so the currency symbol clips; and the bedroom category axis wraps `1 bed` onto two lines because recharts wraps its tick text at the axis width when that width is tight.

## Changes

In `src/components/dashboard/charts.tsx` only:

1. Replace the character-count estimate with real text measurement: a small memoised helper that measures label strings on a cached 2D canvas context using the app's actual axis font (`11px` Poppins with the sans-serif fallback), returning the widest measured label. Fall back to a conservative character estimate if canvas is unavailable.
2. Reserve measured width plus a fixed padding allowance (label-to-grid gap plus a couple of pixels of safety), clamped to a sensible min/max, so `$1.25M` and `$12,500` never clip.
3. For the bedroom category axis on `BedsBarChart` (horizontal-bar layout), measure the `"N bed"` labels the same way and add enough headroom that recharts never wraps them, and set the tick renderer so category labels stay on a single line.
4. Sample tick candidates more realistically for numeric axes: include min, midpoint and max, plus the negative form where any value is negative, so the widest possible tick is covered.

No changes to colours, heights, data flow, formatters in `primitives.tsx`, or module layout.

## Verification

Screenshot every dashboard tab and check: no `$` clipped on price per sqm, price per year, ADR and revenue charts; bedroom labels on one line; numeric-only axes still tight to the card title edge.
