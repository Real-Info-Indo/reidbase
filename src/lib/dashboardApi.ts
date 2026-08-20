import { supabase } from "@/integrations/supabase/client";
import { wixAuthHeader } from "@/lib/wixToken";

export type DashboardModuleKey =
  | "market-overview"
  | "supply-trends"
  | "sales-trends"
  | "property-trends"
  | "rental-trends"
  | "location-report"
  | "comparison-report";

/** Modules backed directly by a server reporting module. */
export type ServerModuleKey = Exclude<DashboardModuleKey, "comparison-report">;

export interface DashboardFilters {
  region?: string;
  location?: string;
  contract?: string;
  ptype?: string;
  beds?: string;
  price_min?: string;
  price_max?: string;
  size_min?: string;
  size_max?: string;
  date_from?: string;
  date_to?: string;
}

export interface MonthPoint {
  month: string;
  value: number | null;
}

export interface SlicePoint {
  name: string;
  value: number | null;
}

export interface BedsPoint {
  beds: number;
  value: number | null;
}

export interface BedsTenurePoint {
  beds: number;
  leasehold: number | null;
  freehold: number | null;
}

export interface VolumePoint {
  month: string;
  available: number | null;
  sold: number | null;
}

export interface ModulePayload {
  kpis?: Record<string, number | null>;
  secondary?: Record<string, number | null>;
  ownership?: SlicePoint[] | null;
  development_status?: SlicePoint[] | null;
  status_split?: SlicePoint[] | null;
  mgmt_split?: SlicePoint[] | null;
  type_split?: SlicePoint[] | null;
  sold_price_series?: MonthPoint[] | null;
  sale_price_series?: MonthPoint[] | null;
  sales_volume_series?: MonthPoint[] | null;
  discount_series?: MonthPoint[] | null;
  supply_growth?: MonthPoint[] | null;
  clearance_series?: MonthPoint[] | null;
  price_per_sqm_series?: MonthPoint[] | null;
  build_size_series?: MonthPoint[] | null;
  lease_series?: MonthPoint[] | null;
  price_per_year_series?: MonthPoint[] | null;
  fsr_series?: MonthPoint[] | null;
  adr_series?: MonthPoint[] | null;
  occupancy_series?: MonthPoint[] | null;
  revenue_series?: MonthPoint[] | null;
  rental_supply_by_beds?: BedsPoint[] | null;
  listing_price_by_beds?: BedsPoint[] | null;
  sales_volume_by_beds?: BedsPoint[] | null;
  available_by_beds?: BedsTenurePoint[] | null;
  volume_series?: VolumePoint[] | null;
}

export interface FilterOptions {
  regions: string[];
  locations: string[];
  contracts: string[];
  ptypes: string[];
  beds: number[];
  months: string[];
}

async function callDashboard<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("dashboard-data", {
    body,
    headers: await wixAuthHeader(),
  });

  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      const txt = await ctx.text().catch(() => "");
      if (txt) {
        try {
          const parsed = JSON.parse(txt) as { error?: string; message?: string };
          throw new Error(parsed.message || parsed.error || "dashboard_call_failed");
        } catch {
          throw new Error(txt.slice(0, 300));
        }
      }
    }
    throw new Error(error.message || "dashboard_call_failed");
  }

  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    const d = data as { error?: string; message?: string };
    throw new Error(d.message || d.error || "dashboard_call_failed");
  }
  return data as T;
}

export function fetchModuleMetrics(
  moduleKey: ServerModuleKey,
  filters: DashboardFilters,
): Promise<ModulePayload> {
  return callDashboard<ModulePayload>({ action: "metrics", module: moduleKey, filters });
}

export function fetchFilterOptions(): Promise<FilterOptions> {
  return callDashboard<FilterOptions>({ action: "filter_options" });
}
