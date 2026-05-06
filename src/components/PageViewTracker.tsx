import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

/**
 * Tracks page views on every route change. Place inside <BrowserRouter>.
 *
 * We dedupe by full path + search so React StrictMode double-mounts and
 * effectful redirects that land back on the same URL do not log multiple
 * page_view rows for what the user experiences as a single visit.
 */
export function PageViewTracker() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const fullPath = `${location.pathname}${location.search}`;
    if (lastPath.current === fullPath) return;
    lastPath.current = fullPath;

    // Enrich conversation routes with the conversation id so admins can see
    // which threads drive traffic without re-parsing page_path strings.
    const convoMatch = location.pathname.match(/^\/c\/([^/]+)/);
    const metadata = convoMatch ? { conversation_id: convoMatch[1] } : undefined;
    trackPageView(location.pathname, metadata);
  }, [location.pathname, location.search]);

  return null;
}
