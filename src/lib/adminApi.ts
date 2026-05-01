import { supabase } from "@/integrations/supabase/client";
import { wixAuthHeader } from "@/lib/wixToken";

/**
 * Invoke an admin Edge Function with the current Wix bearer token.
 * Throws on transport or function-level errors.
 */
export async function invokeAdmin<T = unknown>(
  fn: "admin-data" | "admin-mutate",
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: wixAuthHeader(),
  });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    const errCode = (data as { error?: string }).error;
    const errMsg = (data as { message?: string }).message;
    throw new Error(errMsg || errCode || "admin_call_failed");
  }
  return data as T;
}
