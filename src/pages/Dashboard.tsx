import { useState } from "react";
import { Monitor, Loader2 } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/dashboard");
  const isMobile = useIsMobile();
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      {!hasAccess && <UpgradeOverlay />}
      <div className={`flex-1 ${!hasAccess ? "pointer-events-none select-none blur-sm" : ""}`}>
        {isMobile ? (
          <div className="w-full h-full flex items-center justify-center bg-card">
            <div className="text-center text-muted-foreground px-6">
              <Monitor className="h-12 w-12 mx-auto mb-4 text-primary/50" />
              <p className="text-lg font-bold mb-2">Desktop Only</p>
              <p className="text-sm font-extralight">The dashboard is available on desktop. Please log in from a computer to access it.</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full overflow-hidden relative">
            {!iframeLoaded && (
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
              src="https://lookerstudio.google.com/embed/reporting/582e2a97-85d3-4266-b0de-65029f7f0a94/page/PxYyD"
              className="border-0"
              style={{
                width: 'calc(100% + 40px)',
                height: 'calc(100% + 40px)',
                marginTop: '-20px',
                marginLeft: '-20px',
              }}
              allowFullScreen
              sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              title="REID Dashboard"
              loading="eager"
              onLoad={() => setIframeLoaded(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
