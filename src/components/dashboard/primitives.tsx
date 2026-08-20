import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Per-module accent palettes taken from the dashboard specification. */
export const MODULE_THEMES = {
  "market-overview": { accent: "#fdcb7f", light: "#ffe3bb", extra: "#eb9a64" },
  "supply-trends": { accent: "#eb6738", light: "#eb9a64", extra: "#f5c3a8" },
  "sales-trends": { accent: "#224339", light: "#587a65", extra: "#96b3a1" },
  "property-trends": { accent: "#912421", light: "#c26b68", extra: "#e0aaa8" },
  "rental-trends": { accent: "#182541", light: "#7a808d", extra: "#a0a4ac" },
  "location-report": { accent: "#fdcb7f", light: "#eb9a64", extra: "#ffe3bb" },
  "comparison-report": { accent: "#fdcb7f", light: "#eb9a64", extra: "#ffe3bb" },
} as const;

export type ModuleTheme = (typeof MODULE_THEMES)[keyof typeof MODULE_THEMES];

/** Shared page grid: title column plus four equal score card columns. */
export const MODULE_GRID =
  "grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,0.9fr)_repeat(4,minmax(0,1fr))]";

/** Fixed score card height so the row never changes with the sidebar state. */
export const KPI_HEIGHT = "h-[66px]";

// ---- Formatters (USD, British English, one decimal on rates) ----

export function formatUsd(v: number | null | undefined, compact = true): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  if (compact && Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (compact && Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v).toLocaleString("en-GB")}`;
}

export function formatUsdExact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  return `$${Math.round(v).toLocaleString("en-GB")}`;
}

export function formatCount(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 10_000) return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString("en-GB");
}

export function formatPercent(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  return `${v.toFixed(1)}%`;
}

export function formatSqm(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  return `${Math.round(v).toLocaleString("en-GB")} sqm`;
}

export function formatDays(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  return `${Math.round(v).toLocaleString("en-GB")} days`;
}

export function formatYears(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  return `${v.toFixed(1)} yrs`;
}

/** "2025-07-01" -> "Jul 25" */
export function formatMonth(month: string | null | undefined): string {
  if (!month) return "";
  const d = new Date(month);
  if (Number.isNaN(d.getTime())) return String(month);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// ---- Layout primitives ----

export function DashboardCard({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-card p-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      {title && (
        <header className="mb-2">
          <h3 className="text-sm font-bold leading-tight text-foreground">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs font-extralight text-muted-foreground">{subtitle}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

/** Left title block sitting beside the KPI row. Same fixed height as score cards. */
export function ModuleTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={cn("flex flex-col justify-between px-1", KPI_HEIGHT)}>
      <h2 className="truncate text-lg font-light leading-none text-foreground">{title}</h2>
      <p className="max-w-[16rem] text-[0.68rem] font-extralight leading-snug text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl bg-card px-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)]", KPI_HEIGHT)}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: accent }}
      >
        <Icon className="h-4 w-4" style={{ color: "hsl(var(--card))" }} />
      </span>
      <div className="min-w-0 flex-1 text-right">
        <p className="truncate text-xs font-extralight text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-xl font-bold leading-none text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
      <p className="text-xs font-extralight leading-tight text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-bold leading-tight text-foreground">{value}</p>
    </div>
  );
}


export function EmptyChart({ message = "No data for these filters" }: { message?: string }) {
  return (
    <div className="flex h-[var(--chart-h,200px)] items-center justify-center text-xs font-extralight text-muted-foreground">
      {message}
    </div>
  );
}
