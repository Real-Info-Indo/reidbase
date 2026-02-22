import { useState } from "react";
import { Search, FileText } from "lucide-react";

interface Report {
  name: string;
  file: string;
  thumbnail: string;
  subtitle: string;
}

const reports: Report[] = [
  { name: "Bali Annual Report", file: "/reports/Bali_Annual_2025.pdf", thumbnail: "/reports/thumbnails/Bali_Annual_2025.jpg", subtitle: "2025 Annual Report" },
  { name: "Bali Q3 Report", file: "/reports/Bali_Q3_2025.pdf", thumbnail: "/reports/thumbnails/Bali_Q3_2025.jpg", subtitle: "Q3 2025 Market Report" },
];


export default function MarketReports() {
  const [search, setSearch] = useState("");
  const filtered = reports.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Market Reports</h1>
          <p className="text-sm text-muted-foreground font-extralight mt-1">Annual market analysis by location</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports..."
            className="rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((report) =>
        <a
          key={report.file}
          href={report.file}
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:border-primary/30 transition-all text-left">

            <div className="aspect-[3/4] overflow-hidden">
              <img src={report.thumbnail} alt={report.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            </div>
            <div className="p-4">
              <h3 className="font-bold text-sm">{report.name}</h3>
              <p className="text-xs text-muted-foreground font-extralight">{report.subtitle}</p>
            </div>
          </a>
        )}
      </div>
    </div>);

}