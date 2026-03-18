import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowDown, TrendingUp, MapPin, BarChart3, Calculator, Loader2, ChevronDown, Pin, Pencil, Folder as FolderIcon, FolderInput, Plus, Paperclip, LineChart, Megaphone, ShoppingCart, PieChart, X, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import ChatChart, { parseChartBlock } from "@/components/ChatChart";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from
"@/components/ui/dropdown-menu";
import {
  type Msg, type Conversation,
  getConversation, saveConversation, generateId, deriveTitle, togglePin, renameConversation,
  getFolders, moveToFolder, type Folder } from
"@/lib/conversations";
import { useTier } from "@/contexts/TierContext";
import { WhatsAppPopup } from "@/components/WhatsAppPopup";
import { logConversation } from "@/lib/chatLogger";
import { trackFeature } from "@/lib/analytics";

const suggestions = [
{ title: "Market trends", shortDesc: "Overview of current market dynamics across Bali", desc: "Give me an overview of the current Bali property market \u2014 what are the key trends right now?", icon: TrendingUp },
{ title: "Top markets", shortDesc: "Locations with the strongest sales and rental fundamentals", desc: "Which locations are showing the strongest market fundamentals across sales and rental performance?", icon: BarChart3 },
{ title: "Emerging locations", shortDesc: "Early-stage markets where fundamentals are forming", desc: "What does the data show about Bali's emerging property markets \u2014 where are the early fundamentals worth watching?", icon: MapPin },
{ title: "Yield estimator", shortDesc: "Estimate gross and net yield on a specific property", desc: "I'd like to estimate the yield on a property I'm looking at \u2014 how does this work?", icon: Calculator }];

const searchModes = [
{ id: "data-analyst", label: "Data analyst", icon: LineChart },
{ id: "sales-assistant", label: "Sales assistant", icon: ShoppingCart },
{ id: "marketing-assistant", label: "Marketing assistant", icon: Megaphone },
{ id: "portfolio-analyst", label: "Portfolio analyst", icon: PieChart }];


const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const PERSONALISATION_KEY = "reid-personalisation";

async function streamChat({
  messages,
  tier,
  fileContents,
  searchMode,
  onDelta,
  onDone
}: {messages: Msg[];tier: string;fileContents?: {name: string;content: string;}[];searchMode?: string;onDelta: (text: string) => void;onDone: () => void;}) {
  // Load personalisation from localStorage
  let personalisation: Record<string, string> | undefined;
  try {
    const raw = localStorage.getItem(PERSONALISATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.nickname || parsed.occupation || parsed.business || parsed.about) {
        personalisation = parsed;
      }
    }
  } catch {}

  // Load Wix access token for server-side tier verification
  let wixAccessToken: string | undefined;
  try {
    const raw = localStorage.getItem("wix-tokens");
    if (raw) {
      const tokens = JSON.parse(raw);
      wixAccessToken = tokens?.accessToken?.value;
    }
  } catch {}

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    },
    body: JSON.stringify({ messages, tier, fileContents, searchMode, personalisation, wixAccessToken })
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    const errorMsg = errorData.error || `Request failed (${resp.status})`;
    if (resp.status === 429) toast.error("Rate limit exceeded. Please wait a moment.");else
    if (resp.status === 402) toast.error("AI credits exhausted. Please add funds.");else
    toast.error(errorMsg);
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
      if (jsonStr === "[DONE]") {streamDone = true;break;}
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

/* ── Tenure clarification detection ── */
const LOCATION_KEYWORDS = [
  "canggu", "seminyak", "ubud", "uluwatu", "sanur", "berawa", "pererenan",
  "kerobokan", "umalas", "bingin", "balangan", "nyanyi", "seseh", "padonan",
  "kaba kaba", "tabanan", "gianyar", "denpasar", "mengwi", "jimbaran",
  "nusa dua", "pecatu", "ungasan", "kedungu", "tanah lot", "north badung",
  "south badung", "central badung",
];

const SECTOR_KEYWORDS = [
  "villa", "villas", "land", "apartment", "apartments", "commercial",
  "hotel", "hotels", "townhouse", "townhouses",
  "1-bed", "2-bed", "3-bed", "4-bed", "5-bed", "1 bed", "2 bed", "3 bed",
  "4 bed", "5 bed", "studio",
];

const TENURE_ALREADY_SPECIFIED = ["leasehold", "freehold", "both tenure"];

function needsTenureClarification(text: string): boolean {
  const lower = text.toLowerCase();
  // Skip if tenure is already specified
  if (TENURE_ALREADY_SPECIFIED.some(t => lower.includes(t))) return false;
  // Trigger if location or sector keyword is present
  const hasLocation = LOCATION_KEYWORDS.some(k => lower.includes(k));
  const hasSector = SECTOR_KEYWORDS.some(k => lower.includes(k));
  return hasLocation || hasSector;
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
  const [searchMode, setSearchMode] = useState<string>("data-analyst");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showWaPopup, setShowWaPopup] = useState(false);
  const [pendingTenureQuery, setPendingTenureQuery] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const latestAiRef = useRef<HTMLDivElement>(null);
  const [scrollArrowOpacity, setScrollArrowOpacity] = useState(0);
  const [searchParams] = useSearchParams();
  const paramConvoId = searchParams.get("c");
  const paramPrompt = searchParams.get("prompt");
  const { tier, userName } = useTier();

  const greetingName = (() => {
    try {
      const raw = localStorage.getItem(PERSONALISATION_KEY);
      if (raw) {
        const n = JSON.parse(raw).nickname;
        if (n) return n;
      }
    } catch {}
    return userName || "there";
  })();

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
    const title = customTitle || deriveTitle(messages);
    saveConversation({ id, title, messages, updatedAt: Date.now(), pinned: isPinned });
    logConversation({ conversationId: id, title, messages, searchMode });
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

  // Scroll to top of latest AI response when it first appears (user just sent a message)
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    const prev = prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    // When a new user message is added, scroll to bottom so they see their message
    if (messages.length > prev && messages[messages.length - 1]?.role === "user") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // When the first AI chunk appears (assistant message added), scroll to top of that bubble
    if (messages.length > prev && messages[messages.length - 1]?.role === "assistant" && latestAiRef.current) {
      latestAiRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages.length]);

  // Track scroll position to show/hide scroll arrow
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      // Fade from 0 to 1 between 100px and 300px from bottom
      const opacity = Math.min(1, Math.max(0, (distanceFromBottom - 100) / 200));
      setScrollArrowOpacity(opacity);
    };
    container.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendWithTenure = async (input: string, tenure?: string) => {
    if (!input.trim() || isLoading) return;
    trackFeature("chat_message_sent", { search_mode: searchMode });

    // Append tenure context if provided
    const enrichedInput = tenure && tenure !== "both"
      ? `${input}\n\n[Tenure filter: ${tenure} only]`
      : tenure === "both"
        ? `${input}\n\n[Tenure filter: both leasehold and freehold]`
        : input;

    const userMsg: Msg = { role: "user", content: input };
    const msgForAI: Msg = { role: "user", content: enrichedInput };

    const newMessages = [...messages, userMsg];
    const aiMessages = [...messages, msgForAI];
    setMessages(newMessages);
    setQuery("");
    setIsLoading(true);

    // Read attached files as text
    let parsedFiles: {name: string;content: string;}[] | undefined;
    if (attachedFiles.length > 0) {
      parsedFiles = await Promise.all(
        attachedFiles.map(async (file) => {
          const text = await file.text();
          return { name: file.name, content: text.slice(0, 50000) };
        })
      );
      setAttachedFiles([]);
    }

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
        messages: aiMessages,
        tier,
        fileContents: parsedFiles,
        searchMode,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false)
      });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      if (!assistantSoFar) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
      }
    }
  };

  const send = async (input: string) => {
    if (!input.trim() || isLoading) return;
    // Check if we need tenure clarification
    if (needsTenureClarification(input)) {
      // Show user message immediately, then show chips
      const userMsg: Msg = { role: "user", content: input };
      setMessages((prev) => [...prev, userMsg]);
      setQuery("");
      setPendingTenureQuery(input);
      return;
    }
    sendWithTenure(input);
  };

  const handleTenureSelect = (tenure: string) => {
    if (!pendingTenureQuery) return;
    const q = pendingTenureQuery;
    setPendingTenureQuery(null);
    // Remove the user message we already added, sendWithTenure will re-add it
    setMessages((prev) => prev.slice(0, -1));
    sendWithTenure(q, tenure);
  };

  // Auto-send prompt from URL parameter (e.g. from embedded widget)
  const promptHandledRef = useRef(false);
  useEffect(() => {
    if (paramPrompt && !promptHandledRef.current && messages.length === 0) {
      promptHandledRef.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("prompt");
      window.history.replaceState({}, "", url.toString());
      send(paramPrompt);
    }
  }, [paramPrompt]);

  const handleSubmit = () => send(query);
  const hasConversation = messages.length > 0;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const activeMode = searchModes.find((m) => m.id === searchMode);

  const PlusMenu = () =>
  <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="bg-popover w-52">
        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
          <Paperclip className="h-4 w-4 mr-2" />
          Add files
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {searchModes.map((mode) => {
          const isLocked = mode.id !== "data-analyst" && tier !== "enterprise";
          return (
            <DropdownMenuItem
              key={mode.id}
              onClick={() => {
                if (isLocked) {
                  window.open("https://www.realinfo.id/pricing", "_blank");
                } else {
                  setSearchMode(mode.id);
                }
              }}
              className={`cursor-pointer relative ${searchMode === mode.id ? "bg-accent" : ""} ${isLocked ? "opacity-60" : ""}`}>
              <mode.icon className="h-4 w-4 mr-2" />
              {mode.label}
              {isLocked ? (
                <Lock className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              ) : (
                searchMode === mode.id && <span className="ml-auto text-primary text-xs">●</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>;


  return (
    <div className="flex flex-col h-screen">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.txt,.json" />

      {hasConversation &&
      <div className="border-b border-border px-8 py-3 flex items-center justify-between">
          {isRenaming ?
        <div className="flex items-center gap-2">
              <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
            className="text-sm font-extralight border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-card"
            autoFocus />

              <button onClick={submitRename} className="text-xs text-primary font-medium hover:underline">Save</button>
              <button onClick={() => setIsRenaming(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
            </div> :

        <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 text-sm font-extralight text-muted-foreground hover:text-foreground transition-colors focus:outline-none">
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
                        {allFolders.map((f) =>
                    <DropdownMenuItem key={f.id} onClick={() => {if (conversationId) {moveToFolder(conversationId, f.id);window.dispatchEvent(new Event("conversations-updated"));toast.success(`Moved to ${f.name}`);}}} className="cursor-pointer text-xs">
                            <FolderIcon className="h-3.5 w-3.5 mr-2" />
                            {f.name}
                          </DropdownMenuItem>
                    )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {if (conversationId) {moveToFolder(conversationId, undefined);window.dispatchEvent(new Event("conversations-updated"));toast.success("Removed from folder");}}} className="cursor-pointer text-xs">
                          Remove from folder
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>);

            })()}
              </DropdownMenuContent>
            </DropdownMenu>
        }
        </div>
      }

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-8 py-12 bg-background relative">
        {!hasConversation ?
        <div className="max-w-3xl mx-auto">
             <p className="text-base md:text-xl text-muted-foreground font-light mb-1">
               Hi {greetingName},
             </p>
             <h1 className="text-2xl md:text-4xl font-extralight mb-8">What would you like to discover?</h1>
            <div className="relative mb-12">
              {attachedFiles.length > 0 &&
            <div className="flex flex-wrap gap-2 mb-2">
                  {attachedFiles.map((f, i) =>
              <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                      <Paperclip className="h-3 w-3" />
                      {f.name}
                      <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </span>
              )}
                </div>
            }
              <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
              placeholder="Ask REID..."
              className="w-full min-h-[120px] rounded-xl border border-border bg-card p-5 pb-14 pr-14 text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/70" />

              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <PlusMenu />
                {activeMode &&
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <activeMode.icon className="h-3 w-3" />
                    {activeMode.label}
                  </span>
              }
              </div>
              <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">

                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
              {suggestions.map((s) =>
            <button
              key={s.title}
              onClick={() => send(s.desc)}
              className="items-center md:items-start gap-3 md:gap-4 rounded-xl border border-border bg-card px-4 py-3 md:p-5 text-left hover:border-primary/40 hover:shadow-sm transition-all group flex flex-row text-xs font-extralight">

                  <div className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <s.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <h3 className="font-bold md:hidden">{s.title}</h3>
                  <div className="flex-1 min-w-0 hidden md:block">
                    <h3 className="font-bold mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground font-extralight">{s.shortDesc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-auto md:mt-1" />
                </button>
            )}
            </div>
          </div> :

        <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m, i) => {
            const isLastAi = m.role === "assistant" && (i === messages.length - 1 || i === messages.length - 2 && messages[messages.length - 1]?.role !== "assistant");
            const hasDataTeamCTA = m.role === "assistant" && m.content.toLowerCase().includes("reid data team");
            return (
              <div key={i} ref={isLastAi ? latestAiRef : undefined} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm ${
                  m.role === "user" ?
                  "bg-[#ffe3bb] text-foreground rounded-br-md" :
                  "bg-card border border-border rounded-bl-md"}`
                  }>

                  {m.role === "assistant" ?
                   <div className="ai-response prose prose-sm max-w-none dark:prose-invert prose-p:mb-4 prose-headings:mt-5 prose-headings:mb-2 prose-ul:ml-5 prose-ol:ml-5 prose-li:mb-1 prose-hr:my-4" style={{ lineHeight: 1.6 }}>
                       <ReactMarkdown
                       components={{
                         code({ className, children, ...props }) {
                           const match = /language-chart/.exec(className || "");
                           if (match) {
                             const chart = parseChartBlock(String(children).trim());
                             if (chart) return <ChatChart chart={chart} />;
                           }
                           return <code className={className} {...props}>{children}</code>;
                         },
                         pre({ children }) {
                           return <>{children}</>;
                         },
                         h2({ children }) {
                           return <h2 className="text-base font-bold text-foreground mt-5 mb-2">{children}</h2>;
                         },
                         h3({ children }) {
                           return <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5">{children}</h3>;
                         },
                         hr() {
                           return <hr className="border-t border-border/60 my-4" />;
                         },
                         ul({ children }) {
                           return <ul className="list-disc ml-5 space-y-1">{children}</ul>;
                         },
                         ol({ children }) {
                           return <ol className="list-decimal ml-5 space-y-1">{children}</ol>;
                         },
                         strong({ children }) {
                           return <strong className="font-semibold text-foreground">{children}</strong>;
                         },
                       }}>
                       {m.content}</ReactMarkdown>
                     </div> :

                  m.content
                  }
                </div>
                {hasDataTeamCTA && !isLoading && (
                  <button
                    onClick={() => setShowWaPopup(true)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Contact the REID data team
                  </button>
                )}
              </div>);

          })}

            {isLoading && messages[messages.length - 1]?.role === "user" &&
          <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl rounded-bl-md px-5 py-3 flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "200ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "400ms" }} />
                  </div>
                  <span className="text-xs text-muted-foreground font-light">REID is collecting the latest insights</span>
                </div>
              </div>
          }
            <div ref={messagesEndRef} />
          </div>
        }
      </div>

      {hasConversation &&
      <div className="relative z-20 px-8 py-4">
          <div className="max-w-3xl mx-auto">
            {attachedFiles.length > 0 &&
          <div className="flex flex-wrap gap-2 mb-2">
                {attachedFiles.map((f, i) =>
            <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                    <Paperclip className="h-3 w-3" />
                    {f.name}
                    <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
            )}
              </div>
          }
            <div className="relative">
              <textarea
              value={query}
              onChange={(e) => {setQuery(e.target.value);e.target.style.height = "auto";e.target.style.height = e.target.scrollHeight + "px";}}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
              placeholder="Enter a prompt..."
              disabled={isLoading}
              rows={1}
              className="w-full rounded-xl border border-border px-5 py-3 pb-12 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 overflow-hidden"
              style={{ minHeight: "56px" }} />

              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlusMenu />
                  {activeMode &&
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <activeMode.icon className="h-3 w-3" />
                      {activeMode.label}
                    </span>
                }
                </div>
                <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">

                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" &&
              <p className="text-right text-[11px] text-muted-foreground/60 font-light mt-1.5">REID Base is AI and can make mistakes. Please double check responses.</p>
            }
          </div>
        </div>
      }
      <WhatsAppPopup isOpen={showWaPopup} onClose={() => setShowWaPopup(false)} />
    </div>);

}