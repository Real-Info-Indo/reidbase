import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCampaign, type Campaign } from "@/lib/campaigns";
import { trackFeature } from "@/lib/analytics";

/**
 * Compact report card used inside campaign conversations. Rendered for both
 * signed-out (CampaignConversation) and signed-in (NewAnalysis seeded) views,
 * so the download offer is always visible regardless of auth state.
 */
export function CampaignReportCard({ campaign }: { campaign: Campaign }) {
  const [downloading, setDownloading] = useState(false);
  if (!campaign.report) return null;

  const handleDownload = async () => {
    if (downloading) return;
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
    <div className="my-4 border border-border rounded-xl overflow-hidden bg-card w-full max-w-[360px]">
      <div className="aspect-[4/3] bg-muted overflow-hidden">
        <img
          src={campaign.report.thumbnail}
          alt={`${campaign.report.title} cover`}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
      <div className="px-3 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{campaign.report.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{campaign.report.subtitle}</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {downloading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Preparing
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              Download report
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Marker inserted into a campaign's assistant message to indicate where the
 *  report card should be rendered when the message is split for display. The
 *  slug is embedded so renderers (signed-in and signed-out) can resolve the
 *  campaign without extra plumbing. */
export const CAMPAIGN_REPORT_MARKER_RE = /\{\{CAMPAIGN_REPORT:([a-z0-9-]+)\}\}/g;

export function campaignMarker(slug: string): string {
  return `{{CAMPAIGN_REPORT:${slug}}}`;
}

/** Split a markdown string at campaign-report markers, returning an array of
 *  alternating text segments and resolved Campaign references. */
export function splitOnCampaignMarker(
  content: string,
): Array<{ type: "text"; value: string } | { type: "card"; campaign: Campaign }> {
  const parts: Array<{ type: "text"; value: string } | { type: "card"; campaign: Campaign }> = [];
  let lastIndex = 0;
  const re = new RegExp(CAMPAIGN_REPORT_MARKER_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    const campaign = getCampaign(match[1]);
    if (campaign) parts.push({ type: "card", campaign });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }
  return parts;
}
