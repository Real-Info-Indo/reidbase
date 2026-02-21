import { Monitor } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Dashboard() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/dashboard");
  const isMobile = useIsMobile();

  return (
    <div className="relative h-screen flex flex-col">
      {!hasAccess && <UpgradeOverlay />}
      <div className={!hasAccess ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="flex-1 p-8">
          {isMobile ? (
            <div className="w-full h-[calc(100vh-160px)] rounded-xl border border-border flex items-center justify-center bg-card">
              <div className="text-center text-muted-foreground px-6">
                <Monitor className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                <p className="text-lg font-bold mb-2">Desktop Only</p>
                <p className="text-sm font-extralight">The dashboard is available on desktop. Please log in from a computer to access it.</p>
              </div>
            </div>
          ) : (
            <iframe
              src="https://lookerstudio.google.com/embed/reporting/582e2a97-85d3-4266-b0de-65029f7f0a94/page/PxYyD"
              className="w-full h-[calc(100vh-80px)] rounded-xl border border-border"
              style={{ border: 0 }}
              allowFullScreen
              sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              title="REID Dashboard"
            />
          )}
        </div>
      </div>
    </div>
  );
}
