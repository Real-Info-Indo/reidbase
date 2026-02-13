import { Lock } from "lucide-react";

export function UpgradeOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm rounded-lg">
      <div className="text-center max-w-md px-8 py-10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-card mb-2">Upgrade to access insights</h2>
        <p className="text-card/70 mb-6 text-sm">
          Subscribers access location reports, interactive data, and full AI access.
        </p>
        <button className="rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
          SEE PLANS
        </button>
      </div>
    </div>
  );
}
