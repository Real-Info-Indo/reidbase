import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowRight, Loader2, Lock, Share2, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { useTier } from "@/contexts/TierContext";
import { saveConversation, generateId, type Msg } from "@/lib/conversations";
import { logConversation } from "@/lib/chatLogger";
import { toast } from "sonner";
import ChatChart, { parseChartBlock } from "@/components/ChatChart";

interface SharedConversationRow {
  id: string;
  title: string;
  messages: Msg[];
  search_mode: string | null;
  sharer_name: string | null;
  sharer_tier: string | null;
  created_at: string;
}

const TIER_RANK: Record<string, number> = {
  member: 0,
  reid_base: 1,
  reid_base_pro: 2,
  enterprise: 3,
};

function tierLabel(t?: string | null): string {
  switch (t) {
    case "member": return "Free";
    case "reid_base": return "Member";
    case "reid_base_pro": return "Pro";
    case "enterprise": return "Enterprise";
    default: return "Member";
  }
}

export default function SharedConversation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, isLoading: authLoading } = useWixAuth();
  const { tier: viewerTier } = useTier();

  const [snapshot, setSnapshot] = useState<SharedConversationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist this shared URL as the post-login destination, so that whenever
  // the recipient signs in (via our CTA, the sidebar, or any other entry
  // point), they are returned to this conversation rather than the home page.
  useEffect(() => {
    if (!id) return;
    if (authLoading) return;
    if (isLoggedIn) return;
    try {
      localStorage.setItem(
        "wix-post-login-redirect",
        `${window.location.origin}/shared/${id}`,
      );
    } catch {}
  }, [id, isLoggedIn, authLoading]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("shared_conversations")
        .select("id,title,messages,search_mode,sharer_name,sharer_tier,created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        console.error(error);
        setError("Could not load shared conversation.");
      } else if (!data) {
        setError("This shared conversation no longer exists.");
      } else {
        setSnapshot(data as unknown as SharedConversationRow);
      }
      setLoading(false);
    })();
  }, [id]);

  const sharerTier = snapshot?.sharer_tier ?? "member";
  const viewerRank = TIER_RANK[viewerTier] ?? 0;
  const sharerRank = TIER_RANK[sharerTier] ?? 0;
  const viewerCanContinue = isLoggedIn && viewerRank >= sharerRank;
  const viewerNeedsUpgrade = isLoggedIn && viewerRank < sharerRank;

  const sharedDate = useMemo(() => {
    if (!snapshot) return "";
    try {
      return new Date(snapshot.created_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
    } catch { return ""; }
  }, [snapshot]);

  const handleContinue = async () => {
    if (!snapshot) return;
    if (!isLoggedIn) {
      try { localStorage.setItem("wix-post-login-redirect", `${window.location.origin}/shared/${snapshot.id}`); } catch {}
      navigate("/login");
      return;
    }
    if (!viewerCanContinue) return;
    const newId = generateId();
    const messages = snapshot.messages ?? [];
    saveConversation({
      id: newId,
      title: snapshot.title,
      messages,
      updatedAt: Date.now(),
    });
    try {
      await logConversation({
        conversationId: newId,
        title: snapshot.title,
        messages,
        searchMode: snapshot.search_mode ?? "data-analyst",
        userTier: viewerTier,
        pinned: false,
      });
    } catch (e) { console.error(e); }
    toast.success("Added to your conversations");
    navigate(`/?c=${newId}`);
  };

  const handleSignIn = () => {
    if (snapshot) {
      try { localStorage.setItem("wix-post-login-redirect", `${window.location.origin}/shared/${snapshot.id}`); } catch {}
    }
    navigate("/login");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-xl font-light mb-2">Shared conversation unavailable</h1>
        <p className="text-sm text-muted-foreground mb-6">{error ?? "Link may have expired."}</p>
        <Link to="/" className="text-sm text-primary hover:underline">Go to REID Base</Link>
      </div>
    );
  }

  const messages: Msg[] = snapshot.messages ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header banner */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-background/80 border-b border-border/60">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Share2 className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-light truncate">
                Shared{snapshot.sharer_name ? ` by ${snapshot.sharer_name}` : ""}
                {sharedDate ? ` · ${sharedDate}` : ""}
              </p>
              <h1 className="text-sm md:text-base font-medium truncate">{snapshot.title}</h1>
            </div>
          </div>
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            REID Base <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* Thread */}
      <main className="flex-1 overflow-y-auto px-3 md:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">This conversation has no messages.</p>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl bg-accent px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {m.content}
                  </div>
                ) : (
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
                        pre({ children }) { return <>{children}</>; },
                        h2({ children }) { return <h2 className="text-base font-bold text-foreground mt-5 mb-2">{children}</h2>; },
                        h3({ children }) { return <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5">{children}</h3>; },
                        hr() { return <hr className="border-t border-border/60 my-4" />; },
                        ul({ children }) { return <ul className="list-disc ml-5 space-y-1">{children}</ul>; },
                        ol({ children }) { return <ol className="list-decimal ml-5 space-y-1">{children}</ol>; },
                        strong({ children }) { return <strong className="font-semibold text-foreground">{children}</strong>; },
                        table({ children }) { return <div className="my-4 overflow-x-auto"><table className="w-full text-sm border-collapse">{children}</table></div>; },
                        thead({ children }) { return <thead className="border-b border-border">{children}</thead>; },
                        tbody({ children }) { return <tbody>{children}</tbody>; },
                        tr({ children }) { return <tr className="border-b border-border/40">{children}</tr>; },
                        th({ children }) { return <th className="text-left py-2 pr-4 font-semibold text-foreground whitespace-nowrap">{children}</th>; },
                        td({ children }) { return <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{children}</td>; },
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* Locked composer / CTA */}
      <footer className="border-t border-border/60 bg-background/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-3 md:px-6 py-4">
          <div className="relative rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                {!isLoggedIn ? (
                  <p className="text-sm text-foreground font-light">
                    Sign in to continue this conversation in your own account.
                  </p>
                ) : viewerCanContinue ? (
                  <p className="text-sm text-foreground font-light">
                    This is a read-only snapshot. Continue it as a new conversation in your account.
                  </p>
                ) : (
                  <p className="text-sm text-foreground font-light">
                    Your current plan ({tierLabel(viewerTier)}) cannot continue conversations shared from a {tierLabel(sharerTier)} account. Upgrade to unlock.
                  </p>
                )}
              </div>
              {!isLoggedIn ? (
                <button
                  onClick={handleSignIn}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
                >
                  Sign in <ArrowRight className="h-4 w-4" />
                </button>
              ) : viewerCanContinue ? (
                <button
                  onClick={handleContinue}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
                >
                  Continue this chat <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <a
                  href="https://www.realinfo.id/pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
                >
                  Upgrade <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
