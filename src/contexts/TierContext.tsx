import React, { createContext, useContext, useState, useEffect } from "react";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { wixClient } from "@/lib/wixClient";

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

// Map Wix pricing plan names to app tiers
const PLAN_NAME_TO_TIER: Record<string, UserTier> = {
  "Member": "member",
  "REID Base": "reid_base",
  "REID Base Pro": "reid_base_pro",
  "Enterprise": "enterprise",
};

function planNameToTier(planName: string): UserTier {
  // Try exact match first, then case-insensitive
  if (PLAN_NAME_TO_TIER[planName]) return PLAN_NAME_TO_TIER[planName];
  const lower = planName.toLowerCase();
  if (lower.includes("enterprise")) return "enterprise";
  if (lower.includes("pro")) return "reid_base_pro";
  if (lower.includes("reid base") || lower.includes("base")) return "reid_base";
  return "member";
}

const TierContext = createContext<TierContextType | undefined>(undefined);

export function TierProvider({ children }: { children: React.ReactNode }) {
  const { member, isLoggedIn } = useWixAuth();
  const [tier, setTier] = useState<UserTier>("member");

  useEffect(() => {
    if (!isLoggedIn || !member) {
      setTier("member");
      return;
    }

    const fetchTier = async () => {
      try {
        // Fetch the member's active pricing plan orders
        const response = await wixClient.orders.memberListOrders({
          orderStatuses: ["ACTIVE"],
        });

        const activeOrders = response.orders ?? [];
        
        if (activeOrders.length === 0) {
          setTier("member");
          return;
        }

        // Find the highest tier among active orders
        const tierPriority: UserTier[] = ["member", "reid_base", "reid_base_pro", "enterprise"];
        let highestTier: UserTier = "member";

        for (const order of activeOrders) {
          const planName = order.planName ?? "";
          const orderTier = planNameToTier(planName);
          if (tierPriority.indexOf(orderTier) > tierPriority.indexOf(highestTier)) {
            highestTier = orderTier;
          }
        }

        console.log("Wix active orders:", activeOrders.map(o => o.planName));
        console.log("Resolved tier:", highestTier);
        setTier(highestTier);
      } catch (err) {
        console.error("Failed to fetch Wix pricing plan orders:", err);
        setTier("member");
      }
    };

    fetchTier();
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
