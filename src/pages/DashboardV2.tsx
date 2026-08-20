import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadElementPdf } from "@/lib/dashboardExport";
import { AdminGate } from "@/components/AdminGate";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  fetchFilterOptions,
  fetchModuleMetrics,
  type DashboardFilters,
  type DashboardModuleKey,
  type FilterOptions,
  type ModulePayload,
  type ServerModuleKey,
} from "@/lib/dashboardApi";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { MODULE_GRID, MODULE_THEMES } from "@/components/dashboard/primitives";
import {
  ComparisonPanel,
  LocationReportModule,
  MarketOverviewModule,
  PropertyTrendsModule,
  RentalTrendsModule,
  SalesTrendsModule,
  SupplyTrendsModule,
} from "@/components/dashboard/modules";

const MODULES: { key: DashboardModuleKey; label: string }[] = [
  { key: "market-overview", label: "Market overview" },
  { key: "supply-trends", label: "Supply trends" },
  { key: "sales-trends", label: "Sales trends" },
  { key: "property-trends", label: "Property trends" },
  { key: "rental-trends", label: "Rental trends" },
  { key: "location-report", label: "Location report" },
  { key: "comparison-report", label: "Comparison report" },
];

function filterVariant(key: DashboardModuleKey): "properties" | "rentals" {
  return key === "rental-trends" ? "rentals" : "properties";
}

export default function DashboardV2() {
  const { authenticated, checking, error } = useAdminAuth();

  const [active, setActive] = useState<DashboardModuleKey>("market-overview");
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [compareA, setCompareA] = useState<DashboardFilters>({});
  const [compareB, setCompareB] = useState<DashboardFilters>({});

  const [payload, setPayload] = useState<ModulePayload | null>(null);
  const [panelA, setPanelA] = useState<ModulePayload | null>(null);
  const [panelB, setPanelB] = useState<ModulePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isComparison = active === "comparison-report";
  const theme = MODULE_THEMES[active];

  useEffect(() => {
    if (!authenticated) return;
    fetchFilterOptions().then(setOptions).catch(() => setOptions(null));
  }, [authenticated]);

  const load = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setLoadError(null);
    try {
      if (isComparison) {
        const [a, b] = await Promise.all([
          fetchModuleMetrics("location-report", compareA),
          fetchModuleMetrics("location-report", compareB),
        ]);
        setPanelA(a);
        setPanelB(b);
      } else {
        setPayload(await fetchModuleMetrics(active as ServerModuleKey, filters));
      }
    } catch (e) {
      setLoadError((e as Error).message || "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [authenticated, active, filters, compareA, compareB, isComparison]);

  useEffect(() => { void load(); }, [load]);

  const downloadPdf = useCallback(async () => {
    if (!contentRef.current || exporting) return;
    setExporting(true);
    try {
      const label = MODULES.find((m) => m.key === active)?.label ?? "dashboard";
      await downloadElementPdf(contentRef.current, `dashboard-${label}`);
    } finally {
      setExporting(false);
    }
  }, [active, exporting]);

  const body = useMemo(() => {
    if (isComparison) {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-xl bg-card p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <p className="mb-2 text-sm font-bold">Selection A</p>
              <FilterBar filters={compareA} options={options} onChange={setCompareA} compact />
            </div>
            {panelA && <ComparisonPanel data={panelA} theme={theme} title="Selection A" />}
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-card p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <p className="mb-2 text-sm font-bold">Selection B</p>
              <FilterBar filters={compareB} options={options} onChange={setCompareB} compact />
            </div>
            {panelB && <ComparisonPanel data={panelB} theme={theme} title="Selection B" />}
          </div>
        </div>
      );
    }

    if (!payload) return null;

    switch (active) {
      case "market-overview":
        return <MarketOverviewModule data={payload} theme={theme} />;
      case "supply-trends":
        return <SupplyTrendsModule data={payload} theme={theme} />;
      case "sales-trends":
        return <SalesTrendsModule data={payload} theme={theme} />;
      case "property-trends":
        return <PropertyTrendsModule data={payload} theme={theme} />;
      case "rental-trends":
        return <RentalTrendsModule data={payload} theme={theme} />;
      case "location-report":
        return <LocationReportModule data={payload} theme={theme} />;
      default:
        return null;
    }
  }, [active, isComparison, options, panelA, panelB, payload, theme, compareA, compareB]);

  if (!authenticated) return <AdminGate checking={checking} error={error} />;

  return (
    <div
      className="flex min-h-screen w-full flex-col overflow-x-hidden bg-background font-sans"
      style={{
        "--chart-base": "clamp(112px, calc((100vh - 400px) / 2), 210px)",
        "--chart-h": "var(--chart-base)",
      } as React.CSSProperties}
    >
      {/* Module tabs: evenly distributed, fully justified, rounded on the bottom */}
      <nav className="grid w-full grid-cols-4 gap-1 px-3 pt-0 lg:grid-cols-7">
        {MODULES.map((m) => {
          const on = m.key === active;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setActive(m.key)}
              className={
                on
                  ? "w-full truncate rounded-b-2xl bg-card px-3 py-2.5 text-sm font-bold text-foreground shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
                  : "w-full truncate rounded-b-2xl bg-secondary/70 px-3 py-2.5 text-sm font-extralight text-muted-foreground transition-colors hover:bg-secondary"
              }
            >
              {m.label}
            </button>
          );
        })}
      </nav>

      <div className="relative mx-auto w-full max-w-[1500px] flex-1 px-3 pb-3 pt-12" ref={contentRef}>
        {!isComparison && (
          <header className={`${MODULE_GRID} mb-2`}>
            {/* Title column spacer to align filters with the first score card */}
            <div className="col-span-2 hidden lg:col-span-1 lg:block" />
            <div className="col-span-2 w-full lg:col-span-4 lg:col-start-2">
              <FilterBar
                filters={filters}
                options={options}
                onChange={setFilters}
                variant={filterVariant(active)}
                rightActions={(
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-[0.65rem] text-muted-foreground"
                    onClick={() => void downloadPdf()}
                    disabled={exporting}
                  >
                    {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    {exporting ? "Preparing PDF" : "Download PDF"}
                  </Button>
                )}
              />
            </div>
          </header>
        )}

        {loadError && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {loadError}
          </div>
        )}

        {loading && !payload && !panelA ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading dashboard data...
          </div>
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>{body}</div>
        )}
      </div>

      <footer className="flex w-full items-center justify-between border-t border-border/40 px-4 pb-2 text-[0.68rem] font-extralight text-muted-foreground">
        <span>Source: REID Database</span>
        <span>© Copyright 2026</span>
      </footer>
    </div>
  );
}


