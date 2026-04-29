import { useCallback, useState } from "react";
import { Monitor, Download, Loader2 } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import type { PersistentDashboardHandle } from "@/components/PersistentDashboard";
import html2canvas from "html2canvas";

export default function Dashboard() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/dashboard");
  const isMobile = useIsMobile();
  const { dashboardRef } = useOutletContext<{ dashboardRef: React.RefObject<PersistentDashboardHandle> }>();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    const el = dashboardRef?.current?.getContainerEl();
    if (!el) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = "REID_Dashboard.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Dashboard screenshot failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [dashboardRef]);

  if (isMobile) {
    return (
      <div className="w-full h-screen overflow-x-hidden flex items-center justify-center bg-card">
        <div className="text-center text-muted-foreground px-6">
          <Monitor className="h-12 w-12 mx-auto mb-4 text-primary/50" />
          <p className="text-lg font-bold mb-2">Desktop Only</p>
          <p className="text-sm font-extralight">The dashboard is available on desktop. Please log in from a computer to access it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-x-hidden overflow-y-hidden flex flex-col">
      {!hasAccess && <UpgradeOverlay />}

      {/* Floating download button */}
      <div className="absolute top-3 right-4 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
          className="gap-1.5 bg-background/80 backdrop-blur-sm"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download
        </Button>
      </div>
    </div>
  );
}
