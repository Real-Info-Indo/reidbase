import { Lock } from "lucide-react";
import reidLogo from "@/assets/REID_Base_Black.svg";

export function UpgradeOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-background/60 backdrop-blur-sm rounded-lg pt-12 md:pt-20">
      <div className="w-full max-w-sm text-center space-y-8 bg-card/90 backdrop-blur-md border border-border rounded-2xl p-10 shadow-lg">
        <a href="https://realinfo.id" target="_blank" rel="noopener noreferrer">
          <img src={reidLogo} alt="REID Base" className="h-8 mx-auto" />
        </a>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold mb-2">Upgrade to access insights</h2>
          <p className="text-muted-foreground text-sm font-extralight">
            Subscribers access location reports, interactive data, and full AI access.
          </p>
        </div>
        <a
          href="https://www.realinfo.id/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-lg bg-primary px-8 py-3 font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Upgrade your plan
        </a>
      </div>
    </div>
  );
}
