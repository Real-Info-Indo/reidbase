import { Building2, CircleDollarSign, Clock, Home, Percent, Ruler, TrendingUp } from "lucide-react";
import type { ModulePayload } from "@/lib/dashboardApi";
import {
  BedsBarChart,
  DonutChart,
  MonthBarChart,
  MonthLineChart,
  TenureBedsChart,
  VolumeLinesChart,
} from "./charts";
import {
  DashboardCard,
  KpiCard,
  MetricTile,
  ModuleTitle,
  type ModuleTheme,
  formatCount,
  formatDays,
  formatPercent,
  formatSqm,
  formatUsd,
  formatUsdExact,
  formatYears,
} from "./primitives";

interface ModuleProps {
  data: ModulePayload;
  theme: ModuleTheme;
}

function KpiRow({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (!title) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,0.9fr)_repeat(4,minmax(0,1fr))]">
      <div className="col-span-2 lg:col-span-1">
        <ModuleTitle title={title} subtitle={subtitle ?? ""} />
      </div>
      {children}
    </div>
  );
}

function ChartGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{children}</div>;
}


export function MarketOverviewModule({ data, theme }: ModuleProps) {
  const k = data.kpis ?? {};
  return (
    <div className="space-y-4">
      <KpiRow title="Market Overview" subtitle="Market snapshot of key supply and demand metrics">
        <KpiCard label="Available properties" value={formatCount(k.available_properties)} icon={Home} accent={theme.accent} />
        <KpiCard label="Median sold price" value={formatUsd(k.median_sold_price)} icon={CircleDollarSign} accent={theme.accent} />
        <KpiCard label="Clearance rate" value={formatPercent(k.clearance_rate)} icon={TrendingUp} accent={theme.accent} />
        <KpiCard label="Rental records" value={formatCount(k.rental_records)} icon={Building2} accent={theme.accent} />
      </KpiRow>
      <ChartGrid>
        <DashboardCard title="Ownership type" subtitle="Share of listings by tenure">
          <DonutChart data={data.ownership} colours={[theme.accent, theme.light]} format={formatCount} />
        </DashboardCard>
        <DashboardCard title="Median sold price" subtitle="Trailing 12 months">
          <MonthLineChart data={data.sold_price_series} colour={theme.accent} format={formatUsd} gradient />
        </DashboardCard>
        <DashboardCard title="Rental property supply" subtitle="Operating records by bedroom count">
          <BedsBarChart data={data.rental_supply_by_beds} colour={theme.accent} format={formatCount} />
        </DashboardCard>
        <DashboardCard title="Available property supply" subtitle="Available listings by bedroom count and tenure">
          <TenureBedsChart data={data.available_by_beds} colours={[theme.accent, theme.light]} format={formatCount} />
        </DashboardCard>
      </ChartGrid>
    </div>
  );
}

export function SupplyTrendsModule({ data, theme }: ModuleProps) {
  const k = data.kpis ?? {};
  return (
    <div className="space-y-4">
      <KpiRow title="Supply Trends" subtitle="Key supply metrics of available properties">
        <KpiCard label="Available properties" value={formatCount(k.available_properties)} icon={Home} accent={theme.accent} />
        <KpiCard label="Median listing price" value={formatUsd(k.median_listing_price)} icon={CircleDollarSign} accent={theme.accent} />
        <KpiCard label="Clearance rate" value={formatPercent(k.clearance_rate)} icon={TrendingUp} accent={theme.accent} />
        <KpiCard label="New listings, latest period" value={formatCount(k.new_listings)} icon={Building2} accent={theme.accent} />
      </KpiRow>
      <ChartGrid>
        <DashboardCard title="Available supply" subtitle="Bedroom count by tenure">
          <TenureBedsChart data={data.available_by_beds} colours={[theme.accent, theme.light]} format={formatCount} stacked={false} />
        </DashboardCard>
        <DashboardCard title="Development status" subtitle="Completed against off-plan">
          <DonutChart data={data.development_status} colours={[theme.accent, theme.light]} format={formatCount} />
        </DashboardCard>
        <DashboardCard title="Listing price" subtitle="Median asking price by bedroom count">
          <BedsBarChart data={data.listing_price_by_beds} colour={theme.accent} format={formatUsd} />
        </DashboardCard>
        <DashboardCard title="Supply growth" subtitle="New available listings per period">
          <MonthLineChart data={data.supply_growth} colour={theme.accent} format={formatCount} gradient />
        </DashboardCard>
        <DashboardCard title="Clearance rate" subtitle="Sold share of total records per period" className="lg:col-span-2">
          <MonthLineChart data={data.clearance_series} colour={theme.accent} format={formatPercent} />
        </DashboardCard>
      </ChartGrid>
    </div>
  );
}

export function SalesTrendsModule({ data, theme }: ModuleProps) {
  const k = data.kpis ?? {};
  return (
    <div className="space-y-4">
      <KpiRow title="Sales Trends" subtitle="Key sales and demand metrics of transacted properties">
        <KpiCard label="Sold properties" value={formatCount(k.sold_properties)} icon={Home} accent={theme.accent} />
        <KpiCard label="Median sold price" value={formatUsd(k.median_sold_price)} icon={CircleDollarSign} accent={theme.accent} />
        <KpiCard label="Discount rate" value={formatPercent(k.discount_rate)} icon={Percent} accent={theme.accent} />
        <KpiCard label="Days listed" value={formatDays(k.days_listed)} icon={Clock} accent={theme.accent} />
      </KpiRow>
      <ChartGrid>
        <DashboardCard title="Sale price" subtitle="Median sold price per period">
          <MonthBarChart data={data.sale_price_series} colour={theme.accent} format={formatUsd} />
        </DashboardCard>
        <DashboardCard title="Ownership type" subtitle="Tenure split of sold properties">
          <DonutChart data={data.ownership} colours={[theme.accent, theme.light]} format={formatCount} />
        </DashboardCard>
        <DashboardCard title="Sales volume" subtitle="Units sold per period">
          <MonthLineChart data={data.sales_volume_series} colour={theme.accent} format={formatCount} gradient />
        </DashboardCard>
        <DashboardCard title="Discount rate" subtitle="Gap between median asking and median sold price">
          <MonthLineChart data={data.discount_series} colour={theme.accent} format={formatPercent} baseline />
        </DashboardCard>
        <DashboardCard title="Sales volume by bedrooms" subtitle="Units sold by bedroom count" className="lg:col-span-2">
          <BedsBarChart data={data.sales_volume_by_beds} colour={theme.accent} format={formatCount} />
        </DashboardCard>
      </ChartGrid>
    </div>
  );
}

export function PropertyTrendsModule({ data, theme }: ModuleProps) {
  const k = data.kpis ?? {};
  return (
    <div className="space-y-4">
      <KpiRow title="Property Trends" subtitle="Key metrics of property sizing and tenure">
        <KpiCard label="Price per sqm" value={formatUsdExact(k.price_per_sqm)} icon={Ruler} accent={theme.accent} />
        <KpiCard label="Median build size" value={formatSqm(k.median_build_size)} icon={Building2} accent={theme.accent} />
        <KpiCard label="Median floor space ratio" value={formatPercent(k.median_fsr)} icon={Percent} accent={theme.accent} />
        <KpiCard label="Price per year" value={formatUsdExact(k.price_per_year)} icon={CircleDollarSign} accent={theme.accent} />
      </KpiRow>
      <ChartGrid>
        <DashboardCard title="Price per sqm" subtitle="Median USD per sqm per period">
          <MonthBarChart data={data.price_per_sqm_series} colour={theme.accent} format={formatUsdExact} />
        </DashboardCard>
        <DashboardCard title="Average build size" subtitle="Mean internal size per period">
          <MonthLineChart data={data.build_size_series} colour={theme.accent} format={formatSqm} gradient />
        </DashboardCard>
        <DashboardCard title="Average lease term" subtitle="Mean remaining leasehold years">
          <MonthLineChart data={data.lease_series} colour={theme.accent} format={formatYears} />
        </DashboardCard>
        <DashboardCard title="Price per year" subtitle="Mean leasehold cost per year">
          <MonthBarChart data={data.price_per_year_series} colour={theme.accent} format={formatUsdExact} />
        </DashboardCard>
        <DashboardCard title="Floor space ratio" subtitle="Mean build to land ratio per period" className="lg:col-span-2">
          <MonthLineChart data={data.fsr_series} colour={theme.accent} format={formatPercent} gradient />
        </DashboardCard>
      </ChartGrid>
    </div>
  );
}

export function RentalTrendsModule({ data, theme }: ModuleProps) {
  const k = data.kpis ?? {};
  return (
    <div className="space-y-4">
      <KpiRow title="Rental Trends" subtitle="Key supply and demand metrics of operating properties">
        <KpiCard label="Rental records" value={formatCount(k.rental_properties)} icon={Building2} accent={theme.accent} />
        <KpiCard label="Average daily rate" value={formatUsdExact(k.average_rate)} icon={CircleDollarSign} accent={theme.accent} />
        <KpiCard label="Average occupancy" value={formatPercent(k.average_occupancy)} icon={Percent} accent={theme.accent} />
        <KpiCard label="Total revenue" value={formatUsd(k.total_revenue)} icon={TrendingUp} accent={theme.accent} />
      </KpiRow>
      <ChartGrid>
        <DashboardCard title="Average daily rate" subtitle="Mean ADR per period">
          <MonthBarChart data={data.adr_series} colour={theme.accent} format={formatUsdExact} />
        </DashboardCard>
        <DashboardCard title="Average occupancy" subtitle="Mean occupancy per period">
          <MonthLineChart data={data.occupancy_series} colour={theme.accent} format={formatPercent} gradient />
        </DashboardCard>
        <DashboardCard title="Management type" subtitle="Professionally managed against individually managed">
          <DonutChart data={data.mgmt_split} colours={[theme.accent, theme.light, theme.extra]} format={formatCount} />
        </DashboardCard>
        <DashboardCard title="Property type" subtitle="Share of operating records">
          <DonutChart data={data.type_split} colours={[theme.accent, theme.light, theme.extra]} format={formatCount} />
        </DashboardCard>
        <DashboardCard title="Monthly revenue" subtitle="Mean revenue per property per period" className="lg:col-span-2">
          <MonthBarChart data={data.revenue_series} colour={theme.accent} format={formatUsdExact} />
        </DashboardCard>
      </ChartGrid>
    </div>
  );
}

export function LocationReportModule({ data, theme }: ModuleProps) {
  const k = data.kpis ?? {};
  const s = data.secondary ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardCard title="Median sold price" subtitle="Trailing 12 months">
          <MonthLineChart data={data.sold_price_series} colour={theme.accent} format={formatUsd} gradient />
        </DashboardCard>
        <DashboardCard title="New and sold property volume" subtitle="Record volume per period">
          <VolumeLinesChart data={data.volume_series} colours={[theme.accent, theme.light]} format={formatCount} />
        </DashboardCard>
      </div>

      <KpiRow>
        <KpiCard label="Median listing price" value={formatUsd(k.median_listing_price)} icon={CircleDollarSign} accent={theme.accent} />
        <KpiCard label="Median sold price" value={formatUsd(k.median_sold_price)} icon={CircleDollarSign} accent={theme.accent} />
        <KpiCard label="Clearance rate" value={formatPercent(k.clearance_rate)} icon={TrendingUp} accent={theme.accent} />
        <KpiCard label="Available properties" value={formatCount(k.available_properties)} icon={Home} accent={theme.accent} />
      </KpiRow>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
        <DashboardCard title="Development status" subtitle="Completed against off-plan">
          <DonutChart data={data.status_split} colours={[theme.accent, theme.light]} format={formatCount} />
        </DashboardCard>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Days listed" value={formatDays(s.days_listed)} />
          <MetricTile label="Price per sqm" value={formatUsdExact(s.price_per_sqm)} />
          <MetricTile label="Build size" value={formatSqm(s.build_size)} />
          <MetricTile label="Average occupancy" value={formatPercent(s.average_occupancy)} />
          <MetricTile label="Discount rate" value={formatPercent(s.discount_rate)} />
          <MetricTile label="Price per year" value={formatUsdExact(s.price_per_year)} />
          <MetricTile label="Lease term" value={formatYears(s.lease_term)} />
          <MetricTile label="Average gross yield" value={formatPercent(s.gross_yield)} />
        </div>
      </div>
    </div>
  );

}

/** Single panel of the comparison module. Uses the location-report payload. */
export function ComparisonPanel({ data, theme, title }: ModuleProps & { title: string }) {
  const k = data.kpis ?? {};
  const s = data.secondary ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="Available price" value={formatUsd(k.median_listing_price)} />
        <MetricTile label="Sold price" value={formatUsd(k.median_sold_price)} />
        <MetricTile label="Record count" value={formatCount(s.record_count)} />
      </div>
      <DashboardCard title="Sold price movement" subtitle={title}>
        <MonthLineChart data={data.sold_price_series} colour={theme.accent} format={formatUsd} gradient />
      </DashboardCard>
      <div className="grid grid-cols-3 gap-2">
        <MetricTile label="Clearance rate" value={formatPercent(k.clearance_rate)} />
        <MetricTile label="Price per sqm" value={formatUsdExact(s.price_per_sqm)} />
        <MetricTile label="Lease term" value={formatYears(s.lease_term)} />
        <MetricTile label="Discount rate" value={formatPercent(s.discount_rate)} />
        <MetricTile label="Build size" value={formatSqm(s.build_size)} />
        <MetricTile label="Price per year" value={formatUsdExact(s.price_per_year)} />
        <MetricTile label="Days listed" value={formatDays(s.days_listed)} />
        <MetricTile label="Average occupancy" value={formatPercent(s.average_occupancy)} />
        <MetricTile label="Average gross yield" value={formatPercent(s.gross_yield)} />
      </div>
    </div>
  );
}
