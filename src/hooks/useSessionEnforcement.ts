import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { useTier } from "@/contexts/TierContext";
import { toast } from "@/hooks/use-toast";
import { trackFeature } from "@/lib/analytics";

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

  const registerSession = useCallback(async (wixUserId: string) => {
    // Upsert: replace any existing session for this user
    const { error } = await supabase
      .from("user_sessions")
      .upsert(
        {
          wix_user_id: wixUserId,
          session_id: sessionId.current,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "wix_user_id" }
      );
    if (error) console.error("Session register error:", error);
  }, []);

  const checkSession = useCallback(
    async (wixUserId: string) => {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("session_id")
        .eq("wix_user_id", wixUserId)
        .single();

      if (error) {
        console.error("Session check error:", error);
        return;
      }

      if (data && data.session_id !== sessionId.current) {
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
        // Small delay so the toast is visible
        setTimeout(() => logout(), 2500);
      } else {
        // Heartbeat: update last_seen
        await supabase
          .from("user_sessions")
          .update({ last_seen: new Date().toISOString() })
          .eq("wix_user_id", wixUserId)
          .eq("session_id", sessionId.current);
      }
    },
    [logout]
  );

  useEffect(() => {
    if (!isLoggedIn || !member?.id || !isPaid) return;

    const userId = member.id;

    // Register immediately
    registerSession(userId);

    // Poll
    intervalRef.current = setInterval(() => {
      checkSession(userId);
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoggedIn, member?.id, isPaid, registerSession, checkSession]);
}
