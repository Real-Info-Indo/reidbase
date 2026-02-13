import { useState } from "react";
import { Search, FileText } from "lucide-react";

const reports = [
  "Berawa", "Bingin", "Canggu", "Kerobokan",
  "Pererenan", "Sanur", "Seminyak", "Ubud",
];

export default function MarketReports() {
  const [search, setSearch] = useState("");
  const filtered = reports.filter((r) => r.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Market Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Annual market analysis by location</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports..."
            className="rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((location) => (
          <button
            key={location}
            className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:border-primary/30 transition-all text-left"
          >
            <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 via-primary/10 to-secondary flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 text-primary/40 mx-auto mb-3" />
                <span className="text-lg font-semibold text-foreground/70">{location}</span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-medium text-sm">{location}</h3>
              <p className="text-xs text-muted-foreground">2024 Annual Report</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
