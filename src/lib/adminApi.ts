import { supabase } from "@/integrations/supabase/client";
import { wixAuthHeader } from "@/lib/wixToken";

/**
 * Invoke an admin Edge Function with the current Wix bearer token.
 * Throws on transport or function-level errors. When the function returns
 * non-2xx with a JSON body, the body's message/error is surfaced so callers
 * see something useful instead of just "non-2xx status code".
 */
export async function invokeAdmin<T = unknown>(
  fn: "admin-data" | "admin-mutate",
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: await wixAuthHeader(),
  });

  if (error) {
    // FunctionsHttpError carries the underlying Response. Try to read the
    // JSON body so we can show the real error code/message.
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      try {
        const txt = await ctx.text();
        if (txt) {
          try {
            const parsed = JSON.parse(txt) as { error?: string; message?: string };
            const msg = parsed.message || parsed.error;
            if (msg) throw new Error(msg);
          } catch (_) {
            // Non-JSON body: fall through with raw text
            throw new Error(txt.slice(0, 500));
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message) throw e;
      }
    }
    throw new Error(error.message || "admin_call_failed");
  }

  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    const errCode = (data as { error?: string }).error;
    const errMsg = (data as { message?: string }).message;
    throw new Error(errMsg || errCode || "admin_call_failed");
  }
  return data as T;
}
