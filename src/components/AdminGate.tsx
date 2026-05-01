import { Lock, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWixAuth } from "@/contexts/WixAuthContext";

interface AdminGateProps {
  checking: boolean;
  error: string | null;
}

/**
 * Shared gate UI for admin pages.
 * - While we're verifying with the server, show a spinner.
 * - If the user is not logged into Wix, prompt them to log in.
 * - If they are logged in but not an admin, show a clean refusal.
 */
export function AdminGate({ checking, error }: AdminGateProps) {
  const { isLoggedIn, login } = useWixAuth();

  if (checking) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying admin access...
        </div>
      </div>
    );
  }

  if (!isLoggedIn || error === "not_logged_in") {
    return (
      <div className="min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4 p-8 border border-border rounded-xl bg-card text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Admin access</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your Wix account to continue.
          </p>
          <Button onClick={() => login()} className="w-full">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4 p-8 border border-border rounded-xl bg-card text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="text-lg font-semibold">Not authorised</h1>
        <p className="text-sm text-muted-foreground">
          Your account does not have admin privileges.
        </p>
      </div>
    </div>
  );
}
