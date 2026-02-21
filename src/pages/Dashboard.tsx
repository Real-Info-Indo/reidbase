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
            <div className="w-full h-[calc(100vh-160px)] rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-card">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-bold mb-2">Looker Dashboard</p>
                <p className="text-sm font-extralight">iFrame will be embedded here in Phase 2</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
