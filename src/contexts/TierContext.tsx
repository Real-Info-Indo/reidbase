import React, { createContext, useContext, useState, useEffect } from "react";
import { useWixAuth } from "@/contexts/WixAuthContext";

export type UserTier = "member" | "reid_base" | "reid_base_pro" | "enterprise";

interface TierContextType {
  tier: UserTier;
  setTier: (tier: UserTier) => void;
  userName: string;
  canAccess: (page: string) => boolean;
}

const tierAccess: Record<UserTier, string[]> = {
  member: ["/"],
  reid_base: ["/", "/dashboard"],
  reid_base_pro: ["/", "/dashboard", "/market-reports", "/location-reports"],
  enterprise: ["/", "/dashboard", "/market-reports", "/location-reports", "/appraisal-request"],
};

const tierLabels: Record<UserTier, string> = {
  member: "Member",
  reid_base: "REID Base",
  reid_base_pro: "REID Base Pro",
  enterprise: "Enterprise",
};

const TierContext = createContext<TierContextType | undefined>(undefined);

export function TierProvider({ children }: { children: React.ReactNode }) {
  const { member, isLoggedIn } = useWixAuth();
  const [tier, setTier] = useState<UserTier>("member");

  // Derive tier from Wix member roles/pricing plans
  // TODO: Map Wix roles/plans to tiers once you configure them in Wix
  useEffect(() => {
    if (!isLoggedIn) {
      setTier("member");
      return;
    }
    // Default to enterprise for now — replace with role-based mapping
    setTier("enterprise");
  }, [isLoggedIn, member]);

  const userName = member?.name ?? "Guest";
  const canAccess = (page: string) => tierAccess[tier].includes(page);

  return (
    <TierContext.Provider value={{ tier, setTier, userName, canAccess }}>
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
