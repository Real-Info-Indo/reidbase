import { useState, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { Send, PlusCircle, BarChart3, FileText, MapPin, ClipboardEdit, User } from "lucide-react";
import { useWixAuth } from "@/contexts/WixAuthContext";
import { getCampaign } from "@/lib/campaigns";
import { trackFeature } from "@/lib/analytics";
import { AssistantMarkdown } from "@/components/AssistantMarkdown";
import reidLogo from "@/assets/REID_Black.svg";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { title: "New Analysis", icon: PlusCircle },
  { title: "Dashboard", icon: BarChart3 },
  { title: "Market Reports", icon: FileText },
  { title: "Location Reports", icon: MapPin },
  { title: "Appraisal Request", icon: ClipboardEdit },
];

/**
 * Public landing page for an email campaign. Renders a pre-loaded
 * conversation (user prompt + assistant message + optional report card).
 *
 * Gating model:
 *  - Anyone can view the conversation and download the linked report.
 *  - Typing in the input is allowed.
 *  - Pressing Send, or clicking any sidebar item, prompts Wix sign-in.
 *    The current draft prompt and target campaign are preserved so the
 *    user lands back inside `NewAnalysis` with the conversation seeded
 *    and their draft re-populated, ready to send.
 */
export default function CampaignConversation() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isLoggedIn, isLoading, login } = useWixAuth();
  const isMobile = useIsMobile();
  const campaign = getCampaign(slug);
  const [draft, setDraft] = useState("");
  const [downloading, setDownloading] = useState(false);

  // Track that the campaign was viewed (anonymous + identified visits both).
  useEffect(() => {
    if (campaign) trackFeature("campaign_view", { slug: campaign.slug });
  }, [campaign?.slug]);

  // If a logged-in user lands here, forward them straight into a real,
  // editable conversation seeded with the campaign content.
  useEffect(() => {
    if (!campaign || isLoading || !isLoggedIn) return;
    const params = new URLSearchParams({ campaign: campaign.slug });
    navigate(`/?${params.toString()}`, { replace: true });
  }, [campaign, isLoading, isLoggedIn, navigate]);

  if (!campaign) return <Navigate to="/" replace />;

  // Stash the post-login destination + draft, then trigger Wix OAuth. The
  // existing WixAuthContext.login() reads `wix-post-login-redirect` to
  // return the user to this exact URL after callback.
  const requireSignIn = (reason: "send" | "nav") => {
    const params = new URLSearchParams({ campaign: campaign.slug });
    if (draft.trim()) params.set("draft", draft.trim());
    const target = `${window.location.origin}/?${params.toString()}`;
    localStorage.setItem("wix-post-login-redirect", target);
    trackFeature("campaign_signin_prompt", { slug: campaign.slug, reason });
    login();
  };

  const handleDownload = async () => {
    if (!campaign.report || downloading) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("download-public-report", {
        body: { slug: campaign.slug },
      });
      if (error || !data?.ok || !data?.url) {
        toast.error("Download unavailable. Please try again later.");
        return;
      }
      window.open(data.url as string, "_blank", "noopener,noreferrer");
      trackFeature("campaign_report_download", { slug: campaign.slug });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Static sidebar — every item triggers sign-in */}
      {!isMobile && (
        <aside className="w-64 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
          <div className="p-4 border-b border-sidebar-border">
            <img src={reidLogo} alt="REID" className="h-6" />
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.title}
                onClick={() => requireSignIn("nav")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-left"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.title}</span>
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <button
              onClick={() => requireSignIn("nav")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <User className="h-4 w-4" />
              <span>Sign in</span>
            </button>
          </div>
        </aside>
      )}

      {/* Conversation column */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {isMobile && (
          <header className="flex items-center justify-between px-4 h-14 border-b border-border">
            <img src={reidLogo} alt="REID" className="h-5" />
            <button
              onClick={() => requireSignIn("nav")}
              className="text-sm font-medium text-primary"
            >
              Sign in
            </button>
          </header>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-primary/10 px-4 py-3 text-sm text-foreground">
                {campaign.userPrompt}
              </div>
            </div>

            {/* Assistant message */}
            <div className="ai-response prose prose-sm max-w-none prose-p:mb-4 prose-headings:mt-5 prose-headings:mb-2 prose-ul:ml-5 prose-li:mb-1" style={{ lineHeight: 1.6 }}>
              <ReactMarkdown>{campaign.assistantMessage}</ReactMarkdown>
            </div>

            {/* Report card */}
            {campaign.report && (
              <div className="border border-border rounded-xl overflow-hidden bg-card max-w-md">
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={campaign.report.thumbnail}
                    alt={`${campaign.report.title} cover`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{campaign.report.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{campaign.report.subtitle}</p>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Preparing download
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download report
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input bar — typing allowed, send is gated */}
        <div className="border-t border-border bg-background">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                requireSignIn("send");
              }}
              className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    requireSignIn("send");
                  }
                }}
                placeholder="Ask REID a follow-up..."
                rows={1}
                className="flex-1 bg-transparent border-0 resize-none text-sm focus:outline-none min-h-[2rem] max-h-32 py-1"
              />
              <button
                type="submit"
                aria-label="Send"
                className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Sign in to continue the conversation and explore more of REID.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
