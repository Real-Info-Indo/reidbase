import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, TrendingUp, MapPin, BarChart3, Calculator, Loader2, ChevronDown, Pin, Pencil, Folder as FolderIcon, FolderInput } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  type Msg, type Conversation,
  getConversation, saveConversation, generateId, deriveTitle, togglePin, renameConversation,
  getFolders, moveToFolder, type Folder,
} from "@/lib/conversations";
import { useTier } from "@/contexts/TierContext";

const suggestions = [
  { title: "Market trends", desc: "Explore current real estate market dynamics across Bali", icon: TrendingUp },
  { title: "Top markets", desc: "Discover the highest performing investment locations", icon: BarChart3 },
  { title: "Emerging locations", desc: "Find up-and-coming areas with growth potential", icon: MapPin },
  { title: "Yield estimator", desc: "Calculate expected returns on property investments", icon: Calculator },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

async function streamChat({
  messages,
  tier,
  onDelta,
  onDone,
}: {
  messages: Msg[];
  tier: string;
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, tier }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    const errorMsg = errorData.error || `Request failed (${resp.status})`;
    if (resp.status === 429) toast.error("Rate limit exceeded. Please wait a moment.");
    else if (resp.status === 402) toast.error("AI credits exhausted. Please add funds.");
    else toast.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {/* ignore */}
    }
  }

  onDone();
}

export default function NewAnalysis() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const paramConvoId = searchParams.get("c");
  const { tier } = useTier();

  const startNew = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setQuery("");
    const url = new URL(window.location.href);
    url.searchParams.delete("c");
    window.history.replaceState({}, "", url.toString());
  }, []);

  useEffect(() => {
    if (paramConvoId) {
      const convo = getConversation(paramConvoId);
      if (convo) {
        setConversationId(convo.id);
        setMessages(convo.messages);
        setCustomTitle(convo.title !== deriveTitle(convo.messages) ? convo.title : null);
        setIsPinned(!!convo.pinned);
        return;
      }
    }
    if (!paramConvoId && conversationId) {
      setMessages([]);
      setConversationId(null);
      setQuery("");
    }
  }, [paramConvoId]);

  useEffect(() => {
    const handler = () => startNew();
    window.addEventListener("new-analysis-reset", handler);
    return () => window.removeEventListener("new-analysis-reset", handler);
  }, [startNew]);

  const persistRef = useRef<string | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    const id = conversationId ?? generateId();
    if (!conversationId) {
      setConversationId(id);
      const url = new URL(window.location.href);
      url.searchParams.set("c", id);
      window.history.replaceState({}, "", url.toString());
    }
    persistRef.current = id;
    saveConversation({ id, title: customTitle || deriveTitle(messages), messages, updatedAt: Date.now(), pinned: isPinned });
    window.dispatchEvent(new Event("conversations-updated"));
  }, [messages, conversationId]);

  const displayTitle = customTitle || deriveTitle(messages);

  const handlePin = () => {
    if (!conversationId) return;
    togglePin(conversationId);
    setIsPinned(!isPinned);
    window.dispatchEvent(new Event("conversations-updated"));
    toast.success(isPinned ? "Unpinned" : "Pinned to top");
  };

  const handleRename = () => {
    setRenameValue(displayTitle);
    setIsRenaming(true);
  };

  const submitRename = () => {
    if (!conversationId || !renameValue.trim()) return;
    renameConversation(conversationId, renameValue.trim());
    setCustomTitle(renameValue.trim());
    setIsRenaming(false);
    window.dispatchEvent(new Event("conversations-updated"));
    toast.success("Conversation renamed");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (input: string) => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setQuery("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMessages,
        tier,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
      });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      if (!assistantSoFar) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
      }
    }
  };

  const handleSubmit = () => send(query);
  const hasConversation = messages.length > 0;

  return (
    <div className="flex flex-col h-screen">
      {hasConversation && (
        <div className="border-b border-border px-8 py-3 flex items-center justify-between">
          {isRenaming ? (
            <div className="flex items-center gap-2">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitRename()}
                className="text-sm font-medium border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-card"
                autoFocus
              />
              <button onClick={submitRename} className="text-xs text-primary font-medium hover:underline">Save</button>
              <button onClick={() => setIsRenaming(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none">
                {isPinned && <Pin className="h-3 w-3 text-primary" />}
                {displayTitle}
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover">
                <DropdownMenuItem onClick={handlePin} className="cursor-pointer">
                  <Pin className="h-4 w-4 mr-2" />
                  {isPinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRename} className="cursor-pointer">
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                {(() => {
                  const allFolders = getFolders();
                  if (allFolders.length === 0) return null;
                  return (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer">
                        <FolderInput className="h-4 w-4 mr-2" />
                        Move to folder
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="bg-popover">
                        {allFolders.map((f) => (
                          <DropdownMenuItem key={f.id} onClick={() => { if (conversationId) { moveToFolder(conversationId, f.id); window.dispatchEvent(new Event("conversations-updated")); toast.success(`Moved to ${f.name}`); } }} className="cursor-pointer text-xs">
                            <FolderIcon className="h-3.5 w-3.5 mr-2" />
                            {f.name}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { if (conversationId) { moveToFolder(conversationId, undefined); window.dispatchEvent(new Event("conversations-updated")); toast.success("Removed from folder"); } }} className="cursor-pointer text-xs">
                          Remove from folder
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                })()}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-12">
        {!hasConversation ? (
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-semibold mb-2">
              Welcome to <span className="text-primary">REID</span>,
            </h1>
            <p className="text-2xl text-muted-foreground mb-8">what would you like to discover?</p>
            <div className="relative mb-12">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                placeholder="Enter a prompt..."
                className="w-full min-h-[120px] rounded-xl border border-border bg-card p-5 pr-14 text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
              />
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {suggestions.map((s) => (
                <button
                  key={s.title}
                  onClick={() => send(s.desc)}
                  className="items-start gap-4 rounded-xl border border-border bg-card p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all group flex flex-row text-xs font-extralight"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 mt-1 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-card border border-border rounded-bl-md"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-5 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {hasConversation && (
        <div className="border-t border-border px-8 py-4">
          <div className="max-w-3xl mx-auto relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Enter a prompt..."
              disabled={isLoading}
              className="w-full rounded-xl border border-border bg-card px-5 py-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
