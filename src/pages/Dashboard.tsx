import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";

export default function Dashboard() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/dashboard");

  return (
    <div className="relative h-screen flex flex-col">
      {!hasAccess && <UpgradeOverlay />}
      <div className={!hasAccess ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="px-8 py-6 border-b border-border">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Looker dashboard embedding</p>
        </div>
        <div className="flex-1 p-8">
          <div className="w-full h-[calc(100vh-160px)] rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-card">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-2">Looker Dashboard</p>
              <p className="text-sm">iFrame will be embedded here in Phase 2</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
