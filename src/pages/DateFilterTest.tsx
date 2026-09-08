import { useState } from "react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import type { DashboardFilters, FilterOptions } from "@/lib/dashboardApi";

const MOCK_OPTIONS: FilterOptions = {
  regions: ["South Badung", "Central Badung", "North Badung", "Gianyar", "Tabanan", "Denpasar", "Mengwi"],
  locations: ["Canggu", "Uluwatu", "Seminyak", "Sanur", "Ubud", "Nusa Dua", "Jimbaran"],
  contracts: ["Leasehold", "Freehold"],
  ptypes: ["Villa", "Apartment", "Land", "Townhouse"],
  beds: [1, 2, 3, 4, 5],
  months: ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12", "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"],
};

export default function DateFilterTest() {
  const [filters, setFilters] = useState<DashboardFilters>({
    date_from: "2025-07-01",
    date_to: "2026-06-30",
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-lg font-semibold">Date filter test</h1>
      <div className="max-w-5xl">
        <FilterBar
          filters={filters}
          options={MOCK_OPTIONS}
          onChange={setFilters}
        />
        <pre className="mt-6 rounded-md bg-muted p-4 text-xs">{JSON.stringify(filters, null, 2)}</pre>
      </div>
    </div>
  );
}
