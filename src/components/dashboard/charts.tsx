import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BedsPoint, BedsTenurePoint, MonthPoint, SlicePoint, VolumePoint } from "@/lib/dashboardApi";
import { EmptyChart, formatMonth } from "./primitives";

/** Charts fill a viewport-derived frame so modules fit without page scrolling. */
function ChartFrame({ children }: { children: React.ReactNode }) {
  return <div className="h-[var(--chart-h,200px)] w-full">{children}</div>;
}

const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;
const GRID = "hsl(var(--border))";

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  fontSize: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
} as const;

type Fmt = (v: number | null | undefined) => string;

function hasData(rows: unknown[] | null | undefined): boolean {
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Estimate the Y axis gutter from the widest label the chart will actually
 * render, so short numeric axes sit tight against the card title edge and
 * longer labels stay on one line.
 */
function axisWidth(values: Array<number | null | undefined>, fmt: Fmt): number {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return 32;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const samples = [max, min, min + (max - min) / 2];
  const longest = Math.max(...samples.map((v) => fmt(v).length));
  return Math.min(62, Math.max(28, Math.round(longest * 6.3) + 8));
}

/** Longest category label width (single line, 11px). */
function categoryWidth(labels: string[]): number {
  if (labels.length === 0) return 32;
  const longest = Math.max(...labels.map((l) => l.length));
  return Math.min(70, Math.max(28, Math.round(longest * 6.3) + 8));
}

/** Smooth line, optional gradient fill under the curve. */
export function MonthLineChart({
  data,
  colour,
  format,
  axisFormat,
  gradient = false,
  baseline = false,
}: {
  data: MonthPoint[] | null | undefined;
  colour: string;
  format: Fmt;
  axisFormat?: Fmt;
  gradient?: boolean;
  baseline?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  if (!hasData(data)) return <EmptyChart />;
  const rows = (data ?? []).map((d) => ({ ...d, label: formatMonth(d.month) }));
  const tickFmt = axisFormat ?? format;
  const width = axisWidth(rows.map((r) => r.value), tickFmt);

  return (
    <ChartFrame><ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity={gradient ? 0.35 : 0} />
            <stop offset="100%" stopColor={colour} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={width}
          tickMargin={4}
          tickFormatter={(v) => tickFmt(Number(v))}
          domain={baseline ? ["auto", "auto"] : undefined}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => format(Number(v))} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={colour}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer></ChartFrame>
  );
}

export function MonthBarChart({
  data,
  colour,
  format,
  axisFormat,
}: {
  data: MonthPoint[] | null | undefined;
  colour: string;
  format: Fmt;
  axisFormat?: Fmt;
}) {
  if (!hasData(data)) return <EmptyChart />;
  const rows = (data ?? []).map((d) => ({ ...d, label: formatMonth(d.month) }));
  const tickFmt = axisFormat ?? format;
  const width = axisWidth(rows.map((r) => r.value), tickFmt);

  return (
    <ChartFrame><ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={width}
          tickMargin={4} tickFormatter={(v) => tickFmt(Number(v))} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => format(Number(v))} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" fill={colour} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer></ChartFrame>
  );
}

export function DonutChart({
  data,
  colours,
  format,
}: {
  data: SlicePoint[] | null | undefined;
  colours: string[];
  format: Fmt;
}) {
  if (!hasData(data)) return <EmptyChart />;
  const rows = (data ?? []).filter((d) => d.value != null && d.value > 0);
  if (rows.length === 0) return <EmptyChart />;
  const total = rows.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <ChartFrame><ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2}>
          {rows.map((row, i) => (
            <Cell key={row.name} fill={colours[i % colours.length]} stroke="none" />
          ))}
        </Pie>
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(name: string) => {
            const row = rows.find((r) => r.name === name);
            const share = row && total ? ((row.value ?? 0) / total) * 100 : null;
            return `${name} ${share != null ? `${share.toFixed(1)}%` : ""}`;
          }}
          wrapperStyle={{ fontSize: 11 }}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => format(Number(v))} />
      </PieChart>
    </ResponsiveContainer></ChartFrame>
  );
}

export function BedsBarChart({
  data,
  colour,
  format,
  axisFormat,
  layout = "vertical",
}: {
  data: BedsPoint[] | null | undefined;
  colour: string;
  format: Fmt;
  axisFormat?: Fmt;
  /** "vertical" renders horizontal bars (bedrooms on the Y axis). */
  layout?: "vertical" | "horizontal";
}) {
  if (!hasData(data)) return <EmptyChart />;
  const rows = (data ?? []).map((d) => ({ ...d, label: `${d.beds} bed` }));
  const tickFmt = axisFormat ?? format;
  const numericWidth = axisWidth(rows.map((r) => r.value), tickFmt);
  const catWidth = categoryWidth(rows.map((r) => r.label));

  return (
    <ChartFrame><ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout={layout} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={layout === "vertical"} horizontal={layout === "horizontal"} />
        {layout === "vertical" ? (
          <>
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => tickFmt(Number(v))} />
            <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={catWidth}
          tickMargin={4} />
          </>
        ) : (
          <>
            <XAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis type="number" tick={AXIS} tickLine={false} axisLine={false} width={numericWidth}
          tickMargin={4} tickFormatter={(v) => tickFmt(Number(v))} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => format(Number(v))} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" fill={colour} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer></ChartFrame>
  );
}

export function TenureBedsChart({
  data,
  colours,
  format,
  axisFormat,
  stacked = true,
}: {
  data: BedsTenurePoint[] | null | undefined;
  colours: [string, string];
  format: Fmt;
  axisFormat?: Fmt;
  stacked?: boolean;
}) {
  if (!hasData(data)) return <EmptyChart />;
  const rows = (data ?? []).map((d) => ({ ...d, label: `${d.beds} bed` }));
  const tickFmt = axisFormat ?? format;
  const peaks = rows.map((r) =>
    stacked ? (r.freehold ?? 0) + (r.leasehold ?? 0) : Math.max(r.freehold ?? 0, r.leasehold ?? 0),
  );
  const width = axisWidth([0, ...peaks], tickFmt);

  return (
    <ChartFrame><ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={width}
          tickMargin={4} tickFormatter={(v) => tickFmt(Number(v))} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => format(Number(v))} cursor={{ fill: "hsl(var(--muted))" }} />
        <Legend verticalAlign="bottom" height={26} wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="freehold"
          name="Freehold"
          stackId={stacked ? "tenure" : undefined}
          fill={colours[0]}
          radius={[4, 4, 0, 0]}
          maxBarSize={30}
        />
        <Bar
          dataKey="leasehold"
          name="Leasehold"
          stackId={stacked ? "tenure" : undefined}
          fill={colours[1]}
          radius={[4, 4, 0, 0]}
          maxBarSize={30}
        />
      </BarChart>
    </ResponsiveContainer></ChartFrame>
  );
}

export function VolumeLinesChart({
  data,
  colours,
  format,
  axisFormat,
}: {
  data: VolumePoint[] | null | undefined;
  colours: [string, string];
  format: Fmt;
  axisFormat?: Fmt;
}) {
  if (!hasData(data)) return <EmptyChart />;
  const rows = (data ?? []).map((d) => ({ ...d, label: formatMonth(d.month) }));
  const tickFmt = axisFormat ?? format;
  const width = axisWidth(
    rows.flatMap((r) => [r.available, r.sold]),
    tickFmt,
  );

  return (
    <ChartFrame><ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={width}
          tickMargin={4} tickFormatter={(v) => tickFmt(Number(v))} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => format(Number(v))} />
        <Legend verticalAlign="bottom" height={26} wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="available" name="Available" stroke={colours[0]} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="sold" name="Sold" stroke={colours[1]} strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer></ChartFrame>
  );
}
