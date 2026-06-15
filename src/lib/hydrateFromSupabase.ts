import { invokeUserData } from "@/lib/userDataApi";

interface HydrateResult {
  conversationsRestored: number;
  foldersRestored: number;
}

/**
 * Cloud-wins reconciliation.
 * On every login we replace localStorage with whatever the server has for this
 * Wix user. The server is the only thing that can read these tables now —
 * identity is verified from the Wix access token in the Authorization header.
 */
export async function hydrateFromSupabase(_wixUserId?: string): Promise<HydrateResult> {
  let conversationsRestored = 0;
  let foldersRestored = 0;

  try {
    const { data, error } = await invokeUserData<{
      conversations: any[];
      folders: any[];
      profile: any;
      entitlement?: {
        tier?: string | null;
      };
    }>("hydrate");

    if (error || !data) {
      if (error) console.warn("hydrate failed:", error.error, error.message);
      return { conversationsRestored, foldersRestored };
    }

    // ── Conversations ──
    const conversations = (data.conversations ?? []).map((log: any) => ({
      id: log.conversation_id,
      title: log.title || "New conversation",
      messages: Array.isArray(log.messages) ? log.messages : [],
      updatedAt: log.updated_at ? new Date(log.updated_at).getTime() : Date.now(),
      pinned: log.pinned || false,
      folderId: log.folder_id || undefined,
    }));
    localStorage.setItem("reid_conversations", JSON.stringify(conversations));
    conversationsRestored = conversations.length;

    // ── Folders ──
    const folderList = (data.folders ?? []).map((f: any) => ({
      id: f.id,
      name: f.name,
    }));
    localStorage.setItem("reid_folders", JSON.stringify(folderList));
    foldersRestored = folderList.length;

    // ── Personalisation ──
    const p = data.profile;
    if (p) {
      const hasAny = p.nickname || p.occupation || p.business || p.about;
      if (hasAny) {
        localStorage.setItem(
          "reid-personalisation",
          JSON.stringify({
            nickname: p.nickname || "",
            occupation: p.occupation || "",
            business: p.business || "",
            about: p.about || "",
          }),
        );
        window.dispatchEvent(new Event("personalisation-updated"));
      }
    }

    const hydratedTier = data.entitlement?.tier;
    if (typeof hydratedTier === "string" && hydratedTier.trim()) {
      localStorage.setItem("reid-user-tier", hydratedTier);
      window.dispatchEvent(new Event("tier-updated"));
    }

    window.dispatchEvent(new Event("conversations-updated"));
  } catch (err) {
    console.error("hydrateFromSupabase failed:", err);
  }

  return { conversationsRestored, foldersRestored };
}
