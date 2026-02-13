import { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";

const locations = [
  "Berawa", "Bingin", "Canggu", "Kerobokan",
  "Pererenan", "Sanur", "Seminyak", "Ubud",
];

export default function LocationReports() {
  const [search, setSearch] = useState("");
  const { canAccess } = useTier();
  const hasAccess = canAccess("/location-reports");
  const filtered = locations.filter((l) => l.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative p-8">
      {!hasAccess && <UpgradeOverlay />}
      <div className={!hasAccess ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Location Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">Neighbourhood-level analysis</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations..."
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
              <div className="aspect-[3/4] bg-gradient-to-br from-primary/30 via-primary/15 to-secondary flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-primary/50 mx-auto mb-3" />
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
    </div>
  );
}
