import { useRef, useState, type ReactNode } from "react";
import { Download, MoreVertical, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardModuleKey } from "@/lib/dashboardApi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadChartCsv, downloadElementPng } from "@/lib/dashboardExport";

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

/** Page titles shared between the filter header and each module's KPI row. */
export const MODULE_TITLES: Record<DashboardModuleKey, { title: string; subtitle: string }> = {
  "market-overview": { title: "Market Overview", subtitle: "Market snapshot of key supply and demand metrics" },
  "supply-trends": { title: "Supply Trends", subtitle: "Key supply metrics of available properties" },
  "sales-trends": { title: "Sales Trends", subtitle: "Key sales and demand metrics of transacted properties" },
  "property-trends": { title: "Property Trends", subtitle: "Key metrics of property sizing and tenure" },
  "rental-trends": { title: "Rental Trends", subtitle: "Key supply and demand metrics of operating properties" },
  "location-report": { title: "Location Report", subtitle: "Micro-location snapshot of supply, sales and rental metrics" },
  "comparison-report": { title: "Comparison Report", subtitle: "Side-by-side location comparison" },
};

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

export function formatCountExact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  return Math.round(v).toLocaleString("en-GB");
}

export function formatPercent(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  return `${v.toFixed(1)}%`;
}

export function formatPercentAxis(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  return `${Math.round(v)}%`;
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
  style,
  exportData,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Chart rows behind this card, enabling the CSV and PNG menu. */
  exportData?: Array<object> | null;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const name = title ?? "chart";
  const hasMenu = Boolean(title);

  const onPng = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      await downloadElementPng(cardRef.current, name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      ref={cardRef}
      style={style}
      className={cn(
        "rounded-2xl bg-card p-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      {title && (
        <header className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold leading-tight text-foreground">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs font-extralight text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {hasMenu && (
            <div data-export-ignore="true" className="-mr-1 -mt-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${name} options`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    disabled={!exportData || exportData.length === 0}
                    onSelect={() => downloadChartCsv(exportData, name)}
                  >
                    <Table2 className="mr-2 h-4 w-4" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={busy} onSelect={() => void onPng()}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

/** Left title block sitting beside the KPI row. Same fixed height as score cards. */
export function ModuleTitle({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-between px-1", KPI_HEIGHT, className)}>
      <h2 className="truncate text-lg font-light leading-none text-foreground">{title}</h2>
      {subtitle && (
        <p className="max-w-[16rem] text-[0.68rem] font-extralight leading-snug text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Percentage change between the current and prior-year value, or null when not comparable. */
export function pctChange(
  current: number | null | undefined,
  prior: number | null | undefined,
): number | null {
  if (current == null || prior == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

/** Small arrow plus percentage, green for positive and red for negative. */
export function YoyChange({ change }: { change: number | null | undefined }) {
  if (change == null || !Number.isFinite(change)) return null;
  const rounded = Math.round(change * 10) / 10;
  const positive = rounded > 0;
  const negative = rounded < 0;
  const Arrow = positive ? ArrowUpRight : negative ? ArrowDownRight : ArrowRight;
  const colour = positive
    ? "hsl(142 62% 34%)"
    : negative
      ? "hsl(0 70% 46%)"
      : "hsl(var(--muted-foreground))";
  return (
    <span
      className="mt-0.5 flex items-center justify-end gap-0.5 text-[0.65rem] font-light leading-none"
      style={{ color: colour }}
      title="Change against the 12 months prior to the selected start date"
    >
      <Arrow className="h-3 w-3 shrink-0" />
      {`${positive ? "+" : ""}${rounded.toFixed(1)}% YoY`}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  change,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
  change?: number | null;
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
        <YoyChange change={change} />
      </div>
    </div>
  );
}

export function MetricTile({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col rounded-xl bg-card px-3 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.05)]", compact && "px-2 py-1.5")}>
      <p className={cn("font-extralight leading-tight text-muted-foreground", compact ? "text-[0.65rem]" : "text-xs")}>{label}</p>
      <div className={cn("flex flex-1 items-center justify-start", compact && "min-h-[24px]")}>
        <p className={cn("font-bold leading-tight text-foreground", compact ? "text-xl" : "text-3xl")}>{value}</p>
      </div>
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

// ---- Compact axis formatters (units live in subtitles and tooltips) ----

/** Numeric only, no "sqm" suffix. */
export function formatSqmAxis(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return Math.round(v).toLocaleString("en-GB");
}

/** Numeric only, no "yrs" suffix. */
export function formatYearsAxis(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v >= 10 ? String(Math.round(v)) : v.toFixed(1);
}

/** Compact USD for axes: $12.5K, $1.25M. */
export function formatUsdAxis(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${Math.round(v / 1_000)}K`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString("en-GB")}`;
}
