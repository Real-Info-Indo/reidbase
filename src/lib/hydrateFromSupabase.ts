import { supabase } from "@/integrations/supabase/client";

interface HydrateResult {
  conversationsRestored: number;
  foldersRestored: number;
}

export async function hydrateFromSupabase(wixUserId: string): Promise<HydrateResult> {
  let conversationsRestored = 0;
  let foldersRestored = 0;

  try {
    // Only hydrate conversations if localStorage is empty
    const existingConversations = localStorage.getItem("reid_conversations");
    if (!existingConversations || existingConversations === "[]") {
      const { data: chatLogs, error } = await supabase
        .from("chat_logs")
        .select("conversation_id, title, messages, search_mode, updated_at, pinned, folder_id")
        .eq("wix_user_id", wixUserId)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (!error && chatLogs && chatLogs.length > 0) {
        const conversations = chatLogs.map((log: any) => ({
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
    }

    // Only hydrate folders if localStorage is empty
    const existingFolders = localStorage.getItem("reid_folders");
    if (!existingFolders || existingFolders === "[]") {
      const { data: folders, error: foldersError } = await supabase
        .from("folders")
        .select("id, name, created_at")
        .eq("wix_user_id", wixUserId)
        .order("created_at", { ascending: true });

      if (!foldersError && folders && folders.length > 0) {
        const folderList = folders.map((f: any) => ({
          id: f.id,
          name: f.name,
        }));

        localStorage.setItem("reid_folders", JSON.stringify(folderList));
        foldersRestored = folderList.length;
      }
    }
  } catch (err) {
    console.error("hydrateFromSupabase failed:", err);
  }

  return { conversationsRestored, foldersRestored };
}
