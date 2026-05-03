import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const DASHBOARD_URL = "https://lookerstudio.google.com/embed/reporting/582e2a97-85d3-4266-b0de-65029f7f0a94/page/PxYyD";

export interface PersistentDashboardHandle {
  getContainerEl: () => HTMLDivElement | null;
}

export const PersistentDashboard = forwardRef<PersistentDashboardHandle, { visible: boolean }>(
  function PersistentDashboard({ visible }, ref) {
    const [loaded, setLoaded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getContainerEl: () => containerRef.current,
    }));

    return (
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 overflow-hidden"
        style={{ visibility: visible ? "visible" : "hidden", pointerEvents: visible ? "auto" : "none" }}
      >
      {!loaded && visible && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-background z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard</p>
          <div className="w-3/4 max-w-2xl space-y-4">
            <Skeleton className="h-8 w-full" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      )}
      <iframe
        src={DASHBOARD_URL}
        className="border-0"
        style={{
          width: "calc(100% + 40px)",
          height: "calc(100% + 40px)",
          marginTop: "-20px",
          marginLeft: "-20px",
        }}
        allowFullScreen
        scrolling="no"
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        title="REID Dashboard"
        loading="eager"
        onLoad={() => setLoaded(true)}
      />
      </div>
    );
  }
);
