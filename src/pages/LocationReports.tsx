import { useState } from "react";
import { Search, MapPin, Download } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";

const reports = [
  { location: "Berawa", file: "/reports/Berawa_2024.pdf" },
  { location: "Bingin", file: "/reports/Bingin_2024.pdf" },
  { location: "Canggu", file: "/reports/Canggu_2024.pdf" },
  { location: "Kerobokan", file: "/reports/Kerobokan_2024.pdf" },
  { location: "Pererenan", file: "/reports/Pererenan_2024.pdf" },
  { location: "Sanur", file: "/reports/Sanur_2024.pdf" },
  { location: "Seminyak", file: "/reports/Seminyak_2024.pdf" },
  { location: "Ubud", file: "/reports/Ubud_2024.pdf" },
  { location: "Uluwatu", file: "/reports/Uluwatu_2024.pdf" },
  { location: "Umalas", file: "/reports/Umalas_2024.pdf" },
];

export default function LocationReports() {
  const [search, setSearch] = useState("");
  const { canAccess } = useTier();
  const hasAccess = canAccess("/location-reports");
  const filtered = reports.filter((r) => r.location.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative p-8">
      {!hasAccess && <UpgradeOverlay />}
      <div className={!hasAccess ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Location Reports</h1>
            <p className="text-sm text-muted-foreground font-extralight mt-1">Neighbourhood-level analysis</p>
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
          {filtered.map((report) => (
            <div
              key={report.location}
              className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:border-primary/30 transition-all text-left"
            >
              <div className="aspect-[3/4] bg-gradient-to-br from-primary/30 via-primary/15 to-secondary flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-primary/50 mx-auto mb-3" />
                  <span className="text-lg font-bold text-foreground/70">{report.location}</span>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">{report.location}</h3>
                  <p className="text-xs text-muted-foreground font-extralight">2024 Annual Report</p>
                </div>
                <a
                  href={report.file}
                  download
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
                  title={`Download ${report.location} report`}
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
