// Thin wrapper around the `user-data` Edge Function. Identity is verified
// server-side from the Wix access token in the Authorization header — the
// client never needs to send wix_user_id. All owner-scoped reads/writes
// against chat_logs, folders, user_profiles, chat_feedback, user_sessions,
// and shared_conversations should go through this helper.

import { supabase } from "@/integrations/supabase/client";
import { wixAuthHeader, clearStoredWixTokens } from "@/lib/wixToken";


export interface UserDataError {
  error: string;
  message?: string;
}

export async function invokeUserData<T = any>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ data: T | null; error: UserDataError | null }> {
  const headers = await wixAuthHeader();
  if (!headers.Authorization) {
    return { data: null, error: { error: "no_wix_token" } };
  }
  const { data, error } = await supabase.functions.invoke("user-data", {
    body: { action, ...payload },
    headers,
  });
  if (error) {
    // A rejected/expired Wix token must not keep failing every call: drop the
    // dead tokens so the app falls back to the signed-out state.
    const ctx = (error as { context?: Response }).context;
    if (ctx?.status === 401) clearStoredWixTokens();
    return {
      data: null,
      error: { error: "invoke_failed", message: error.message },
    };
  }
  if (data && typeof data === "object" && "error" in (data as any)) {
    const err = data as UserDataError;
    if (err.error === "invalid_token" || err.error === "missing_token") {
      clearStoredWixTokens();
    }
    return { data: null, error: err };
  }

  return { data: data as T, error: null };
}
