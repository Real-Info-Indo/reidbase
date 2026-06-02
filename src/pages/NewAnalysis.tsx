import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, ArrowDown, TrendingUp, Building2, BarChart3, Calculator, Loader2, ChevronDown, Pin, Pencil, Folder as FolderIcon, FolderInput, Plus, Paperclip, LineChart, Megaphone, ShoppingCart, PieChart, X, Lock, Copy, ThumbsUp, ThumbsDown, RefreshCw, Share2, Download, Mail, ExternalLink } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import ReactMarkdown from "react-markdown";
import { injectRegionHovers } from "@/components/RegionHover";
import ChatChart, { parseChartBlock } from "@/components/ChatChart";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from
"@/components/ui/dropdown-menu";
import {
  type Msg, type Conversation,
  getConversation, getConversations, saveConversation, generateId, deriveTitle, togglePin, renameConversation,
  getFolders, moveToFolder, type Folder } from
"@/lib/conversations";
import { useTier } from "@/contexts/TierContext";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { WhatsAppPopup } from "@/components/WhatsAppPopup";
import { logConversation, logFeedback, submitFeedbackComment, cloudRenameConversation, cloudTogglePin, cloudMoveToFolder, refreshConversationSummary } from "@/lib/chatLogger";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { trackFeature } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { getCampaign } from "@/lib/campaigns";
import { AssistantMarkdown } from "@/components/AssistantMarkdown";
import {
  ACCEPT_ATTRIBUTE,
  attachmentErrorMessage,
  parseAttachments,
  validateSelection,
} from "@/lib/fileAttachments";

/* ── Freemium daily prompt limit ── */
const DAILY_LIMIT = 10;
const PROMPT_COUNTER_KEY = "reid-daily-prompts";

function getDailyPromptData(): { count: number; resetAt: number } {
  try {
    const raw = localStorage.getItem(PROMPT_COUNTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.resetAt && Date.now() < parsed.resetAt) {
        return { count: parsed.count ?? 0, resetAt: parsed.resetAt };
      }
    }
  } catch {}
  // Expired or missing: start fresh
  const resetAt = Date.now() + 24 * 60 * 60 * 1000;
  const data = { count: 0, resetAt };
  localStorage.setItem(PROMPT_COUNTER_KEY, JSON.stringify(data));
  return data;
}

function incrementDailyPromptCount(): number {
  const data = getDailyPromptData();
  data.count += 1;
  localStorage.setItem(PROMPT_COUNTER_KEY, JSON.stringify(data));
  return data.count;
}

function getTimeUntilReset(): string {
  const data = getDailyPromptData();
  const diff = Math.max(0, data.resetAt - Date.now());
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const suggestions = [
{ title: "Market trends", shortDesc: "Overview of current market dynamics across Bali", desc: "Give me an overview of the current Bali property market \u2014 what are the key trends right now?", icon: TrendingUp },
{ title: "Top markets", shortDesc: "Locations with the strongest sales and rental fundamentals", desc: "Which locations are showing the strongest market fundamentals across sales and rental performance?", icon: BarChart3 },
{ title: "Off-Plan Market", shortDesc: "Explore new development trends and off-plan supply across Bali", desc: "What does the data show about Bali's off-plan property market?", icon: Building2 },
{ title: "Yield estimator", shortDesc: "Estimate gross and net yield on a specific property", desc: "I'd like to estimate the yield on a property I'm looking at \u2014 how does this work?", icon: Calculator }];

const searchModes = [
{ id: "data-analyst", label: "Data analyst", icon: LineChart },
{ id: "sales-assistant", label: "Sales assistant", icon: ShoppingCart },
{ id: "marketing-assistant", label: "Marketing assistant", icon: Megaphone },
{ id: "portfolio-analyst", label: "Portfolio analyst", icon: PieChart }];

/** Strip markdown formatting characters for plain text output (fallback only) */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^---+$/gm, "")
    .trim();
}

/** Convert markdown to a readable plain-text form that preserves structure
 *  (headings as upper-case lines, list bullets, numbered lists, table pipes). */
function markdownToReadablePlainText(md: string): string {
  let out = md;
  // Headings -> blank line + UPPERCASE label
  out = out.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, txt) => {
    const level = hashes.length;
    return level <= 2 ? `\n${txt.toUpperCase()}\n` : `\n${txt}\n`;
  });
  // Bold/italic/strike/code -> drop markers, keep text
  out = out
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_(?!_)(.+?)_(?!_)/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1");
  // Links [text](url) -> "text (url)"
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  // List markers normalise
  out = out.replace(/^\s*[-*+]\s+/gm, "• ");
  // Horizontal rules
  out = out.replace(/^---+$/gm, "------------------------------");
  // Collapse 3+ blank lines
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

/** Convert markdown to WhatsApp-flavoured text (WhatsApp supports *bold*, _italic_, ~strike~, ```mono```). */
function markdownToWhatsApp(md: string): string {
  let out = md;
  // Headings -> *bold* on own line
  out = out.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
  // **bold** -> *bold*
  out = out.replace(/\*\*(.+?)\*\*/g, "*$1*");
  out = out.replace(/__(.+?)__/g, "*$1*");
  // *italic* (single) stays as _italic_; convert _italic_ already valid
  // Links -> "text (url)"
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  // Lists: keep "- " bullets (WhatsApp renders them fine)
  out = out.replace(/^\s*[-*+]\s+/gm, "• ");
  out = out.replace(/^---+$/gm, "──────────────");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

/** Build an HTML string for clipboard rich-text copy (preserves bold, headings, lists, tables). */
function markdownToHtmlForClipboard(md: string): string {
  // Minimal markdown -> HTML conversion good enough for paste targets (Word, Gmail, Docs).
  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split(/\n/);
  let html = "";
  let inUl = false, inOl = false, inTable = false;
  let tableRows: string[][] = [];
  const flushList = () => { if (inUl) { html += "</ul>"; inUl = false; } if (inOl) { html += "</ol>"; inOl = false; } };
  const renderInline = (s: string) => {
    let t = escapeHtml(s);
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/__(.+?)__/g, "<strong>$1</strong>");
    t = t.replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>");
    t = t.replace(/(?<!_)_(?!_)(.+?)_(?!_)/g, "<em>$1</em>");
    t = t.replace(/~~(.+?)~~/g, "<s>$1</s>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
      const safe = /^https?:\/\//i.test(href) ? href : "#";
      return `<a href="${safe}">${label}</a>`;
    });
    return t;
  };
  const flushTable = () => {
    if (!inTable || tableRows.length === 0) { inTable = false; tableRows = []; return; }
    html += '<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;">';
    tableRows.forEach((row, idx) => {
      const tag = idx === 0 ? "th" : "td";
      html += "<tr>" + row.map(c => `<${tag}>${renderInline(c.trim())}</${tag}>`).join("") + "</tr>";
    });
    html += "</table>";
    inTable = false; tableRows = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, "");
    // Table detection: row of pipes
    if (/^\s*\|.+\|\s*$/.test(line)) {
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
      // Skip separator row (---|---)
      if (/^[\s\-:|]+$/.test(line.replace(/\|/g, ""))) continue;
      flushList();
      inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { flushList(); html += `<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`; continue; }
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ul) {
      if (inOl) { html += "</ol>"; inOl = false; }
      if (!inUl) { html += "<ul>"; inUl = true; }
      html += `<li>${renderInline(ul[1])}</li>`;
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (!inOl) { html += "<ol>"; inOl = true; }
      html += `<li>${renderInline(ol[1])}</li>`;
      continue;
    }
    if (/^---+$/.test(line)) { flushList(); html += "<hr/>"; continue; }
    if (line.trim() === "") { flushList(); html += ""; continue; }
    flushList();
    html += `<p>${renderInline(line)}</p>`;
  }
  flushList();
  flushTable();
  return html;
}

/** Copy markdown content as both rich HTML and plain text so paste targets keep formatting. */
async function copyFormatted(md: string): Promise<void> {
  const html = markdownToHtmlForClipboard(md);
  const plain = markdownToReadablePlainText(md);
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return;
    }
  } catch { /* fall through to plain text */ }
  await navigator.clipboard.writeText(plain);
}

/** Render markdown to a styled PDF by rasterising a hidden HTML node so headings, bold,
 *  lists and tables are preserved visually. */
async function downloadResponseAsPdf(content: string, chatTitle?: string) {
  const html = markdownToHtmlForClipboard(content);
  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed", "left:-10000px", "top:0", "width:760px",
    "padding:32px", "background:#ffffff", "color:#0f172a",
    "font-family:'Poppins',Arial,sans-serif", "font-size:13px", "line-height:1.55",
  ].join(";");
  container.innerHTML = `
    <div style="border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px;">
      <div style="font-weight:600;font-size:16px;color:#0f172a;">REID Base</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px;">${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
    <style>
      h1,h2,h3,h4,h5,h6 { color:#0f172a; margin:14px 0 6px; line-height:1.3; }
      h1 { font-size:20px; } h2 { font-size:17px; } h3 { font-size:15px; }
      h4,h5,h6 { font-size:13px; }
      p { margin:6px 0; }
      ul,ol { margin:6px 0 6px 22px; padding:0; }
      li { margin:3px 0; }
      table { width:100%; margin:10px 0; font-size:12px; border-color:#e5e7eb !important; }
      th { background:#f8f4ec; text-align:left; }
      th, td { border:1px solid #e5e7eb; padding:6px 8px; }
      hr { border:none; border-top:1px solid #e5e7eb; margin:12px 0; }
      code { background:#f3f4f6; padding:1px 4px; border-radius:3px; font-size:12px; }
      a { color:#b07a1c; text-decoration:none; }
      strong { color:#0f172a; }
    </style>
    <div>${html}</div>
  `;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    const safeName = (chatTitle || "REID_Response").replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
    pdf.save(`${safeName}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}


const modeToFunction: Record<string, string> = {
  "data-analyst": "chat-data-analyst",
  "sales-assistant": "chat-sales-assistant",
  "marketing-assistant": "chat-marketing-assistant",
  "portfolio-analyst": "chat-portfolio-analyst",
};

const PERSONALISATION_KEY = "reid-personalisation";

type ChatErrorKind =
  | "rate_limited"
  | "credits_exhausted"
  | "payload_too_large"
  | "invalid_query"
  | "bad_request"
  | "unauthorised"
  | "timeout"
  | "server_error"
  | "network"
  | "stream_interrupted"
  | "unknown";

interface ChatError extends Error {
  kind?: ChatErrorKind;
  status?: number;
}

async function streamChat({
  messages,
  tier,
  fileContents,
  searchMode,
  conversationId,
  onDelta,
  onDone
}: {
  messages: Msg[];
  tier: string;
  fileContents?: { name: string; content: string; }[];
  searchMode?: string;
  conversationId?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  // Load personalisation from localStorage, enriched with display_name from Wix session
  let personalisation: Record<string, string> | undefined;
  try {
    const raw = localStorage.getItem(PERSONALISATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.nickname || parsed.occupation || parsed.business || parsed.about) {
        personalisation = { ...parsed };
      }
    }
  } catch {}
  try {
    const memberRaw = localStorage.getItem("wix-member");
    if (memberRaw) {
      const member = JSON.parse(memberRaw);
      const displayName = member?.displayName;
      if (displayName) {
        personalisation = personalisation || {};
        personalisation.display_name = displayName;
      }
    }
  } catch {}

  // Load wixUserId for server-side memory lookup
  let wixUserId: string | undefined;
  try {
    const raw = localStorage.getItem("wix-member");
    if (raw) {
      const member = JSON.parse(raw);
      wixUserId = member?.id;
    }
  } catch {}

  const functionName = modeToFunction[searchMode ?? "data-analyst"] ?? "chat-data-analyst";
  const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

  // Wix access token for server-side identity verification. Only send it as
  // the Authorization header when present — passing the Supabase anon key as
  // a Bearer token would cause the edge function to reject it against the Wix
  // Members API. Anonymous data-analyst calls proceed with no Authorization
  // header; the apikey header is sufficient for Supabase routing.
  let wixAccessToken: string | null = null;
  try {
    const raw = localStorage.getItem("wix-tokens");
    if (raw) wixAccessToken = JSON.parse(raw)?.accessToken?.value ?? null;
  } catch {}

  let resp: Response;
  try {
    resp = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(wixAccessToken ? { Authorization: `Bearer ${wixAccessToken}` } : {}),
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages, tier, fileContents, searchMode, personalisation, wixUserId, conversationId })
    });
  } catch (e) {
    const err = new Error("Network error. Please check your connection and try again.") as ChatError;
    err.kind = "network";
    throw err;
  }

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({} as any));
    const code = errorData?.error;
    const fallback = errorData?.message || errorData?.error || `Request failed (${resp.status})`;
    let kind: ChatErrorKind = "unknown";
    let errorMsg = fallback;
    if (resp.status === 429) {
      kind = "rate_limited";
      errorMsg = "You're sending prompts too quickly. Please wait a few seconds and try again.";
    } else if (resp.status === 402) {
      kind = "credits_exhausted";
      errorMsg = "The AI service has run out of credits. Please contact the REID team.";
    } else if (resp.status === 413 || code === "attachment_too_large" || code === "payload_too_large") {
      kind = "payload_too_large";
      errorMsg = attachmentErrorMessage(code, fallback);
    } else if (resp.status === 400 && /invalid query/i.test(String(code) + " " + fallback)) {
      kind = "invalid_query";
      errorMsg = "I couldn't build a valid data query for that request. Try rephrasing or being more specific (e.g. include a location and property type).";
    } else if (resp.status === 400) {
      kind = "bad_request";
      errorMsg = attachmentErrorMessage(code, fallback);
    } else if (resp.status === 401 || resp.status === 403) {
      kind = "unauthorised";
      errorMsg = "Your session has expired. Please sign in again.";
    } else if (resp.status === 504 || resp.status === 408) {
      kind = "timeout";
      errorMsg = "That request took too long. Try a shorter prompt or splitting it into smaller questions.";
    } else if (resp.status >= 500) {
      kind = "server_error";
      errorMsg = "The AI service is temporarily unavailable. Please try again in a moment.";
    }
    toast.error(errorMsg);
    const err = new Error(errorMsg) as ChatError;
    err.kind = kind;
    err.status = resp.status;
    throw err;
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

const RENTAL_KEYWORDS = [
  "occupancy", "adr", "average daily rate", "daily rate", "nightly rate",
  "rental performance", "rental data", "rental income", "rental yield",
  "management", "property manager", "managed", "airbnb", "booking",
  "guest", "guests", "night", "nights", "monthly rate", "revenue per",
];

const TRANSACTION_KEYWORDS = [
  "price", "pricing", "sale", "sales", "sold", "buy", "buying", "purchase",
  "supply", "median", "average price", "cost", "asking price", "listed",
  "listing", "listings", "transaction", "transactions", "market value",
  "price per sqm", "clearance", "days on market", "days listed",
  "fsr", "off-plan", "off plan", "land price",
];

function extractLocations(text: string): string[] {
  const lower = text.toLowerCase();
  return LOCATION_KEYWORDS.filter(k => lower.includes(k));
}

function needsTenureClarification(text: string, clarifiedLocations: Set<string>): boolean {
  const lower = text.toLowerCase();
  // Skip if tenure is already specified
  if (TENURE_ALREADY_SPECIFIED.some(t => lower.includes(t))) return false;
  // Skip for rental-related queries
  const isRentalQuery = RENTAL_KEYWORDS.some(k => lower.includes(k));
  const isTransactionQuery = TRANSACTION_KEYWORDS.some(k => lower.includes(k));
  // If purely rental with no transaction keywords, skip
  if (isRentalQuery && !isTransactionQuery) return false;
  // Only trigger for location-specific queries with transaction context
  const locations = extractLocations(text);
  if (locations.length === 0) return false;
  // If no transaction keywords detected, still show for general location queries
  // Skip if all mentioned locations have already been clarified
  const hasNewLocation = locations.some(loc => !clarifiedLocations.has(loc));
  return hasNewLocation;
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
  const [feedbackDialog, setFeedbackDialog] = useState<{ open: boolean; rating: "like" | "dislike" | null; messageIndex: number | null }>({ open: false, rating: null, messageIndex: null });
  const [pendingTenureQuery, setPendingTenureQuery] = useState<string | null>(null);
  const [selectedTenure, setSelectedTenure] = useState<string | null>(null);
  // Derived from message history so tenure clarification persists across reloads
  // and is scoped to the current conversation. A location is "clarified" once a
  // user message in this conversation contains a [Tenure filter: ...] marker
  // (added by sendWithTenure) or the user explicitly typed leasehold/freehold.
  const clarifiedLocations = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const m of messages) {
      if (m.role !== "user") continue;
      const content = m.content || "";
      const lower = content.toLowerCase();
      const hasTenureMarker =
        lower.includes("[tenure filter:") ||
        TENURE_ALREADY_SPECIFIED.some((t) => lower.includes(t));
      if (!hasTenureMarker) continue;
      for (const loc of extractLocations(content)) set.add(loc);
    }
    return set;
  }, [messages]);
  const [dailyPromptCount, setDailyPromptCount] = useState(() => getDailyPromptData().count);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const latestAiRef = useRef<HTMLDivElement>(null);
  const [scrollArrowOpacity, setScrollArrowOpacity] = useState(0);
  const [searchParams] = useSearchParams();
  const paramConvoId = searchParams.get("c");
  const paramPrompt = searchParams.get("prompt");
  const paramFolderId = searchParams.get("folder");
  const pendingFolderIdRef = useRef<string | null>(null);
  const { tier, userName } = useTier();
  const { isLoggedIn, login } = useWixAuth();
  // Free tier ("free" canonical, legacy "member" treated as free).
  const isFreemium = tier === "free" || tier === "member";
  const limitReached = isFreemium && dailyPromptCount >= DAILY_LIMIT;

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
    setCustomTitle(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("c");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const handleModeSelect = (modeId: string, isLocked: boolean) => {
    if (isLocked) {
      window.open("https://www.realinfo.id/pricing-plans/plans-pricing", "_blank");
      return;
    }

    if (searchMode !== modeId) {
      trackFeature("mode_selected", {
        search_mode: modeId,
        previous_mode: searchMode,
      });
    }

    setSearchMode(modeId);
  };

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
      setCustomTitle(null);
    }
    // Capture folder hint for the next conversation that gets created.
    if (!paramConvoId && paramFolderId) {
      pendingFolderIdRef.current = paramFolderId;
    }
  }, [paramConvoId, paramFolderId]);

  // Seed a conversation from an email-campaign landing.
  // Triggered when the user signs in from /campaign/:slug and is redirected
  // to /?campaign=<slug>&draft=<text>. Creates a real conversation owned by
  // the user, prefills the input with their draft (if any), and cleans the
  // URL so a refresh doesn't re-seed.
  const campaignSeededRef = useRef(false);
  useEffect(() => {
    if (campaignSeededRef.current) return;
    const campaignSlug = searchParams.get("campaign");
    if (!campaignSlug) return;
    const campaign = getCampaign(campaignSlug);
    if (!campaign) return;
    campaignSeededRef.current = true;

    const draft = searchParams.get("draft") || "";
    const id = generateId();
    const seeded: Msg[] = [
      { role: "user", content: campaign.userPrompt },
      { role: "assistant", content: campaign.assistantMessage },
    ];
    saveConversation({
      id,
      title: campaign.title,
      messages: seeded,
      updatedAt: Date.now(),
    });
    setConversationId(id);
    setMessages(seeded);
    setCustomTitle(campaign.title);
    if (draft) setQuery(draft);
    trackFeature("campaign_seeded", { slug: campaign.slug });

    const url = new URL(window.location.href);
    url.searchParams.delete("campaign");
    url.searchParams.delete("draft");
    url.searchParams.set("c", id);
    window.history.replaceState({}, "", url.toString());
    window.dispatchEvent(new Event("conversations-updated"));
  }, [searchParams]);

  useEffect(() => {
    const handler = () => startNew();
    window.addEventListener("new-analysis-reset", handler);
    return () => window.removeEventListener("new-analysis-reset", handler);
  }, [startNew]);

  const persistRef = useRef<string | null>(null);
  const lastSummarisedCountRef = useRef<number>(0);
  useEffect(() => {
    if (messages.length === 0) return;
    const id = conversationId ?? generateId();
    const isNewConvo = !conversationId;
    if (isNewConvo) {
      setConversationId(id);
      const url = new URL(window.location.href);
      url.searchParams.set("c", id);
      url.searchParams.delete("folder");
      window.history.replaceState({}, "", url.toString());
    }
    persistRef.current = id;
    const title = customTitle || deriveTitle(messages);
    // Read folderId from existing record before saveConversation overwrites it.
    // For brand-new conversations created with a ?folder= hint, use that.
    const existingFolderId = getConversation(id)?.folderId;
    const folderId = existingFolderId ?? (isNewConvo ? pendingFolderIdRef.current ?? undefined : undefined);
    if (isNewConvo && pendingFolderIdRef.current) {
      pendingFolderIdRef.current = null;
    }
    saveConversation({ id, title, messages, updatedAt: Date.now(), pinned: isPinned, folderId });
    logConversation({ conversationId: id, title, messages, searchMode, userTier: tier, pinned: isPinned, folderId });
    window.dispatchEvent(new Event("conversations-updated"));

    // Folder memory: ask the backend to refresh this conversation's summary
    // after each completed assistant turn when it belongs to a folder.
    // The backend skips work unless 4+ new messages have accrued.
    const last = messages[messages.length - 1];
    if (
      folderId &&
      last?.role === "assistant" &&
      messages.length !== lastSummarisedCountRef.current &&
      messages.length >= 2
    ) {
      lastSummarisedCountRef.current = messages.length;
      refreshConversationSummary(id).catch(() => {});
    }
  }, [messages, conversationId]);

  const displayTitle = customTitle || deriveTitle(messages);

  // Folder context indicator: show when this conversation belongs to a folder,
  // OR when a new conversation has been started inside a folder via ?folder=.
  const folderContext = useMemo(() => {
    let folderId: string | undefined;
    if (conversationId) {
      folderId = getConversation(conversationId)?.folderId;
    }
    if (!folderId) folderId = pendingFolderIdRef.current ?? paramFolderId ?? undefined;
    if (!folderId) return null;
    const folder = getFolders().find((f) => f.id === folderId);
    if (!folder) return null;
    const siblings = getConversations().filter(
      (c) => c.folderId === folderId && c.id !== conversationId
    );
    return { name: folder.name, count: siblings.length };
  }, [conversationId, messages.length, paramFolderId]);

  const handlePin = () => {
    if (!conversationId) return;
    togglePin(conversationId);
    const next = !isPinned;
    setIsPinned(next);
    window.dispatchEvent(new Event("conversations-updated"));
    cloudTogglePin(conversationId, next).catch(err => console.error("cloudTogglePin failed:", err));
    toast.success(next ? "Pinned to top" : "Unpinned");
  };

  const handleRename = () => {
    setRenameValue(displayTitle);
    setIsRenaming(true);
  };

  const handleShareLink = async () => {
    if (!conversationId || messages.length === 0) {
      toast.error("Nothing to share yet");
      return;
    }
    const shareId = generateId();
    const { invokeUserData } = await import("@/lib/userDataApi");
    const { error } = await invokeUserData("share_conversation", {
      share_id: shareId,
      conversation: {
        conversation_id: conversationId,
        title: displayTitle,
        messages: messages as any,
        search_mode: searchMode,
        tier,
      },
    });
    if (error) {
      console.error(error);
      toast.error("Could not create share link");
      return;
    }
    const url = `${window.location.origin}/shared/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.message("Share link", { description: url });
    }
    trackFeature("conversation_shared", { conversation_id: conversationId, share_id: shareId });
  };

  const submitRename = () => {
    if (!conversationId || !renameValue.trim()) return;
    renameConversation(conversationId, renameValue.trim());
    setCustomTitle(renameValue.trim());
    setIsRenaming(false);
    window.dispatchEvent(new Event("conversations-updated"));
    cloudRenameConversation(conversationId, renameValue.trim()).catch(err => console.error("cloudRename failed:", err));
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
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendWithTenure = async (input: string, tenure?: string, skipAddUserMsg = false) => {
    if (!input.trim() || isLoading) return;
    // Check limit using fresh localStorage data to avoid stale closure issues
    if (isFreemium) {
      const currentData = getDailyPromptData();
      if (currentData.count >= DAILY_LIMIT) {
        setDailyPromptCount(currentData.count);
        return;
      }
    }
    const existingUserMessageCount = messages.filter((message) => message.role === "user").length;
    const isFirstPrompt = existingUserMessageCount === 0;

    if (isFirstPrompt) {
      trackFeature("conversation_started", {
        search_mode: searchMode,
        entry_point: paramPrompt ? "widget" : "app",
      });
      trackFeature("funnel_first_prompt", { search_mode: searchMode });
    }

    trackFeature("chat_message_sent", {
      search_mode: searchMode,
      message_index: existingUserMessageCount + (skipAddUserMsg ? 0 : 1),
      has_attachments: attachedFiles.length > 0,
    });

    // Append tenure context if provided
    const enrichedInput = tenure && tenure !== "both"
      ? `${input}\n\n[Tenure filter: ${tenure} only]`
      : tenure === "both"
        ? `${input}\n\n[Tenure filter: both leasehold and freehold]`
        : input;

    const userMsg: Msg = { role: "user", content: input };
    const msgForAI: Msg = { role: "user", content: enrichedInput };

    const newMessages = skipAddUserMsg ? [...messages] : [...messages, userMsg];
    const aiMessages = skipAddUserMsg ? [...messages.slice(0, -1), msgForAI] : [...messages, msgForAI];
    if (!skipAddUserMsg) setMessages(newMessages);
    setQuery("");
    setIsLoading(true);
    // Increment prompt count AFTER the message is committed
    if (isFreemium) {
      const newCount = incrementDailyPromptCount();
      setDailyPromptCount(newCount);
    }

    // Read attached files as text. Only safe text formats are accepted at
    // selection time; binary formats (PDF/DOCX/XLSX) are rejected up front.
    let parsedFiles: { name: string; content: string }[] | undefined;
    if (attachedFiles.length > 0) {
      try {
        parsedFiles = await parseAttachments(attachedFiles);
      } catch (e: any) {
        toast.error(attachmentErrorMessage(e?.code, e?.message || "Could not read attachments."));
        setIsLoading(false);
        return;
      }
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
        return [...prev, { role: "assistant", content: assistantSoFar, mode: searchMode }];
      });
    };

    try {
      await streamChat({
        messages: aiMessages,
        tier,
        fileContents: parsedFiles,
        searchMode,
        conversationId: conversationId ?? undefined,
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => {
          setIsLoading(false);
          trackFeature("chat_response_completed", {
            search_mode: searchMode,
            response_chars: assistantSoFar.length,
          });
        }
      });
    } catch (e) {
      console.error(e);
      trackFeature("chat_response_failed", { search_mode: searchMode });
      setIsLoading(false);
      if (!assistantSoFar) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again.", mode: searchMode }]);
      }
    }
  };

  const send = async (input: string) => {
    if (!input.trim() || isLoading) return;
    // Unauthenticated users can browse the platform, but sending a prompt
    // requires a REID account. Trigger the Wix OAuth login flow instead.
    if (!isLoggedIn) {
      toast.info("Sign in to your REID account to start a conversation.");
      void login();
      return;
    }
    // Check if we need tenure clarification
    if (needsTenureClarification(input, clarifiedLocations)) {
      // Add user message so the conversation view activates and the tenure popup is visible
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
    // Locations are derived from messages; the [Tenure filter: ...] marker
    // appended by sendWithTenure marks them clarified for the rest of this conversation.
    setPendingTenureQuery(null);
    setSelectedTenure(null);
    // The user message is already in messages from send(); tell sendWithTenure to skip adding it again
    sendWithTenure(q, tenure, true);
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
      const incoming = Array.from(e.target.files);
      const { accepted, rejections } = validateSelection(incoming, attachedFiles);
      for (const r of rejections) toast.error(r.message);
      if (accepted.length) setAttachedFiles((prev) => [...prev, ...accepted]);
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
          const isLocked = mode.id !== "data-analyst"
            && mode.id !== "sales-assistant"
              ? tier !== "enterprise"
              : (mode.id === "sales-assistant" && tier !== "enterprise" && tier !== "reid_base_pro");
          return (
            <DropdownMenuItem
              key={mode.id}
              onClick={() => handleModeSelect(mode.id, isLocked)}
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
    <div className="flex flex-col h-screen w-full min-w-0 overflow-x-hidden">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept={ACCEPT_ATTRIBUTE} />

      {hasConversation &&
      <div className="border-b border-sidebar-border px-4 md:px-8 py-4 flex items-center justify-between gap-4 h-[3.5rem]">
          <div className="flex items-center gap-4 min-w-0 flex-1">
          {isRenaming ?
        <div className="flex items-center gap-2 min-w-0">
              <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()}
            className="text-sm font-extralight border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-card min-w-0 flex-1"
            autoFocus />

              <button onClick={submitRename} className="text-xs text-primary font-medium hover:underline shrink-0">Save</button>
              <button onClick={() => setIsRenaming(false)} className="text-xs text-muted-foreground hover:underline shrink-0">Cancel</button>
            </div> :

        <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 text-sm font-extralight text-muted-foreground hover:text-foreground transition-colors focus:outline-none min-w-0 max-w-full px-1 py-1 -mx-1 rounded-md">
                {isPinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                <span className="truncate">{displayTitle}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="bg-popover min-w-[200px] py-1.5">
                <DropdownMenuItem onClick={handlePin} className="cursor-pointer">
                  <Pin className="h-4 w-4 mr-2" />
                  {isPinned ? "Unpin" : "Pin to top"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRename} className="cursor-pointer">
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareLink} className="cursor-pointer">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share via link
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
                    <DropdownMenuItem key={f.id} onClick={() => {if (conversationId) {moveToFolder(conversationId, f.id);window.dispatchEvent(new Event("conversations-updated"));cloudMoveToFolder(conversationId, f.id).catch(err => console.error("cloudMoveToFolder failed:", err));refreshConversationSummary(conversationId, true).catch(() => {});toast.success(`Moved to ${f.name}`);}}} className="cursor-pointer text-xs">
                            <FolderIcon className="h-3.5 w-3.5 mr-2" />
                            {f.name}
                          </DropdownMenuItem>
                    )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {if (conversationId) {moveToFolder(conversationId, undefined);window.dispatchEvent(new Event("conversations-updated"));cloudMoveToFolder(conversationId, undefined).catch(err => console.error("cloudMoveToFolder failed:", err));toast.success("Removed from folder");}}} className="cursor-pointer text-xs">
                          Remove from folder
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>);

            })()}
              </DropdownMenuContent>
            </DropdownMenu>
        }
          {folderContext && (
            <span
              title={folderContext.count > 0
                ? `REID is drawing on ${folderContext.count} related conversation${folderContext.count === 1 ? "" : "s"} in this folder.`
                : "This conversation will build context for others added to this folder."}
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-extralight text-muted-foreground bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1"
            >
              <FolderIcon className="h-3 w-3 text-primary" />
              <span className="truncate max-w-[180px]">{folderContext.name}</span>
              {folderContext.count > 0 && (
                <span className="text-primary font-medium">· {folderContext.count} related</span>
              )}
            </span>
          )}
          </div>
        </div>
      }

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain px-3 md:px-8 py-12 bg-background relative">
        {!hasConversation ?
        <div className="max-w-3xl mx-auto">
             {isLoggedIn && (
               <p className="text-base md:text-xl text-muted-foreground font-light mb-1">
                 Hi {greetingName},
               </p>
             )}
             <h1 className="text-2xl md:text-4xl font-extralight mb-8">What would you like to discover?</h1>
            {folderContext && (
              <div className="mb-2 flex justify-start">
                <span
                  title={folderContext.count > 0
                    ? `REID is drawing on ${folderContext.count} related conversation${folderContext.count === 1 ? "" : "s"} in this folder.`
                    : "This conversation will build context for others added to this folder."}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-foreground"
                >
                  <FolderIcon className="h-3 w-3 text-primary" />
                  <span className="truncate max-w-[180px]">{folderContext.name}</span>
                  {folderContext.count > 0 && (
                    <span className="text-primary font-medium">· {folderContext.count} related</span>
                  )}
                </span>
              </div>
            )}
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
              onChange={(e) => {
                setQuery(e.target.value);
                e.target.style.height = "auto";
                const maxH = 300;
                e.target.style.height = Math.min(e.target.scrollHeight, maxH) + "px";
                e.target.style.overflowY = e.target.scrollHeight > maxH ? "auto" : "hidden";
              }}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
              placeholder="Ask REID..."
              className="w-full rounded-xl border border-border bg-card p-5 pb-14 pr-14 text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/70 overflow-y-auto shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
              style={{ minHeight: "120px", maxHeight: "300px", paddingBottom: "56px" }} />

              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <PlusMenu />
                {activeMode &&
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <activeMode.icon className="h-3 w-3" />
                    {activeMode.label}
                  </span>
              }
              </div>
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                {isFreemium && (
                  <span className="text-xs text-muted-foreground/60 font-light">{dailyPromptCount}/{DAILY_LIMIT}</span>
                )}
                <button
                onClick={handleSubmit}
                disabled={isLoading || limitReached}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                </button>
              </div>
              {limitReached && (
                <div className="absolute inset-0 rounded-xl bg-card/95 flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm font-medium text-foreground mb-2">You've reached your 10-prompt limit for today.</p>
                  <p className="text-xs text-muted-foreground mb-3">Your access resets in 24 hours. For unlimited queries and full market data access, upgrade to a REID membership.</p>
                  <a
                    href="https://www.realinfo.id/pricing-plans/plans-pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Explore plans <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
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
            const hasUpgradeCTA = m.role === "assistant" && (
              m.content.toLowerCase().includes("available on reid base") ||
              m.content.toLowerCase().includes("available on the pro tier") ||
              m.content.toLowerCase().includes("available on the enterprise tier") ||
              m.content.toLowerCase().includes("explore our pricing plans") ||
              m.content.toLowerCase().includes("requires a pro or enterprise")
            );
            return (
              <div key={i} ref={isLastAi ? latestAiRef : undefined} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.role === "assistant" && (
                  <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: "8px", letterSpacing: "0.05em" }} className="text-muted-foreground mb-1 ml-1 uppercase">
                    REID {searchModes.find(sm => sm.id === m.mode)?.label || "Data analyst"}
                  </span>
                )}
                <div
                  className={`rounded-2xl px-5 py-3 text-sm ${
                  m.role === "user" ?
                  "max-w-[80%] bg-[#ffe3bb] text-foreground rounded-br-md" :
                  "w-full bg-transparent rounded-bl-md"}`
                  }>

                  {m.role === "user" ? (
                    <div className="whitespace-pre-wrap">
                      {(() => {
                        const lines = m.content.split("\n");
                        const result: React.ReactNode[] = [];
                        let bulletBuffer: string[] = [];
                        const flushBullets = () => {
                          if (bulletBuffer.length > 0) {
                            result.push(
                              <ul key={`ul-${result.length}`} className="list-disc pl-5 my-1 space-y-0.5">
                                {bulletBuffer.map((b, bi) => <li key={bi}>{b}</li>)}
                              </ul>
                            );
                            bulletBuffer = [];
                          }
                        };
                        lines.forEach((line, li) => {
                          const bulletMatch = line.match(/^\s*[-–—•]\s+(.*)$/);
                          if (bulletMatch) {
                            bulletBuffer.push(bulletMatch[1]);
                          } else {
                            flushBullets();
                            result.push(<span key={li}>{line}{li < lines.length - 1 ? "\n" : ""}</span>);
                          }
                        });
                        flushBullets();
                        return result;
                      })()}
                    </div>
                  ) : null}
                  {m.role === "assistant" ? (
                    <AssistantMarkdown content={m.content} />
                  ) : null}
                </div>
                {m.role === "assistant" && !isLoading && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      onClick={async () => { try { await copyFormatted(m.content); toast.success("Copied to clipboard"); } catch { toast.error("Copy failed"); } if (conversationId) logFeedback(conversationId, "copy"); }}
                      className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                      title="Copy response"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (conversationId) logFeedback(conversationId, "like"); setFeedbackDialog({ open: true, rating: "like", messageIndex: i }); }}
                      className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                      title="Good response"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { if (conversationId) logFeedback(conversationId, "dislike"); setFeedbackDialog({ open: true, rating: "dislike", messageIndex: i }); }}
                      className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                      title="Poor response"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        const userMsg = messages.slice(0, i).reverse().find(msg => msg.role === "user");
                        if (userMsg) {
                          setMessages((prev) => prev.filter((_, idx) => idx !== i));
                          sendWithTenure(userMsg.content);
                        }
                      }}
                      className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                      title="Regenerate response"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                          title="Share response"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[160px]">
                        <DropdownMenuItem onClick={() => {
                          const formatted = markdownToWhatsApp(m.content);
                          const text = encodeURIComponent(formatted.slice(0, 2000));
                          window.open(`https://wa.me/?text=${text}`, "_blank");
                        }}>
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#25D366] mr-2 shrink-0" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Share via WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const formatted = markdownToReadablePlainText(m.content);
                          const subject = encodeURIComponent("REID Base Market Intelligence");
                          const body = encodeURIComponent(formatted.slice(0, 1800));
                          window.location.href = `mailto:?subject=${subject}&body=${body}`;
                        }}>
                          <Mail className="h-4 w-4 mr-2 shrink-0" />
                          Share via email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      onClick={async () => { try { await downloadResponseAsPdf(m.content, displayTitle); toast.success("PDF downloaded"); } catch (e) { console.error(e); toast.error("PDF download failed"); } }}
                      className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
                      title="Download as PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
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
                {hasUpgradeCTA && !isLoading && (
                  <a
                    href="https://www.realinfo.id/pricing-plans/plans-pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Pricing plans
                  </a>
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
            {/* Tenure clarification popup */}
            {pendingTenureQuery && !isLoading && (
              <div className="mb-3 rounded-xl border border-border bg-card shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                <div className="px-5 pt-4 pb-2">
                  <p className="text-sm font-medium text-foreground mb-3">Which tenure type are you interested in?</p>
                  <div className="space-y-2">
                    {[
                      { label: "Leasehold", value: "leasehold", desc: "Time-limited ownership, typically 25 to 30 years with extension options" },
                      { label: "Freehold", value: "freehold", desc: "Full ownership rights, available through specific legal structures" },
                      { label: "Both", value: "both", desc: "Compare leasehold and freehold data side by side" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSelectedTenure(opt.value)}
                        className={`w-full flex items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors border ${
                          selectedTenure === opt.value
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-accent"
                        }`}
                      >
                        <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          selectedTenure === opt.value ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}>
                          {selectedTenure === opt.value && (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
                  <button
                    onClick={() => { setPendingTenureQuery(null); setSelectedTenure(null); setMessages((prev) => prev.slice(0, -1)); }}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => selectedTenure && handleTenureSelect(selectedTenure)}
                    disabled={!selectedTenure}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}
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
            {folderContext && !limitReached && (
              <div className="mb-2 flex justify-start">
                <span
                  title={folderContext.count > 0
                    ? `REID is drawing on ${folderContext.count} related conversation${folderContext.count === 1 ? "" : "s"} in this folder.`
                    : "This conversation will build context for others added to this folder."}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-foreground"
                >
                  <FolderIcon className="h-3 w-3 text-primary" />
                  <span className="truncate max-w-[180px]">{folderContext.name}</span>
                  {folderContext.count > 0 && (
                    <span className="text-primary font-medium">· {folderContext.count} related</span>
                  )}
                </span>
              </div>
            )}
            {limitReached ? (
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <p className="text-sm font-medium text-foreground mb-2">You've reached your 10-prompt limit for today.</p>
                <p className="text-xs text-muted-foreground mb-3">Your access resets in 24 hours. For unlimited queries and full market data access, upgrade to a REID membership.</p>
                <a
                  href="https://www.realinfo.id/pricing-plans/plans-pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Explore plans <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
            <div className="relative">
              <textarea
              value={query}
              onChange={(e) => {setQuery(e.target.value);e.target.style.height = "auto";const maxH = 200;e.target.style.height = Math.min(e.target.scrollHeight, maxH) + "px";e.target.style.overflowY = e.target.scrollHeight > maxH ? "auto" : "hidden";}}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
              placeholder="Enter a prompt..."
              disabled={isLoading}
              rows={1}
              className="w-full rounded-xl border border-border bg-card px-5 py-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 overflow-y-auto shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
              style={{ minHeight: "56px", maxHeight: "200px", paddingBottom: "48px" }} />

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
                <div className="flex items-center gap-2">
                  {isFreemium && (
                    <span className="text-xs text-muted-foreground/60 font-light">{dailyPromptCount}/{DAILY_LIMIT}</span>
                  )}
                  <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            )}
            {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" &&
              <p className="text-right text-[11px] md:text-[11px] text-[9px] text-muted-foreground/60 font-light mt-1.5">REID Base is AI and can make mistakes. Please double check responses.</p>
            }
          </div>
        </div>
      }
      <WhatsAppPopup isOpen={showWaPopup} onClose={() => setShowWaPopup(false)} />
      <FeedbackDialog
        open={feedbackDialog.open}
        rating={feedbackDialog.rating}
        onClose={() => setFeedbackDialog({ open: false, rating: null, messageIndex: null })}
        onSubmit={(comment) => {
          if (conversationId && feedbackDialog.rating) {
            submitFeedbackComment(conversationId, feedbackDialog.rating, comment, feedbackDialog.messageIndex ?? undefined);
          }
          setFeedbackDialog({ open: false, rating: null, messageIndex: null });
          toast.success("Thanks for the feedback");
        }}
      />
    </div>);

}