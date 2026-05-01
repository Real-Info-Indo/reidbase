import { invokeUserData } from "@/lib/userDataApi";

/**
 * Upserts the current user's profile data via the user-data Edge Function.
 * Identity is verified server-side from the Wix access token; this client
 * cannot pretend to be another user.
 */
export async function syncUserProfile() {
  try {
    let personalisation = { nickname: "", occupation: "", business: "", about: "" };
    try {
      const raw = localStorage.getItem("reid-personalisation");
      if (raw) personalisation = JSON.parse(raw);
    } catch {}

    const tier = localStorage.getItem("reid-user-tier") || null;

    const { error } = await invokeUserData("upsert_profile", {
      profile: personalisation,
      tier,
    });
    if (error) console.warn("syncUserProfile failed:", error.error, error.message);
  } catch (err) {
    console.warn("syncUserProfile failed:", err);
  }
}
