import { useWixAuth } from "@/contexts/WixAuthContext";
import { Loader2 } from "lucide-react";
import reidLogo from "@/assets/REID_Base_Black.svg";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading, login } = useWixAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="relative min-h-screen">
        {/* App content behind, blurred */}
        <div className="pointer-events-none select-none blur-sm" aria-hidden="true">
          {children}
        </div>
        {/* Login overlay */}
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="w-full max-w-sm text-center space-y-8 bg-card/90 backdrop-blur-md border border-border rounded-2xl p-10 shadow-lg">
            <a href="https://realinfo.id" target="_blank" rel="noopener noreferrer">
              <img src={reidLogo} alt="REID Base" className="h-8 mx-auto" />
            </a>
            <p className="text-sm text-muted-foreground font-extralight">
              Your home for Bali Real Estate Intelligence
            </p>
            <p className="text-sm text-foreground font-extralight">
              Sign in with your existing REID account to access. No new account needed.
            </p>
            <button
              onClick={login}
              className="w-full rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign in to your REID account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
