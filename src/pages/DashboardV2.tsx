import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { MODULE_THEMES } from "@/components/dashboard/primitives";
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
  const navigate = useNavigate();
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
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold leading-tight">Market dashboard</h1>
              <p className="text-xs font-extralight text-muted-foreground">
                Native build, live property and rental data. Internal preview.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </Button>
        </header>

        <nav className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {MODULES.map((m) => {
            const on = m.key === active;
            const t = MODULE_THEMES[m.key];
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setActive(m.key)}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                style={
                  on
                    ? { backgroundColor: t.accent, color: "#182541" }
                    : { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {m.label}
              </button>
            );
          })}
        </nav>

        {!isComparison && (
          <div className="sticky top-0 z-10 mb-4 rounded-xl bg-card/95 p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur">
            <FilterBar
              filters={filters}
              options={options}
              onChange={setFilters}
              variant={filterVariant(active)}
            />
          </div>
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
    </div>
  );
}
