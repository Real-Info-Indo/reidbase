// Probe endpoint: verifies that a Wix member access token sent by the
// frontend can be resolved server-side to a Wix user id.
//
// This function is intentionally minimal. It does NOT touch the database
// and does NOT check entitlements or admin status. Its only job is to
// confirm the verification path before we wire it into every gated flow.
//
// Frontend usage:
//   const tokens = JSON.parse(localStorage.getItem("wix-tokens") || "null");
//   const accessToken = tokens?.accessToken?.value;
//   await fetch(`${SUPABASE_URL}/functions/v1/verify-wix-token`, {
//     headers: { Authorization: `Bearer ${accessToken}` },
//   });

import { verifyWixToken, wixAuthErrorResponse } from "../_shared/wix-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const identity = await verifyWixToken(req.headers.get("Authorization"));
    return new Response(
      JSON.stringify({
        ok: true,
        wix_user_id: identity.wixUserId,
        email: identity.email,
        display_name: identity.displayName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return wixAuthErrorResponse(err, corsHeaders);
  }
});
