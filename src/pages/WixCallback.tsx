import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { wixClient } from "@/lib/wixClient";

const TOKEN_KEY = "wix-tokens";
const OAUTH_DATA_KEY = "wix-oauth-data";

export default function WixCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = async () => {
      try {
        const oauthDataRaw = localStorage.getItem(OAUTH_DATA_KEY);
        if (!oauthDataRaw) throw new Error("No OAuth data found");

        const oauthData = JSON.parse(oauthDataRaw);

        // Wix uses responseMode=fragment, so params are in the hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        
        const code = hashParams.get("code") || searchParams.get("code");
        const state = hashParams.get("state") || searchParams.get("state");

        if (!code || !state) throw new Error("Missing code or state in callback URL");

        const tokenResponse = await wixClient.auth.getMemberTokens(code, state, oauthData);
        wixClient.auth.setTokens(tokenResponse);
        localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenResponse));
        localStorage.removeItem(OAUTH_DATA_KEY);

        // Restore the pre-login URL (preserves ?prompt= from widget) or default to /
        const redirect = localStorage.getItem("wix-post-login-redirect") || "/";
        localStorage.removeItem("wix-post-login-redirect");
        window.location.href = redirect;
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
            className="rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground hover:opacity-90 transition-opacity"
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
