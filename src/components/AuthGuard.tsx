import { useWixAuth } from "@/contexts/WixAuthContext";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading } = useWixAuth();

  // Show a brief loader while we restore tokens, then render the platform for
  // everyone. Sign-in is now triggered contextually: from the sidebar profile
  // button, or when an unauthenticated user attempts to send a prompt.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
