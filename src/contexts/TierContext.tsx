import React, { createContext, useContext, useState, useEffect } from "react";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { supabase } from "@/integrations/supabase/client";

// Canonical internal tier codes. Note: legacy "member" meant unpaid free and
// is no longer a valid value going forward. The paid Member plan is
// `reid_base`. We keep "member" in the union only for backward compatibility
// with old persisted strings; it is treated as "free" everywhere.
export type UserTier = "free" | "reid_base" | "reid_base_pro" | "enterprise" | "member";

interface TierContextType {
  tier: UserTier;
  setTier: (tier: UserTier) => void;
  userName: string;
  canAccess: (page: string) => boolean;
  refreshTier: () => Promise<void>;
  isRefreshing: boolean;
}

const tierAccess: Record<Exclude<UserTier, "member">, string[]> = {
  free: ["/", "/market-reports"],
  reid_base: ["/", "/dashboard", "/market-reports", "/appraisal-request"],
  reid_base_pro: ["/", "/dashboard", "/market-reports", "/location-reports", "/appraisal-request"],
  enterprise: ["/", "/dashboard", "/market-reports", "/location-reports", "/appraisal-request"],
};

const tierLabels: Record<UserTier, string> = {
  free: "Free",
  member: "Free", // legacy display
  reid_base: "Member",
  reid_base_pro: "Team",
  enterprise: "Enterprise",
};

function normaliseTier(value: unknown): UserTier {
  if (typeof value !== "string") return "free";
  const v = value.trim().toLowerCase();
  if (v === "member" || v === "freemium" || v === "" || v === "null") return "free";
  if (v === "reid_base" || v === "reid_base_pro" || v === "enterprise" || v === "free") {
    return v as UserTier;
  }
  return "free";
}

const TierContext = createContext<TierContextType | undefined>(undefined);

export function TierProvider({ children }: { children: React.ReactNode }) {
  const { member, isLoggedIn } = useWixAuth();
  const [tier, setTier] = useState<UserTier>("free");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTier = async () => {
    try {
      const raw = localStorage.getItem("wix-tokens");
      if (!raw) {
        setTier("free");
        return;
      }
      const parsed = JSON.parse(raw);
      const accessToken = parsed?.accessToken?.value;
      if (!accessToken) {
        setTier("free");
        return;
      }

      setIsRefreshing(true);
      // Ask the server for the canonical tier. The server reads Wix orders
      // and writes the result to public.user_entitlements (the source of
      // truth for all gated server logic). We only mirror the result here
      // for UI presentation.
      const { data, error } = await supabase.functions.invoke("refresh-entitlements", {
        body: {},
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        console.error("refresh-entitlements failed:", error);
        return;
      }

      const next = normaliseTier(data?.tier);
      setTier(next);
      localStorage.setItem("reid-user-tier", next);
      console.log("Canonical tier from server:", next, "plans:", data?.wix_plan_names);
    } catch (err) {
      console.error("Failed to refresh canonical tier:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !member) {
      setTier("free");
      return;
    }
    refreshTier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, member?.id]);

  const userName = member?.name ?? "Guest";
  const canAccess = (page: string) => {
    const t = normaliseTier(tier);
    const list = tierAccess[t as Exclude<UserTier, "member">] ?? tierAccess.free;
    return list.includes(page);
  };

  return (
    <TierContext.Provider value={{ tier, setTier, userName, canAccess, refreshTier, isRefreshing }}>
      {children}
    </TierContext.Provider>
  );
}

export function useTier() {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error("useTier must be used within TierProvider");
  return ctx;
}

export { tierLabels };
