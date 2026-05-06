import { supabase } from "@/integrations/supabase/client";
import { getFreshWixAccessToken } from "@/lib/wixToken";

const SESSION_KEY = "reid-session-id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface TrackOptions {
  eventType: "page_view" | "feature";
  eventName: string;
  pagePath?: string;
  metadata?: Record<string, unknown>;
}

export async function track({ eventType, eventName, pagePath, metadata }: TrackOptions) {
  try {
    const token = await getFreshWixAccessToken().catch(() => null);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    await supabase.functions.invoke("log-analytics", {
      body: {
        event_type: eventType,
        event_name: eventName,
        page_path: pagePath ?? window.location.pathname,
        session_id: getSessionId(),
        metadata: metadata ?? {},
      },
      headers,
    });
  } catch (err) {
    console.warn("Analytics track failed:", err);
  }
}

export function trackPageView(pagePath?: string, metadata?: Record<string, unknown>) {
  return track({
    eventType: "page_view",
    eventName: "page_view",
    pagePath: pagePath ?? window.location.pathname,
    metadata,
  });
}

export function trackFeature(eventName: string, metadata?: Record<string, unknown>) {
  return track({
    eventType: "feature",
    eventName,
    metadata,
  });
}
