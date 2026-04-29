import { supabase } from "@/integrations/supabase/client";
import type { Msg } from "./conversations";

interface LogPayload {
  conversationId: string;
  title: string;
  messages: Msg[];
  searchMode?: string;
  userTier?: string;
  pinned?: boolean;
  folderId?: string;
}

function getWixUserInfo(): { id?: string; name?: string; email?: string } {
  try {
    const raw = localStorage.getItem("wix-member");
    if (raw) {
      const member = JSON.parse(raw);
      const name = member?.displayName
        || [member?.name?.first, member?.name?.last].filter(Boolean).join(" ")
        || undefined;
      return {
        id: member?.id,
        name,
        email: member?.email,
      };
    }
  } catch {}
  return {};
}

export async function logConversation(payload: LogPayload) {
  const user = getWixUserInfo();

  const { error } = await supabase.from("chat_logs" as any).upsert(
    {
      conversation_id: payload.conversationId,
      wix_user_id: user.id || null,
      wix_user_name: user.name || null,
      wix_user_email: user.email || null,
      title: payload.title,
      messages: payload.messages,
      search_mode: payload.searchMode || "data-analyst",
      user_tier: payload.userTier || null,
      message_count: payload.messages.length,
      updated_at: new Date().toISOString(),
      pinned: payload.pinned || false,
      folder_id: payload.folderId || null,
    } as any,
    { onConflict: "conversation_id" } as any
  );

  if (error) console.warn("Chat log upsert failed:", error.message);
}

export async function logFolder(folder: { id: string; name: string }, wixUserId: string): Promise<void> {
  if (!wixUserId) return;
  try {
    await supabase
      .from("folders")
      .upsert({
        id: folder.id,
        name: folder.name,
        wix_user_id: wixUserId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" } as any);
  } catch (err) {
    console.error("logFolder failed:", err);
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  try {
    await supabase
      .from("folders")
      .delete()
      .eq("id", folderId);
    // Also clear folder_id from any conversations that referenced it
    await supabase
      .from("chat_logs" as any)
      .update({ folder_id: null } as any)
      .eq("folder_id", folderId);
  } catch (err) {
    console.error("deleteFolder failed:", err);
  }
}

/* ── Per-conversation cloud mutations ── */

async function patchChatLog(conversationId: string, patch: Record<string, any>) {
  try {
    const { error } = await supabase
      .from("chat_logs" as any)
      .update({ ...patch, updated_at: new Date().toISOString() } as any)
      .eq("conversation_id", conversationId);
    if (error) console.warn("patchChatLog failed:", error.message);
  } catch (err) {
    console.error("patchChatLog failed:", err);
  }
}

export const cloudRenameConversation = (id: string, title: string) =>
  patchChatLog(id, { title });

export const cloudTogglePin = (id: string, pinned: boolean) =>
  patchChatLog(id, { pinned });

export const cloudMoveToFolder = (id: string, folderId: string | undefined) =>
  patchChatLog(id, { folder_id: folderId ?? null });

export const cloudSoftDeleteConversation = (id: string) =>
  patchChatLog(id, { deleted_at: new Date().toISOString() });

export async function logFeedback(conversationId: string, action: "copy" | "like" | "dislike") {
  const col = action === "copy" ? "copy_count" : action === "like" ? "likes" : "dislikes";

  // Fetch current value then increment
  const { data } = await supabase
    .from("chat_logs" as any)
    .select(col)
    .eq("conversation_id", conversationId)
    .single() as any;

  const current = data?.[col] ?? 0;

  const { error } = await supabase
    .from("chat_logs" as any)
    .update({ [col]: current + 1 } as any)
    .eq("conversation_id", conversationId) as any;

  if (error) console.warn(`Feedback log (${action}) failed:`, error.message);
}

export async function submitFeedbackComment(
  conversationId: string,
  rating: "like" | "dislike",
  comment: string,
  messageIndex?: number,
) {
  const user = getWixUserInfo();
  const { error } = await supabase.from("chat_feedback" as any).insert({
    conversation_id: conversationId,
    message_index: messageIndex ?? null,
    rating,
    comment: comment.trim() || null,
    wix_user_id: user.id || null,
    wix_user_name: user.name || null,
    wix_user_email: user.email || null,
  } as any);
  if (error) console.warn("Feedback comment submit failed:", error.message);
}
