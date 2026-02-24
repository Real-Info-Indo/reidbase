import { useWixAuth } from "@/contexts/WixAuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import reidLogo from "@/assets/REID_Base_Black.svg";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { isLoggedIn, isLoading, login } = useWixAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      navigate("/", { replace: true });
    }
  }, [isLoading, isLoggedIn, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm text-center space-y-8 bg-card/90 backdrop-blur-md border border-border rounded-2xl p-10 shadow-lg">
        <a href="https://realinfo.id" target="_blank" rel="noopener noreferrer"><img src={reidLogo} alt="REID" className="h-8 mx-auto" /></a>
        <p className="text-sm text-muted-foreground font-extralight">
          Your home for Bali Real Estate Intelligence
        </p>
        <button
          onClick={login}
          className="w-full rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Sign in to access
        </button>
      </div>
    </div>
  );
}
