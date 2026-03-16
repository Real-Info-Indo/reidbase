import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Loader2, Plus, Paperclip, X, LineChart, ShoppingCart, Megaphone, PieChart, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import ChatChart, { parseChartBlock } from "@/components/ChatChart";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { type Msg } from "@/lib/conversations";
import { useTier } from "@/contexts/TierContext";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { WhatsAppPopup } from "@/components/WhatsAppPopup";
import reidLogo from "@/assets/REID_Base_Black.svg";

const suggestions = [
  { title: "Market trends", shortDesc: "Overview of current market dynamics across Bali", desc: "Give me an overview of the current Bali property market, what are the key trends right now?", icon: LineChart },
  { title: "Top markets", shortDesc: "Locations with the strongest sales and rental fundamentals", desc: "Which locations are showing the strongest market fundamentals across sales and rental performance?", icon: PieChart },
];

const searchModes = [
  { id: "data-analyst", label: "Data analyst", icon: LineChart },
  { id: "sales-assistant", label: "Sales assistant", icon: ShoppingCart },
  { id: "marketing-assistant", label: "Marketing assistant", icon: Megaphone },
  { id: "portfolio-analyst", label: "Portfolio analyst", icon: PieChart },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const PERSONALISATION_KEY = "reid-personalisation";

async function streamChat({
  messages, tier, fileContents, searchMode, onDelta, onDone,
}: { messages: Msg[]; tier: string; fileContents?: { name: string; content: string }[]; searchMode?: string; onDelta: (text: string) => void; onDone: () => void }) {
  let personalisation: Record<string, string> | undefined;
  try {
    const raw = localStorage.getItem(PERSONALISATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.nickname || parsed.occupation || parsed.business || parsed.about) personalisation = parsed;
    }
  } catch {}

  let wixAccessToken: string | undefined;
  try {
    const raw = localStorage.getItem("wix-tokens");
    if (raw) wixAccessToken = JSON.parse(raw)?.accessToken?.value;
  } catch {}

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    body: JSON.stringify({ messages, tier, fileContents, searchMode, personalisation, wixAccessToken }),
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
      } catch {}
    }
  }

  onDone();
}

export default function ChatWidget() {
  const { isLoggedIn, isLoading: authLoading, login } = useWixAuth();
  const { tier, userName } = useTier();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMode, setSearchMode] = useState("data-analyst");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showWaPopup, setShowWaPopup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const latestAiRef = useRef<HTMLDivElement>(null);

  const greetingName = (() => {
    try {
      const raw = localStorage.getItem(PERSONALISATION_KEY);
      if (raw) { const n = JSON.parse(raw).nickname; if (n) return n; }
    } catch {}
    return userName || "there";
  })();

  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    const prev = prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    if (messages.length > prev && messages[messages.length - 1]?.role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    if (messages.length > prev && messages[messages.length - 1]?.role === "assistant" && latestAiRef.current) {
      latestAiRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages.length]);

  const send = async (input: string) => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setQuery("");
    setIsLoading(true);

    let parsedFiles: { name: string; content: string }[] | undefined;
    if (attachedFiles.length > 0) {
      parsedFiles = await Promise.all(attachedFiles.map(async (file) => ({ name: file.name, content: (await file.text()).slice(0, 50000) })));
      setAttachedFiles([]);
    }

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({ messages: newMessages, tier, fileContents: parsedFiles, searchMode, onDelta: (chunk) => upsertAssistant(chunk), onDone: () => setIsLoading(false) });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      if (!assistantSoFar) setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    }
  };

  const handleSubmit = () => send(query);
  const hasConversation = messages.length > 0;
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeFile = (index: number) => setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  const activeMode = searchModes.find((m) => m.id === searchMode);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center space-y-8 bg-card/90 backdrop-blur-md border border-border rounded-2xl p-10 shadow-lg">
          <a href="https://realinfo.id" target="_blank" rel="noopener noreferrer">
            <img src={reidLogo} alt="REID Base" className="h-8 mx-auto" />
          </a>
          <p className="text-sm text-muted-foreground font-extralight">
            Your home for Bali Real Estate Intelligence
          </p>
          <button onClick={login} className="w-full rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground hover:opacity-90 transition-opacity">
            Sign in to access
          </button>
        </div>
      </div>
    );
  }

  const PlusMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="bg-popover w-52">
        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
          <Paperclip className="h-4 w-4 mr-2" />Add files
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {searchModes.map((mode) => {
          const isLocked = mode.id !== "data-analyst" && tier !== "enterprise";
          return (
            <DropdownMenuItem key={mode.id} onClick={() => { if (isLocked) window.open("https://www.realinfo.id/pricing", "_blank"); else setSearchMode(mode.id); }}
              className={`cursor-pointer relative ${searchMode === mode.id ? "bg-accent" : ""} ${isLocked ? "opacity-60" : ""}`}>
              <mode.icon className="h-4 w-4 mr-2" />{mode.label}
              {isLocked ? <Lock className="h-3.5 w-3.5 ml-auto text-muted-foreground" /> : searchMode === mode.id && <span className="ml-auto text-primary text-xs">●</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.txt,.json" />

      {/* Header */}
      <div className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <a href="https://realinfo.id" target="_blank" rel="noopener noreferrer">
          <img src={reidLogo} alt="REID Base" className="h-5" />
        </a>
        <button onClick={() => { setMessages([]); setQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          New chat
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
        {!hasConversation ? (
          <div className="max-w-2xl mx-auto pt-8">
            <p className="text-sm text-muted-foreground font-light mb-1">Hi {greetingName},</p>
            <h1 className="text-xl font-extralight mb-6">What would you like to discover?</h1>
            <div className="grid grid-cols-1 gap-2">
              {suggestions.map((s) => (
                <button key={s.title} onClick={() => send(s.desc)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-primary/40 hover:shadow-sm transition-all group text-xs font-extralight">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold">{s.title}</h3>
                    <p className="text-muted-foreground">{s.shortDesc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((m, i) => {
              const isLastAi = m.role === "assistant" && (i === messages.length - 1 || (i === messages.length - 2 && messages[messages.length - 1]?.role !== "assistant"));
              const hasDataTeamCTA = m.role === "assistant" && m.content.toLowerCase().includes("reid data team");
              return (
                <div key={i} ref={isLastAi ? latestAiRef : undefined} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-[#ffe3bb] text-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"}`}>
                    {m.role === "assistant" ? (
                      <div className="ai-response prose prose-sm max-w-none dark:prose-invert prose-p:mb-4 prose-headings:mt-6 prose-headings:mb-3 prose-ul:ml-6 prose-ol:ml-6 prose-li:mb-1.5" style={{ lineHeight: 1.6 }}>
                        <ReactMarkdown components={{
                          code({ className, children, ...props }) {
                            const match = /language-chart/.exec(className || "");
                            if (match) { const chart = parseChartBlock(String(children).trim()); if (chart) return <ChatChart chart={chart} />; }
                            return <code className={className} {...props}>{children}</code>;
                          },
                          pre({ children }) { return <>{children}</>; },
                        }}>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                  {hasDataTeamCTA && !isLoading && (
                    <button onClick={() => setShowWaPopup(true)} className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Contact the REID data team
                    </button>
                  )}
                </div>
              );
            })}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "200ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "400ms" }} />
                  </div>
                  <span className="text-xs text-muted-foreground font-light">REID is collecting the latest insights</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="relative z-20 px-4 py-3 border-t border-border shrink-0">
        <div className="max-w-2xl mx-auto">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                  <Paperclip className="h-3 w-3" />{f.name}
                  <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => { setQuery(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
              placeholder="Ask REID..."
              disabled={isLoading}
              rows={1}
              className="w-full rounded-xl border border-border px-4 py-3 pb-11 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 overflow-hidden"
              style={{ minHeight: "48px" }}
            />
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusMenu />
                {activeMode && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <activeMode.icon className="h-3 w-3" />{activeMode.label}
                  </span>
                )}
              </div>
              <button onClick={handleSubmit} disabled={isLoading} className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
            <p className="text-right text-[11px] text-muted-foreground/60 font-light mt-1.5">REID Base is AI and can make mistakes. Please double check responses.</p>
          )}
        </div>
      </div>

      <WhatsAppPopup isOpen={showWaPopup} onClose={() => setShowWaPopup(false)} />
    </div>
  );
}
