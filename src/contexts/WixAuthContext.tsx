import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { wixClient } from "@/lib/wixClient";

interface WixMember {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface WixAuthContextType {
  member: WixMember | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const WixAuthContext = createContext<WixAuthContextType | undefined>(undefined);

const TOKEN_KEY = "wix-tokens";
const OAUTH_DATA_KEY = "wix-oauth-data";

function saveTokens(tokens: any) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function loadTokens(): any | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(OAUTH_DATA_KEY);
  localStorage.removeItem("wix-member");
}

export function WixAuthProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<WixMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMember = useCallback(async () => {
    try {
      const response = await wixClient.members.getCurrentMember({
        fieldsets: ["FULL"],
      });
      const m = response.member;
      if (m) {
        const memberData = {
          id: m._id ?? "",
          name: m.contact?.firstName
            ? `${m.contact.firstName} ${m.contact.lastName ?? ""}`.trim()
            : m.loginEmail ?? "Member",
          email: m.loginEmail ?? "",
          roles: [],
        };
        setMember(memberData);
        // Persist for chat logger and analytics
        localStorage.setItem("wix-member", JSON.stringify({
          id: memberData.id,
          name: { first: m.contact?.firstName, last: m.contact?.lastName },
          email: memberData.email,
          displayName: memberData.name,
        }));
        console.log("Wix member persisted:", memberData.id, memberData.name, memberData.email);
      }
    } catch (err) {
      console.error("Failed to fetch Wix member:", err);
      clearTokens();
      setMember(null);
    }
  }, []);

  // On mount, restore tokens and fetch member
  useEffect(() => {
    const init = async () => {
      const tokens = loadTokens();
      if (tokens) {
        try {
          wixClient.auth.setTokens(tokens);
          await fetchMember();
        } catch {
          clearTokens();
        }
      }
      setIsLoading(false);
    };
    init();
  }, [fetchMember]);

  const login = useCallback(async () => {
    // Preserve the current URL so we can restore it after OAuth callback
    localStorage.setItem("wix-post-login-redirect", window.location.href);
    const oauthData = wixClient.auth.generateOAuthData(
      `${window.location.origin}/callback`,
      window.location.href
    );
    localStorage.setItem(OAUTH_DATA_KEY, JSON.stringify(oauthData));
    const { authUrl } = await wixClient.auth.getAuthUrl(oauthData);
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(async () => {
    clearTokens();
    setMember(null);
    const { logoutUrl } = await wixClient.auth.logout(window.location.origin);
    window.location.href = logoutUrl;
  }, []);

  return (
    <WixAuthContext.Provider
      value={{
        member,
        isLoading,
        isLoggedIn: !!member,
        login,
        logout,
      }}
    >
      {children}
    </WixAuthContext.Provider>
  );
}

export function useWixAuth() {
  const ctx = useContext(WixAuthContext);
  if (!ctx) throw new Error("useWixAuth must be used within WixAuthProvider");
  return ctx;
}
