export type Msg = { role: "user" | "assistant"; content: string };
export type SearchMode = "rag" | "analytical";

export interface Conversation {
  id: string;
  title: string;
  mode: SearchMode;
  messages: Msg[];
  updatedAt: number;
  pinned?: boolean;
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
  return readAll().sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

export function togglePin(id: string) {
  const all = readAll();
  const convo = all.find((c) => c.id === id);
  if (convo) {
    convo.pinned = !convo.pinned;
    writeAll(all);
  }
}

export function renameConversation(id: string, newTitle: string) {
  const all = readAll();
  const convo = all.find((c) => c.id === id);
  if (convo) {
    convo.title = newTitle;
    writeAll(all);
  }
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
