import { supabase } from "@/integrations/supabase/client";

interface HydrateResult {
  conversationsRestored: number;
  foldersRestored: number;
}

/**
 * Cloud-wins reconciliation.
 * On every login we replace localStorage with whatever Supabase has for this Wix user.
 * Soft-deleted conversations (deleted_at IS NOT NULL) are filtered out.
 */
export async function hydrateFromSupabase(wixUserId: string): Promise<HydrateResult> {
  let conversationsRestored = 0;
  let foldersRestored = 0;

  if (!wixUserId) return { conversationsRestored, foldersRestored };

  try {
    // ── Conversations ──
    const { data: chatLogs, error } = await supabase
      .from("chat_logs" as any)
      .select("conversation_id, title, messages, search_mode, updated_at, pinned, folder_id, deleted_at")
      .eq("wix_user_id", wixUserId)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (!error && chatLogs) {
      const conversations = (chatLogs as any[])
        .filter((log: any) => !log.deleted_at)
        .map((log: any) => ({
          id: log.conversation_id,
          title: log.title || "New conversation",
          messages: Array.isArray(log.messages) ? log.messages : [],
          updatedAt: new Date(log.updated_at).getTime(),
          pinned: log.pinned || false,
          folderId: log.folder_id || undefined,
        }));

      localStorage.setItem("reid_conversations", JSON.stringify(conversations));
      conversationsRestored = conversations.length;
    }

    // ── Folders ──
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id, name, created_at")
      .eq("wix_user_id", wixUserId)
      .order("created_at", { ascending: true });

    if (!foldersError && folders) {
      const folderList = folders.map((f: any) => ({
        id: f.id,
        name: f.name,
      }));

      localStorage.setItem("reid_folders", JSON.stringify(folderList));
      foldersRestored = folderList.length;
    }

    // Notify any mounted UI to re-read from localStorage
    window.dispatchEvent(new Event("conversations-updated"));
  } catch (err) {
    console.error("hydrateFromSupabase failed:", err);
  }

  return { conversationsRestored, foldersRestored };
}
