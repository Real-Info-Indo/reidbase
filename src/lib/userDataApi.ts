// Thin wrapper around the `user-data` Edge Function. Identity is verified
// server-side from the Wix access token in the Authorization header — the
// client never needs to send wix_user_id. All owner-scoped reads/writes
// against chat_logs, folders, user_profiles, chat_feedback, user_sessions,
// and shared_conversations should go through this helper.

import { supabase } from "@/integrations/supabase/client";
import { wixAuthHeader } from "@/lib/wixToken";

export interface UserDataError {
  error: string;
  message?: string;
}

export async function invokeUserData<T = any>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ data: T | null; error: UserDataError | null }> {
  const headers = wixAuthHeader();
  if (!headers.Authorization) {
    return { data: null, error: { error: "no_wix_token" } };
  }
  const { data, error } = await supabase.functions.invoke("user-data", {
    body: { action, ...payload },
    headers,
  });
  if (error) {
    return {
      data: null,
      error: { error: "invoke_failed", message: error.message },
    };
  }
  if (data && typeof data === "object" && "error" in (data as any)) {
    return { data: null, error: data as UserDataError };
  }
  return { data: data as T, error: null };
}
