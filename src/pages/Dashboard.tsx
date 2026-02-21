import { Monitor } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Dashboard() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/dashboard");
  const isMobile = useIsMobile();

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
          <div className="w-full h-full overflow-hidden">
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
