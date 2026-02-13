import React, { createContext, useContext, useState } from "react";

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
  const [tier, setTier] = useState<UserTier>("reid_base_pro");

  const canAccess = (page: string) => tierAccess[tier].includes(page);

  return (
    <TierContext.Provider value={{ tier, setTier, userName: "Thomas Butler", canAccess }}>
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
