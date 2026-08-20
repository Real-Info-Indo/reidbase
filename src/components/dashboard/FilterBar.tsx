import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardFilters, FilterOptions } from "@/lib/dashboardApi";
import { formatMonth } from "./primitives";

const ANY = "__any__";

const PRICE_BANDS: { label: string; min?: string; max?: string }[] = [
  { label: "Under $250k", max: "250000" },
  { label: "$250k to $500k", min: "250000", max: "500000" },
  { label: "$500k to $1M", min: "500000", max: "1000000" },
  { label: "Over $1M", min: "1000000" },
];

const SIZE_BANDS: { label: string; min?: string; max?: string }[] = [
  { label: "Under 100 sqm", max: "100" },
  { label: "100 to 200 sqm", min: "100", max: "200" },
  { label: "200 to 400 sqm", min: "200", max: "400" },
  { label: "Over 400 sqm", min: "400" },
];

function bandKey(min?: string, max?: string): string {
  return min || max ? `${min ?? ""}-${max ?? ""}` : ANY;
}

interface FilterBarProps {
  filters: DashboardFilters;
  options: FilterOptions | null;
  onChange: (next: DashboardFilters) => void;
  /** Rentals have no tenure, price or build size dimension. */
  variant?: "properties" | "rentals";
  compact?: boolean;
}

export function FilterBar({ filters, options, onChange, variant = "properties", compact = false }: FilterBarProps) {
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch });
  const clear = (key: keyof DashboardFilters, value: string) =>
    value === ANY ? set({ [key]: undefined } as Partial<DashboardFilters>) : set({ [key]: value } as Partial<DashboardFilters>);

  const triggerClass = compact
    ? "h-8 w-full rounded-lg bg-secondary text-xs"
    : "h-9 w-[9.5rem] rounded-lg bg-secondary text-xs";

  return (
    <div className={compact ? "grid grid-cols-2 gap-2" : "flex flex-wrap items-center gap-2"}>
      <Select value={filters.region ?? ANY} onValueChange={(v) => clear("region", v)}>
        <SelectTrigger className={triggerClass}><SelectValue placeholder="Region" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All regions</SelectItem>
          {(options?.regions ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.location ?? ANY} onValueChange={(v) => clear("location", v)}>
        <SelectTrigger className={triggerClass}><SelectValue placeholder="Micro-location" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All micro-locations</SelectItem>
          {(options?.locations ?? []).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        </SelectContent>
      </Select>

      {variant === "properties" && (
        <Select value={filters.contract ?? ANY} onValueChange={(v) => clear("contract", v)}>
          <SelectTrigger className={triggerClass}><SelectValue placeholder="Tenure" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All tenures</SelectItem>
            {(options?.contracts ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={filters.ptype ?? ANY} onValueChange={(v) => clear("ptype", v)}>
        <SelectTrigger className={triggerClass}><SelectValue placeholder="Property type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All property types</SelectItem>
          {(options?.ptypes ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.beds ?? ANY} onValueChange={(v) => clear("beds", v)}>
        <SelectTrigger className={triggerClass}><SelectValue placeholder="Bedrooms" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All bedrooms</SelectItem>
          {(options?.beds ?? []).map((b) => <SelectItem key={b} value={String(b)}>{b} bedrooms</SelectItem>)}
        </SelectContent>
      </Select>

      {variant === "properties" && (
        <>
          <Select
            value={bandKey(filters.price_min, filters.price_max)}
            onValueChange={(v) => {
              if (v === ANY) return set({ price_min: undefined, price_max: undefined });
              const band = PRICE_BANDS.find((b) => bandKey(b.min, b.max) === v);
              set({ price_min: band?.min, price_max: band?.max });
            }}
          >
            <SelectTrigger className={triggerClass}><SelectValue placeholder="Price" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All prices</SelectItem>
              {PRICE_BANDS.map((b) => (
                <SelectItem key={b.label} value={bandKey(b.min, b.max)}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={bandKey(filters.size_min, filters.size_max)}
            onValueChange={(v) => {
              if (v === ANY) return set({ size_min: undefined, size_max: undefined });
              const band = SIZE_BANDS.find((b) => bandKey(b.min, b.max) === v);
              set({ size_min: band?.min, size_max: band?.max });
            }}
          >
            <SelectTrigger className={triggerClass}><SelectValue placeholder="Build size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All build sizes</SelectItem>
              {SIZE_BANDS.map((b) => (
                <SelectItem key={b.label} value={bandKey(b.min, b.max)}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      <Select value={filters.date_from ?? ANY} onValueChange={(v) => clear("date_from", v)}>
        <SelectTrigger className={triggerClass}><SelectValue placeholder="Period from" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All periods</SelectItem>
          {(options?.months ?? []).slice().reverse().map((m) => (
            <SelectItem key={m} value={m}>From {formatMonth(m)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="sm"
        className={compact ? "col-span-2 h-8 gap-1.5 text-xs" : "h-9 gap-1.5 text-xs"}
        onClick={() => onChange({})}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  );
}
