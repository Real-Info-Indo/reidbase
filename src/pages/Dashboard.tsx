import { Monitor } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Dashboard() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/dashboard");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-card">
        <div className="text-center text-muted-foreground px-6">
          <Monitor className="h-12 w-12 mx-auto mb-4 text-primary/50" />
          <p className="text-lg font-bold mb-2">Desktop Only</p>
          <p className="text-sm font-extralight">The dashboard is available on desktop. Please log in from a computer to access it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      {!hasAccess && <UpgradeOverlay />}
      {/* The actual iframe is rendered persistently in AppLayout */}
    </div>
  );
}
