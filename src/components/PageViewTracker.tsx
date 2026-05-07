import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/**
 * Tracks page views on every route change. Place inside <BrowserRouter>.
 *
 * Dedupes by pathname + search so React StrictMode double-mounts and
 * effectful redirects that land back on the same URL do not log multiple
 * page_view rows for what the user experiences as a single visit.
 *
 * Sends a normalized pathname as `page_path`, while preserving full_path,
 * search, referrer, and UTM fields in metadata so admins can analyse
 * acquisition (referrers) and campaigns (utm_*) without losing the
 * underlying campaign/shared/prompt URLs.
 */
export function PageViewTracker() {
  const location = useLocation();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const fullPath = `${location.pathname}${location.search}`;
    if (lastKey.current === fullPath) return;
    lastKey.current = fullPath;

    const params = new URLSearchParams(location.search);
    const metadata: Record<string, unknown> = {
      full_path: fullPath,
    };

    if (location.search) metadata.search = location.search;
    if (typeof document !== "undefined" && document.referrer) {
      metadata.referrer = document.referrer;
    }
    for (const key of UTM_KEYS) {
      const v = params.get(key);
      if (v) metadata[key] = v;
    }

    // Enrich conversation routes with the conversation id so admins can see
    // which threads drive traffic without re-parsing page_path strings.
    const convoMatch = location.pathname.match(/^\/c\/([^/]+)/);
    if (convoMatch) metadata.conversation_id = convoMatch[1];

    trackPageView(location.pathname, metadata);
  }, [location.pathname, location.search]);

  return null;
}
