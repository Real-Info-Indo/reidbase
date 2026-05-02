import { useState } from "react";
import { Search, Download, Loader2 } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";
import { trackFeature } from "@/lib/analytics";
import { toast } from "sonner";
import { useWixAuth } from "@/contexts/WixAuthContext";
import {
  requestReportSignedUrl,
  openSignedDownload,
} from "@/lib/downloadReport";

interface LocationReport {
  location: string;
  /** Slug used as the private Storage object key: location/<reportKey>.pdf */
  reportKey: string;
  thumb: string;
}

const reports: LocationReport[] = [
  { location: "Berawa", reportKey: "berawa_2025", thumb: "/reports/thumbnails/Berawa.jpg" },
  { location: "Bingin", reportKey: "bingin_2025", thumb: "/reports/thumbnails/Bingin.jpg" },
  { location: "Canggu", reportKey: "canggu_2025", thumb: "/reports/thumbnails/Canggu.jpg" },
  { location: "Kerobokan", reportKey: "kerobokan_2025", thumb: "/reports/thumbnails/Kerobokan.jpg" },
  { location: "Pererenan", reportKey: "pererenan_2025", thumb: "/reports/thumbnails/Pererenan.jpg" },
  { location: "Sanur", reportKey: "sanur_2025", thumb: "/reports/thumbnails/Sanur.jpg" },
  { location: "Seminyak", reportKey: "seminyak_2025", thumb: "/reports/thumbnails/Seminyak.jpg" },
  { location: "Ubud", reportKey: "ubud_2025", thumb: "/reports/thumbnails/Ubud.jpg" },
  { location: "Uluwatu", reportKey: "uluwatu_2025", thumb: "/reports/thumbnails/Uluwatu.jpg" },
  { location: "Umalas", reportKey: "umalas_2025", thumb: "/reports/thumbnails/Umalas.jpg" },
];

export default function LocationReports() {
  const [search, setSearch] = useState("");
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const { canAccess } = useTier();
  const { login } = useWixAuth();
  const hasAccess = canAccess("/location-reports");
  const filtered = reports.filter((r) =>
    r.location.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDownload = async (report: LocationReport) => {
    if (downloadingKey) return;
    setDownloadingKey(report.reportKey);
    try {
      const result = await requestReportSignedUrl({
        reportType: "location",
        reportKey: report.reportKey,
      });

      if (result.ok) {
        openSignedDownload(result.url);
        // Analytics fire only after a successful signed URL is issued.
        trackFeature("report_download", {
          report: report.location,
          type: "location",
        });
        trackFeature("funnel_report_view", {
          report: report.location,
          report_type: "location",
        });
        return;
      }

      switch (result.kind) {
        case "unauthenticated":
          toast.error(result.message, {
            action: { label: "Sign in", onClick: () => login() },
          });
          break;
        case "tier_forbidden":
          toast.error(result.message, {
            action: {
              label: "See plans",
              onClick: () =>
                window.open("https://www.realinfo.id/pricing", "_blank"),
            },
          });
          break;
        case "not_found":
          toast.error(result.message);
          break;
        default:
          toast.error(result.message);
      }
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <div className="relative w-full overflow-x-hidden p-8">
      {!hasAccess && <UpgradeOverlay />}
      <div className={!hasAccess ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Location Reports</h1>
            <p className="text-sm text-muted-foreground font-extralight mt-1">
              Neighbourhood-level analysis
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations..."
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
                <div className="aspect-[3/4] overflow-hidden">
                  <img
                    src={report.thumb}
                    alt={`${report.location} report cover`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm">{report.location}</h3>
                    <p className="text-xs text-muted-foreground font-extralight">
                      2025 Annual Report
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(report)}
                    disabled={isLoading || !hasAccess}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                    title={`Download ${report.location} report`}
                    aria-label={`Download ${report.location} report`}
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
    </div>
  );
}
