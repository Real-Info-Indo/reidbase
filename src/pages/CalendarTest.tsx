import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

export default function CalendarTest() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2025, 6, 1),
    to: new Date(2026, 5, 30),
  });
  return (
    <div className="p-8">
      <Calendar
        mode="range"
        numberOfMonths={2}
        selected={range}
        onSelect={setRange}
        captionLayout="dropdown"
        fromYear={2020}
        toYear={2027}
        className="p-3 pointer-events-auto"
        classNames={{
          caption_label: "flex items-center gap-1 text-sm font-medium",
          dropdown: "h-7 rounded-md border border-input bg-background px-1 text-xs",
          dropdown_month: "mr-1",
          dropdown_year: "ml-1",
          day_range_start: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-l-md",
          day_range_end: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-r-md",
          day_range_middle: "bg-primary/20 text-foreground aria-selected:bg-primary/20",
          cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        }}
      />
    </div>
  );
}
