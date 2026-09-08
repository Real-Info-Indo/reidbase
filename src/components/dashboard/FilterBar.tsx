import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { DashboardFilters, FilterOptions } from "@/lib/dashboardApi";
import { formatMonth } from "./primitives";

const ANY = "__any__";

const PRICE_MIN = 0;
const PRICE_MAX = 5_000_000;
const PRICE_STEP = 1_000;
const SIZE_MIN = 0;
const SIZE_MAX = 1_000;
const SIZE_STEP = 5;

function formatPrice(v: number): string {
  return `$${v.toLocaleString("en-US")}`;
}

function formatSize(v: number): string {
  return `${v.toLocaleString("en-US")} sqm`;
}

interface RangeSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  minValue: string | undefined;
  maxValue: string | undefined;
  format: (v: number) => string;
  onApply: (min: number | undefined, max: number | undefined) => void;
  className: string;
}

function RangeSlider({ label, min, max, step, minValue, maxValue, format, onApply, className }: RangeSliderProps) {
  const from = minValue !== undefined ? Number(minValue) : min;
  const to = maxValue !== undefined ? Number(maxValue) : max;
  const active = minValue !== undefined || maxValue !== undefined;
  const [range, setRange] = useState<[number, number]>([from, to]);
  const [open, setOpen] = useState(false);

  const display = active ? `${format(from)} – ${format(to)}` : label;

  const commit = (next: [number, number]) => {
    setRange(next);
    onApply(
      next[0] > min ? next[0] : undefined,
      next[1] < max ? next[1] : undefined,
    );
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setRange([from, to]); }}>
      <PopoverTrigger asChild>
        <button type="button" className={`${className} flex items-center justify-between gap-1 border border-input font-medium`}>
          <span className="truncate">{display}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          <span>{label}</span>
          <span className="text-muted-foreground">
            {format(range[0])} – {format(range[1])}
          </span>
        </div>
        <Slider
          min={min}
          max={max}
          step={step}
          value={range}
          onValueChange={(v) => commit([v[0], v[1]])}
        />
      </PopoverContent>
    </Popover>
  );
}

interface FilterBarProps {
  filters: DashboardFilters;
  options: FilterOptions | null;
  onChange: (next: DashboardFilters) => void;
  /** Rentals have no contract, price or size dimension. */
  variant?: "properties" | "rentals";
  compact?: boolean;
  /** Optional action buttons rendered next to the reset button. */
  rightActions?: React.ReactNode;
}

export function FilterBar({ filters, options, onChange, variant = "properties", compact = false, rightActions }: FilterBarProps) {
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch });
  const clear = (key: keyof DashboardFilters, value: string) =>
    value === ANY ? set({ [key]: undefined } as Partial<DashboardFilters>) : set({ [key]: value } as Partial<DashboardFilters>);

  const triggerClass = compact
    ? "h-8 w-full rounded-lg bg-secondary text-xs"
    : "h-8 min-w-0 flex-1 rounded-lg bg-secondary px-2 text-xs";

  const resetButton = (
    <Button
      variant="ghost"
      size="sm"
      className={compact ? "col-span-2 h-8 gap-1.5 text-xs" : "h-6 gap-1 px-1.5 text-[0.65rem] text-muted-foreground"}
      onClick={() => onChange({})}
    >
      <RotateCcw className="h-3 w-3" />
      Reset
    </Button>
  );

  const regionSelect = (
    <Select value={filters.region ?? ANY} onValueChange={(v) => clear("region", v)}>
      <SelectTrigger className={triggerClass}><SelectValue placeholder="Region" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Region</SelectItem>
        {(options?.regions ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const locationSelect = (
    <Select value={filters.location ?? ANY} onValueChange={(v) => clear("location", v)}>
      <SelectTrigger className={triggerClass}><SelectValue placeholder="Location" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Location</SelectItem>
        {(options?.locations ?? []).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const contractSelect = (
    <Select value={filters.contract ?? ANY} onValueChange={(v) => clear("contract", v)}>
      <SelectTrigger className={triggerClass}><SelectValue placeholder="Contract" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Contract</SelectItem>
        {(options?.contracts ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const propertySelect = (
    <Select value={filters.ptype ?? ANY} onValueChange={(v) => clear("ptype", v)}>
      <SelectTrigger className={triggerClass}><SelectValue placeholder="Property" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Property</SelectItem>
        {(options?.ptypes ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const bedroomsSelect = (
    <Select value={filters.beds ?? ANY} onValueChange={(v) => clear("beds", v)}>
      <SelectTrigger className={triggerClass}><SelectValue placeholder="Bedrooms" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Bedrooms</SelectItem>
        {(options?.beds ?? []).map((b) => <SelectItem key={b} value={String(b)}>{b} bedrooms</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const priceSelect = (
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
        <SelectItem value={ANY}>Price</SelectItem>
        {PRICE_BANDS.map((b) => (
          <SelectItem key={b.label} value={bandKey(b.min, b.max)}>{b.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const sizeSelect = (
    <Select
      value={bandKey(filters.size_min, filters.size_max)}
      onValueChange={(v) => {
        if (v === ANY) return set({ size_min: undefined, size_max: undefined });
        const band = SIZE_BANDS.find((b) => bandKey(b.min, b.max) === v);
        set({ size_min: band?.min, size_max: band?.max });
      }}
    >
      <SelectTrigger className={triggerClass}><SelectValue placeholder="Size" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Size</SelectItem>
        {SIZE_BANDS.map((b) => (
          <SelectItem key={b.label} value={bandKey(b.min, b.max)}>{b.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const dateSelect = (
    <Select value={filters.date_from ?? ANY} onValueChange={(v) => clear("date_from", v)}>
      <SelectTrigger className={triggerClass}><SelectValue placeholder="Date" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>Date</SelectItem>
        {(options?.months ?? []).slice().reverse().map((m) => (
          <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {regionSelect}
        {locationSelect}
        {variant === "properties" && contractSelect}
        {propertySelect}
        {bedroomsSelect}
        {variant === "properties" && priceSelect}
        {variant === "properties" && sizeSelect}
        {dateSelect}
        {resetButton}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex justify-end gap-2">
        {rightActions}
        {resetButton}
      </div>
      <div className="flex items-start gap-1.5">
        {regionSelect}
        {locationSelect}
        {variant === "properties" && contractSelect}
        {propertySelect}
        {bedroomsSelect}
        {variant === "properties" && priceSelect}
        {variant === "properties" && sizeSelect}
        {dateSelect}
      </div>
    </div>
  );
}

