import { useState } from "react";
import { Search, Download, Loader2 } from "lucide-react";
import { trackFeature } from "@/lib/analytics";
import { toast } from "sonner";
import { useWixAuth } from "@/contexts/WixAuthContext";
import {
  requestReportSignedUrl,
  openSignedDownload,
} from "@/lib/downloadReport";

interface Report {
  name: string;
  /** Slug used as the private Storage object key: market/<reportKey>.pdf */
  reportKey: string;
  thumbnail: string;
  subtitle: string;
}

const reports: Report[] = [
  {
    name: "Bali Annual Report",
    reportKey: "bali_annual_2025",
    thumbnail: "/reports/thumbnails/Bali_Annual_2025.jpg",
    subtitle: "2025 Annual Report",
  },
  {
    name: "Bali Q3 Report",
    reportKey: "bali_q3_2025",
    thumbnail: "/reports/thumbnails/Bali_Q3_2025.jpg",
    subtitle: "Q3 2025 Market Report",
  },
];

export default function MarketReports() {
  const [search, setSearch] = useState("");
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const { login } = useWixAuth();
  const filtered = reports.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDownload = async (report: Report) => {
    if (downloadingKey) return;
    setDownloadingKey(report.reportKey);
    try {
      const result = await requestReportSignedUrl({
        reportType: "market",
        reportKey: report.reportKey,
      });

      if (result.ok) {
        openSignedDownload(result.url);
        // Analytics fire only after a successful signed URL is issued.
        trackFeature("report_download", { report: report.name, type: "market" });
        trackFeature("funnel_report_view", {
          report: report.name,
          report_type: "market",
        });
        return;
      }

      const failure = result;
      switch (failure.kind) {
        case "unauthenticated":
          toast.error(failure.message, {
            action: { label: "Sign in", onClick: () => login() },
          });
          break;
        case "tier_forbidden":
          toast.error(failure.message, {
            action: {
              label: "See plans",
              onClick: () =>
                window.open("https://www.realinfo.id/pricing", "_blank"),
            },
          });
          break;
        case "not_found":
          toast.error(failure.message);
          break;
        default:
          toast.error(failure.message);
      }
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <div className="w-full overflow-x-hidden p-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Market Reports</h1>
          <p className="text-sm text-muted-foreground font-extralight mt-1">
            Annual market analysis by location
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports..."
            className="rounded-lg border border-border bg-card pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((report) => {
          const isLoading = downloadingKey === report.reportKey;
          return (
            <div
              key={report.reportKey}
              className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:border-primary/30 transition-all text-left"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={report.thumbnail}
                  alt={report.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">{report.name}</h3>
                  <p className="text-xs text-muted-foreground font-extralight">
                    {report.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(report)}
                  disabled={isLoading}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                  title={`Download ${report.name}`}
                  aria-label={`Download ${report.name}`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
