// Captures ?ref=<slug> on landing, persists a stable visitor id in
// localStorage, and pings the track-affiliate-click edge function. Safe to
// call once at app mount. Defaults the attribution window to 60 days.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const REF_KEY = "reid-affiliate-ref";
const VISITOR_KEY = "reid-visitor-id";
const REF_AT_KEY = "reid-affiliate-ref-at";
const REF_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let v = localStorage.getItem(VISITOR_KEY);
  if (!v) {
    v = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(VISITOR_KEY, v);
  }
  return v;
}

export function getStoredAffiliateRef(): string | null {
  if (typeof window === "undefined") return null;
  const slug = localStorage.getItem(REF_KEY);
  const at = Number(localStorage.getItem(REF_AT_KEY) ?? 0);
  if (!slug) return null;
  if (!at || Date.now() - at > REF_TTL_MS) {
    localStorage.removeItem(REF_KEY);
    localStorage.removeItem(REF_AT_KEY);
    return null;
  }
  return slug;
}

export function useAffiliateTracking() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref")?.trim().toLowerCase();
    if (!ref) return;

    const visitorId = getVisitorId();

    // Persist first-touch (don't overwrite if already stored — keep first attribution).
    if (!getStoredAffiliateRef()) {
      localStorage.setItem(REF_KEY, ref);
      localStorage.setItem(REF_AT_KEY, String(Date.now()));
    }

    supabase.functions.invoke("track-affiliate-click", {
      body: {
        slug: ref,
        visitor_id: visitorId,
        landing_path: location.pathname + location.search,
        referrer: document.referrer || null,
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
      },
    }).catch((err) => {
      if (import.meta.env.DEV) console.warn("affiliate click track failed", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
}
