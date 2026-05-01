import { invokeUserData } from "@/lib/userDataApi";
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

export async function logConversation(payload: LogPayload) {
  const { error } = await invokeUserData("upsert_chat_log", {
    conversation: {
      conversation_id: payload.conversationId,
      title: payload.title,
      messages: payload.messages,
      search_mode: payload.searchMode || "data-analyst",
      user_tier: payload.userTier || null,
      pinned: payload.pinned || false,
      folder_id: payload.folderId || null,
    },
  });
  if (error) console.warn("Chat log upsert failed:", error.error, error.message);
}

export async function logFolder(folder: { id: string; name: string }, _wixUserId?: string): Promise<void> {
  const { error } = await invokeUserData("upsert_folder", { folder });
  if (error) console.warn("logFolder failed:", error.error, error.message);
}

export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await invokeUserData("delete_folder", { folder_id: folderId });
  if (error) console.warn("deleteFolder failed:", error.error, error.message);
}

/* ── Per-conversation cloud mutations ── */

async function patchChatLog(conversationId: string, patch: Record<string, any>) {
  const { error } = await invokeUserData("patch_chat_log", {
    conversation_id: conversationId,
    patch,
  });
  if (error) console.warn("patchChatLog failed:", error.error, error.message);
}

export const cloudRenameConversation = (id: string, title: string) =>
  patchChatLog(id, { title });

export const cloudTogglePin = (id: string, pinned: boolean) =>
  patchChatLog(id, { pinned });

export const cloudMoveToFolder = (id: string, folderId: string | undefined) =>
  patchChatLog(id, { folder_id: folderId ?? null });

export const cloudSoftDeleteConversation = (id: string) =>
  patchChatLog(id, { deleted_at: new Date().toISOString() });

/* ── Folder memory: regenerate summary for a conversation ──
   Goes through the owner-scoped `refresh_summary` action on user-data,
   which verifies the caller owns the conversation before invoking the
   internal `summarise-conversation` function. */
export async function refreshConversationSummary(conversationId: string, force = false): Promise<void> {
  const { error } = await invokeUserData("refresh_summary", {
    conversation_id: conversationId,
    force,
  });
  if (error) console.warn("refreshConversationSummary failed:", error.error, error.message);
}

export async function logFeedback(conversationId: string, action: "copy" | "like" | "dislike") {
  const { error } = await invokeUserData("log_feedback_count", {
    conversation_id: conversationId,
    kind: action,
  });
  if (error) console.warn(`Feedback log (${action}) failed:`, error.error, error.message);
}

export async function submitFeedbackComment(
  conversationId: string,
  rating: "like" | "dislike",
  comment: string,
  messageIndex?: number,
) {
  const { error } = await invokeUserData("submit_feedback_comment", {
    conversation_id: conversationId,
    rating,
    comment,
    message_index: messageIndex,
  });
  if (error) console.warn("Feedback comment submit failed:", error.error, error.message);
}
