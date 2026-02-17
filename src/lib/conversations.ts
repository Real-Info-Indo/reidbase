export type Msg = { role: "user" | "assistant"; content: string };
export type SearchMode = "rag" | "analytical";

export interface Conversation {
  id: string;
  title: string;
  mode: SearchMode;
  messages: Msg[];
  updatedAt: number;
}

const STORAGE_KEY = "reid_conversations";

function readAll(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(convos: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
}

export function getConversations(): Conversation[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | undefined {
  return readAll().find((c) => c.id === id);
}

export function saveConversation(convo: Conversation) {
  const all = readAll().filter((c) => c.id !== convo.id);
  all.push({ ...convo, updatedAt: Date.now() });
  writeAll(all);
}

export function deleteConversation(id: string) {
  writeAll(readAll().filter((c) => c.id !== id));
}

export function generateId(): string {
  return crypto.randomUUID();
}

/** Derive a title from the first user message */
export function deriveTitle(messages: Msg[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  const text = first.content.slice(0, 60);
  return text.length < first.content.length ? text + "…" : text;
}
