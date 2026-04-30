export type Msg = { role: "user" | "assistant"; content: string; mode?: string };

export interface Folder {
  id: string;
  name: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  updatedAt: number;
  pinned?: boolean;
  folderId?: string;
}

const STORAGE_KEY = "reid_conversations";
const FOLDERS_KEY = "reid_folders";

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

/* ── Folders ── */

export function getFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeFolders(folders: Folder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

/**
 * Folder limits per tier.
 * Freemium: not allowed (UI should hide creation).
 * Member: 5, Team: 20, Enterprise: 50.
 */
export function folderLimitForTier(tier: string | undefined): number {
  switch (tier) {
    case "enterprise": return 50;
    case "reid_base_pro": return 20;
    case "reid_base": return 5;
    default: return 0;
  }
}

export function createFolder(name: string): Folder {
  const folder: Folder = { id: crypto.randomUUID(), name };
  writeFolders([...getFolders(), folder]);
  return folder;
}

export function renameFolder(id: string, name: string) {
  writeFolders(getFolders().map((f) => (f.id === id ? { ...f, name } : f)));
}

export function deleteFolder(id: string) {
  writeFolders(getFolders().filter((f) => f.id !== id));
  const all = readAll();
  all.forEach((c) => { if (c.folderId === id) c.folderId = undefined; });
  writeAll(all);
}

export function moveToFolder(conversationId: string, folderId: string | undefined) {
  const all = readAll();
  const convo = all.find((c) => c.id === conversationId);
  if (convo) {
    convo.folderId = folderId;
    writeAll(all);
  }
}

/* ── Conversations ── */

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
