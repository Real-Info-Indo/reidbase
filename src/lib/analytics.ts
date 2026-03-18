import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "reid-session-id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getWixUserId(): string | null {
  try {
    const raw = localStorage.getItem("wix-member");
    if (raw) return JSON.parse(raw)?.id ?? null;
  } catch {}
  return null;
}

interface TrackOptions {
  eventType: "page_view" | "feature";
  eventName: string;
  pagePath?: string;
  metadata?: Record<string, unknown>;
}

export async function track({ eventType, eventName, pagePath, metadata }: TrackOptions) {
  try {
    await supabase.from("analytics_events" as any).insert({
      event_type: eventType,
      event_name: eventName,
      page_path: pagePath ?? window.location.pathname,
      metadata: metadata ?? {},
      wix_user_id: getWixUserId(),
      session_id: getSessionId(),
    } as any);
  } catch (err) {
    console.warn("Analytics track failed:", err);
  }
}

export function trackPageView(pagePath?: string) {
  track({
    eventType: "page_view",
    eventName: "page_view",
    pagePath: pagePath ?? window.location.pathname,
  });
}

export function trackFeature(eventName: string, metadata?: Record<string, unknown>) {
  track({
    eventType: "feature",
    eventName,
    metadata,
  });
}
