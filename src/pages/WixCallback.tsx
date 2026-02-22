import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function WixCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = async () => {
      try {
        const handleCallback = (window as any).__wixHandleCallback;
        if (!handleCallback) throw new Error("Auth handler not ready");
        await handleCallback();
        navigate("/", { replace: true });
      } catch (err: any) {
        console.error("Callback error:", err);
        setError(err.message || "Authentication failed");
      }
    };
    handle();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-bold text-destructive">Login Failed</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="rounded-lg bg-primary px-6 py-2 font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
