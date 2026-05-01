// check-admin
//
// Gate for the /admin/* routes. Verifies the caller's Wix access token,
// then checks if their wix_user_id is present in the public.admin_users
// table (via the SECURITY DEFINER `has_admin` RPC, callable only with the
// service-role key).
//
// Returns: { isAdmin: boolean, wixUserId: string, displayName: string | null }
//
// Frontend usage:
//   const { data, error } = await supabase.functions.invoke("check-admin", {
//     headers: { Authorization: `Bearer ${wixAccessToken}` },
//   });

import { verifyWixToken, wixAuthErrorResponse } from "../_shared/wix-auth.ts";
import { isAdmin } from "../_shared/admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const identity = await verifyWixToken(req.headers.get("Authorization"));
    const adminFlag = await isAdmin(identity.wixUserId);

    return new Response(
      JSON.stringify({
        isAdmin: adminFlag,
        wixUserId: identity.wixUserId,
        displayName: identity.displayName,
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
