import { supabase } from "@/integrations/supabase/client";
import type { Msg } from "./conversations";

interface LogPayload {
  conversationId: string;
  title: string;
  messages: Msg[];
  searchMode?: string;
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
      message_count: payload.messages.length,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "conversation_id" } as any
  );

  if (error) console.warn("Chat log upsert failed:", error.message);
}

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
