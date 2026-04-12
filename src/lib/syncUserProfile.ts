import { supabase } from "@/integrations/supabase/client";

/**
 * Upserts the current user's profile data to the user_profiles table.
 * Called on login and when personalisation settings are saved.
 */
export async function syncUserProfile() {
  try {
    const memberRaw = localStorage.getItem("wix-member");
    if (!memberRaw) return;
    const member = JSON.parse(memberRaw);
    const wixUserId = member?.id;
    if (!wixUserId) return;

    // Personalisation from localStorage
    let personalisation = { nickname: "", occupation: "", business: "", about: "" };
    try {
      const raw = localStorage.getItem("reid-personalisation");
      if (raw) personalisation = JSON.parse(raw);
    } catch {}

    // Tier from context isn't accessible here, so read from localStorage if stored
    const tier = localStorage.getItem("reid-user-tier") || null;

    await supabase.from("user_profiles" as any).upsert(
      {
        wix_user_id: wixUserId,
        display_name: member.displayName || `${member.name?.first || ""} ${member.name?.last || ""}`.trim() || null,
        email: member.email || null,
        business: personalisation.business || null,
        nickname: personalisation.nickname || null,
        occupation: personalisation.occupation || null,
        about: personalisation.about || null,
        tier,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "wix_user_id" } as any
    );
  } catch (err) {
    console.warn("syncUserProfile failed:", err);
  }
}
