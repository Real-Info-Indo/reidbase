import ReactMarkdown from "react-markdown";
import { injectRegionHovers } from "@/components/RegionHover";
import ChatChart, { parseChartBlock } from "@/components/ChatChart";
import { CampaignReportCard, splitOnCampaignMarker } from "@/components/CampaignReportCard";

/**
 * Shared renderer for assistant messages. Used by both the signed-in chat
 * (NewAnalysis) and the public campaign landing (CampaignConversation) so
 * formatting is identical across the two surfaces.
 *
 * Also splits content on `{{CAMPAIGN_REPORT:<slug>}}` markers and renders the
 * campaign download card inline at that position.
 */
export function AssistantMarkdown({ content }: { content: string }) {
  const segments = splitOnCampaignMarker(content);
  return (
    <div
      className="ai-response prose prose-sm max-w-none dark:prose-invert prose-p:mb-4 prose-headings:mt-5 prose-headings:mb-2 prose-ul:ml-5 prose-ol:ml-5 prose-li:mb-1 prose-hr:my-4"
      style={{ lineHeight: 1.6 }}
    >
      {segments.map((seg, i) =>
        seg.type === "card" ? (
          <CampaignReportCard key={`card-${i}`} campaign={seg.campaign} />
        ) : (
          <ReactMarkdown
            key={`md-${i}`}
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
              p({ children }) {
                return <p>{injectRegionHovers(children)}</p>;
              },
              li({ children }) {
                return <li>{injectRegionHovers(children)}</li>;
              },
              h2({ children }) {
                return <h2 className="text-base font-bold text-foreground mt-5 mb-2">{injectRegionHovers(children)}</h2>;
              },
              h3({ children }) {
                return <h3 className="text-sm font-semibold text-foreground mt-4 mb-1.5">{injectRegionHovers(children)}</h3>;
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
                return <strong className="font-semibold text-foreground">{injectRegionHovers(children)}</strong>;
              },
              table({ children }) {
                return <div className="my-4 overflow-x-auto"><table className="w-full text-sm border-collapse">{children}</table></div>;
              },
              thead({ children }) {
                return <thead className="border-b border-border">{children}</thead>;
              },
              tbody({ children }) {
                return <tbody>{children}</tbody>;
              },
              tr({ children }) {
                return <tr className="border-b border-border/40">{children}</tr>;
              },
              th({ children }) {
                return <th className="text-left py-2 pr-4 font-semibold text-foreground whitespace-nowrap">{injectRegionHovers(children)}</th>;
              },
              td({ children }) {
                return <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{injectRegionHovers(children)}</td>;
              },
            }}
          >
            {seg.value}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}
