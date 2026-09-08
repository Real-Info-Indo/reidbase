import { useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, RotateCcw } from "lucide-react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { DashboardFilters, FilterOptions } from "@/lib/dashboardApi";


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
  /** When true, slider position maps exponentially to value, giving finer control at the low end. */
  exponential?: boolean;
  /** Parser for manual input; defaults to stripping non-numeric characters. */
  parse?: (raw: string) => number | undefined;
}

const SLIDER_STEPS = 500;

function defaultParse(raw: string): number | undefined {
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && raw.trim() !== "" ? n : undefined;
}

function RangeSlider({ label, min, max, step, minValue, maxValue, format, onApply, className, exponential = false, parse = defaultParse }: RangeSliderProps) {
  const from = minValue !== undefined ? Number(minValue) : min;
  const to = maxValue !== undefined ? Number(maxValue) : max;
  const active = minValue !== undefined || maxValue !== undefined;

  // Map between real values and linear slider positions (0..SLIDER_STEPS).
  // For the price slider, give the $100k-$500k band 50% of the track, with 25%
  // reserved for $0-$100k and 25% for $500k-$5M.
  const LOW_KNEE = 100_000;
  const HIGH_KNEE = 500_000;
  const LOW_SHARE = 0.25;
  const MID_SHARE = 0.50;

  const toPos = (v: number): number => {
    const clamped = Math.min(max, Math.max(min, v));
    if (!exponential) return ((clamped - min) / (max - min)) * SLIDER_STEPS;
    if (clamped <= LOW_KNEE) {
      return (clamped / LOW_KNEE) * LOW_SHARE * SLIDER_STEPS;
    }
    if (clamped <= HIGH_KNEE) {
      return (LOW_SHARE + ((clamped - LOW_KNEE) / (HIGH_KNEE - LOW_KNEE)) * MID_SHARE) * SLIDER_STEPS;
    }
    return (LOW_SHARE + MID_SHARE + ((clamped - HIGH_KNEE) / (max - HIGH_KNEE)) * (1 - LOW_SHARE - MID_SHARE)) * SLIDER_STEPS;
  };
  const toVal = (p: number): number => {
    let v: number;
    const share = p / SLIDER_STEPS;
    if (!exponential) v = min + share * (max - min);
    else if (share <= LOW_SHARE) v = (share / LOW_SHARE) * LOW_KNEE;
    else if (share <= LOW_SHARE + MID_SHARE) {
      v = LOW_KNEE + ((share - LOW_SHARE) / MID_SHARE) * (HIGH_KNEE - LOW_KNEE);
    } else {
      v = HIGH_KNEE + ((share - LOW_SHARE - MID_SHARE) / (1 - LOW_SHARE - MID_SHARE)) * (max - HIGH_KNEE);
    }
    return Math.min(max, Math.max(min, Math.round(v / step) * step));
  };

  const [range, setRange] = useState<[number, number]>([from, to]);
  const [minText, setMinText] = useState(String(from));
  const [maxText, setMaxText] = useState(String(to));
  const [open, setOpen] = useState(false);

  const display = active ? `${format(from)} – ${format(to)}` : label;

  const commit = (next: [number, number]) => {
    setRange(next);
    setMinText(String(next[0]));
    setMaxText(String(next[1]));
    onApply(
      next[0] > min ? next[0] : undefined,
      next[1] < max ? next[1] : undefined,
    );
  };

  const preview = (positions: number[]) => {
    const next: [number, number] = [
      toVal(positions[0] ?? 0),
      toVal(positions[1] ?? SLIDER_STEPS),
    ];
    setRange(next);
    setMinText(String(next[0]));
    setMaxText(String(next[1]));
  };

  const commitPositions = (positions: number[]) => {
    commit([
      toVal(positions[0] ?? 0),
      toVal(positions[1] ?? SLIDER_STEPS),
    ]);
  };

  const commitText = (raw: string, end: "min" | "max") => {
    const parsed = parse(raw);
    if (parsed === undefined) return;
    const clamped = Math.min(max, Math.max(min, Math.round(parsed / step) * step));
    const next: [number, number] = end === "min"
      ? [Math.min(clamped, range[1]), range[1]]
      : [range[0], Math.max(clamped, range[0])];
    commit(next);
  };

  const inputClass = "h-7 w-24 rounded-md border border-input bg-background px-2 text-xs tabular-nums";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setRange([from, to]); setMinText(String(from)); setMaxText(String(to)); } }}>
      <PopoverTrigger asChild>
        <button type="button" className={`${className} flex items-center justify-between gap-1 border border-input font-medium`}>
          <span className="truncate">{display}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="mb-2 text-xs font-medium">{label}</div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <input
            type="text"
            inputMode="numeric"
            className={inputClass}
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            onBlur={(e) => commitText(e.target.value, "min")}
            onKeyDown={(e) => { if (e.key === "Enter") commitText((e.target as HTMLInputElement).value, "min"); }}
            aria-label={`${label} minimum`}
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="text"
            inputMode="numeric"
            className={inputClass}
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            onBlur={(e) => commitText(e.target.value, "max")}
            onKeyDown={(e) => { if (e.key === "Enter") commitText((e.target as HTMLInputElement).value, "max"); }}
            aria-label={`${label} maximum`}
          />
        </div>
        <Slider
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={[toPos(range[0]), toPos(range[1])]}
          onValueChange={preview}
          onValueCommit={commitPositions}
        />
        <div className="mt-2 flex justify-between text-[0.65rem] text-muted-foreground tabular-nums">
          <span>{format(range[0])}</span>
          <span>{format(range[1])}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const DATE_PRESETS: { label: string; months: number }[] = [
  { label: "Last quarter", months: 3 },
  { label: "Last 6 months", months: 6 },
  { label: "Last year", months: 12 },
  { label: "Last 2 years", months: 24 },
  { label: "Last 3 years", months: 36 },
];

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseIso(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

interface DateRangeFilterProps {
  from: string | undefined;
  to: string | undefined;
  latestMonth: string | undefined;
  options: FilterOptions | null;
  onApply: (from: string | undefined, to: string | undefined) => void;
  className: string;
}

function DateRangeFilter({ from, to, latestMonth, options, onApply, className }: DateRangeFilterProps) {

  const [open, setOpen] = useState(false);
  const selected: DateRange | undefined = parseIso(from) || parseIso(to)
    ? { from: parseIso(from), to: parseIso(to) }
    : undefined;

  const anchor = parseIso(latestMonth) ?? new Date();
  const endOfAnchor = endOfMonth(anchor);

  const active = Boolean(from || to);
  const display = active
    ? `${parseIso(from) ? format(parseIso(from) as Date, "dd/MM/yyyy") : "Start"} – ${parseIso(to) ? format(parseIso(to) as Date, "dd/MM/yyyy") : "Now"}`
    : "Date range";

  const years = (options?.months ?? []).map((m) => Number(m.split("-")[0]));
  const minYear = years.length ? Math.min(...years) : new Date().getFullYear() - 5;
  const maxYear = years.length ? Math.max(...years) : new Date().getFullYear() + 1;


  const applyPreset = (months: number) => {
    const start = startOfMonth(subMonths(endOfAnchor, months - 1));
    onApply(toIso(start), toIso(endOfAnchor));
    setOpen(false);
  };

  const onSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onApply(undefined, undefined);
      return;
    }
    onApply(toIso(range.from), range.to ? toIso(range.to) : undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`${className} flex items-center justify-between gap-1 border border-input font-medium`}>
          <span className="truncate">{display}</span>
          <CalendarIcon className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-1 border-b p-2 sm:flex-row sm:flex-wrap">
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 justify-start px-2 text-xs"
              onClick={() => applyPreset(p.months)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 justify-start px-2 text-xs"
            onClick={() => { onApply(undefined, undefined); setOpen(false); }}
          >
            All time
          </Button>
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={selected?.from ?? subMonths(endOfAnchor, 1)}
          selected={selected}
          onSelect={onSelect}
          initialFocus
          className="p-3 pointer-events-auto"
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
  /** Filters to restore when the user hits Reset. Defaults to cleared filters. */
  defaultFilters?: DashboardFilters;
}

export function FilterBar({ filters, options, onChange, variant = "properties", compact = false, rightActions, defaultFilters }: FilterBarProps) {

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
      onClick={() => onChange(defaultFilters ?? {})}
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
    <RangeSlider
      label="Price"
      min={PRICE_MIN}
      max={PRICE_MAX}
      step={PRICE_STEP}
      minValue={filters.price_min}
      maxValue={filters.price_max}
      format={formatPrice}
      onApply={(lo, hi) => set({
        price_min: lo !== undefined ? String(lo) : undefined,
        price_max: hi !== undefined ? String(hi) : undefined,
      })}
      className={triggerClass}
      exponential
    />
  );

  const sizeSelect = (
    <RangeSlider
      label="Size"
      min={SIZE_MIN}
      max={SIZE_MAX}
      step={SIZE_STEP}
      minValue={filters.size_min}
      maxValue={filters.size_max}
      format={formatSize}
      onApply={(lo, hi) => set({
        size_min: lo !== undefined ? String(lo) : undefined,
        size_max: hi !== undefined ? String(hi) : undefined,
      })}
      className={triggerClass}
    />
  );

  const dateSelect = (
    <DateRangeFilter
      from={filters.date_from}
      to={filters.date_to}
      latestMonth={options?.months?.[options.months.length - 1]}
      options={options}
      onApply={(f, t) => set({ date_from: f, date_to: t })}
      className={triggerClass}
    />
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

