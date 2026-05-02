// Public Edge Function for fetching a shared conversation snapshot by id.
//
// Why this exists:
//   The `shared_conversations` table will have its anon SELECT policy revoked
//   in Phase 2. This function provides the only sanctioned read path for the
//   public /shared/:id page. It uses the service role key, but only ever
//   returns a strict, non-sensitive subset of columns (no sharer Wix user id).
//
// Auth: NONE. Anyone with a share id can read the snapshot. The id itself is
// the unguessable capability.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let id: string | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url);
      id = url.searchParams.get("id");
    } else {
      const body = await req.json().catch(() => ({}));
      id = typeof body?.id === "string" ? body.id : null;
    }

    if (!id || typeof id !== "string" || id.length < 6 || id.length > 128) {
      return jsonResponse({ error: "invalid_id" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("shared_conversations")
      .select("id,title,messages,search_mode,sharer_name,sharer_tier,created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("shared-conversation read error:", error);
      return jsonResponse({ error: "read_failed" }, 500);
    }
    if (!data) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    return jsonResponse({ snapshot: data });
  } catch (err: any) {
    console.error("shared-conversation error:", err);
    return jsonResponse({ error: "internal_error", message: err?.message }, 500);
  }
});
