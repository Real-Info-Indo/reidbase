import { useEffect, useRef, useCallback } from "react";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { useTier } from "@/contexts/TierContext";
import { toast } from "@/hooks/use-toast";
import { trackFeature } from "@/lib/analytics";
import { invokeUserData } from "@/lib/userDataApi";

const SESSION_KEY = "reid-session-id";
const POLL_INTERVAL = 15_000; // 15 seconds

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const PAID_TIERS = ["reid_base", "reid_base_pro", "enterprise"];

export function useSessionEnforcement() {
  const { member, logout, isLoggedIn } = useWixAuth();
  const { tier } = useTier();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionId = useRef(getOrCreateSessionId());

  const isPaid = PAID_TIERS.includes(tier);

  const registerSession = useCallback(async () => {
    const { error } = await invokeUserData("register_session", {
      session_id: sessionId.current,
    });
    if (error) console.error("Session register error:", error.error, error.message);
  }, []);

  const checkSession = useCallback(async () => {
    const { data, error } = await invokeUserData<{
      session_id: string | null;
      is_owner: boolean;
    }>("check_session", { session_id: sessionId.current });

    if (error) {
      console.error("Session check error:", error.error, error.message);
      return;
    }
    if (!data) return;

    if (data.session_id && !data.is_owner) {
      // Another device has taken over
      trackFeature("session_kicked", {
        kicked_session_id: sessionId.current,
        new_session_id: data.session_id,
      });
      toast({
        title: "Session ended",
        description:
          "Your account was signed in on another device. You have been logged out.",
        variant: "destructive",
      });
      setTimeout(() => logout(), 2500);
    }
  }, [logout]);

  useEffect(() => {
    if (!isLoggedIn || !member?.id || !isPaid) return;

    registerSession();
    intervalRef.current = setInterval(() => {
      checkSession();
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoggedIn, member?.id, isPaid, registerSession, checkSession]);
}
