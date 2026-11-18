import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { campaignRateLabel, type LaunchCampaign } from "@/lib/campaignMetrics";

interface Props {
  campaigns: LaunchCampaign[];
  selected: string;
  onSelect: (slug: string) => void;
  period: string;
  loading: boolean;
}

export function CampaignAnalytics({ campaigns, selected, onSelect, period, loading }: Props) {
  const active = campaigns.find(c => c.slug === selected);
  const stats = active ? [
    ["Visits", active.visitors.toLocaleString(), "Browser sessions"],
    ["Download requests", active.downloads.toLocaleString(), `${active.downloading_visits ?? "Not available"} downloading visits`],
    ["Download rate", campaignRateLabel(active.downloading_visits, active.visitors), "Visits with a report link issued"],
    ["Sign-in interest", campaignRateLabel(active.signin_prompt_visits, active.visitors), `${active.signin_prompt_visits ?? "Not available"} visits requesting sign-in`],
    ["Follow-up activity", campaignRateLabel(active.followup_visits, active.visitors), `${active.followup_visits ?? "Not available"} visits with subsequent chat activity`],
    ["Identified users", active.identified_users.toLocaleString(), `${active.identified_downloaders ?? "Not available"} identified downloaders`],
    ["Anonymous visits", active.anonymous_visits.toLocaleString(), "No verified identity recorded"],
    ["Page views per visit", active.visitors ? (active.page_views / active.visitors).toFixed(2) : "Not available", `${active.page_views.toLocaleString()} page views`],
  ] : [];

  return <section className="space-y-6" aria-label="Campaign analytics">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-foreground">Campaign analytics</h2><p className="text-xs text-muted-foreground">{period}</p></div>
      <Select value={selected} onValueChange={onSelect}>
        <SelectTrigger className="w-[180px]" aria-label="Campaign"><SelectValue /></SelectTrigger>
        <SelectContent>{campaigns.map(c => <SelectItem key={c.slug} value={c.slug}>{c.title}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats.map(([label, value, detail]) => <Card key={label} className="min-w-0 rounded-lg">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><p className="break-words text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent>
    </Card>)}</div>
    <p className="text-xs text-muted-foreground">Visits count sessions, not distinct people. Downloads count report links issued, not confirmed file saves. Rates use visits, not repeat requests. Follow-up activity counts later chat activity in the same session, not necessarily a report-specific conversation. Historical tracking may be incomplete.</p>
    <div className="space-y-3"><h3 className="text-sm font-medium">Campaign comparison</h3><div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b border-border text-left text-muted-foreground">{["Campaign", "Visits", "Downloads", "Download rate", "Sign-in interest", "Follow-up activity"].map(h => <th key={h} className="whitespace-nowrap py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
      <tbody>{campaigns.map(c => <tr key={c.slug} className="border-b border-border last:border-0"><td className="whitespace-nowrap py-3 pr-4"><Button variant="link" className="h-auto p-0 text-sm" onClick={() => onSelect(c.slug)}>{c.title}</Button></td>{[c.visitors.toLocaleString(), c.downloads.toLocaleString(), campaignRateLabel(c.downloading_visits,c.visitors), campaignRateLabel(c.signin_prompt_visits,c.visitors), campaignRateLabel(c.followup_visits,c.visitors)].map((v,i) => <td key={i} className="py-3 pr-4 tabular-nums">{v}</td>)}</tr>)}</tbody>
    </table></div>{!campaigns.length && <p className="text-sm text-muted-foreground">{loading ? "Loading campaign metrics" : "No campaign metrics available"}</p>}</div>
    <div className="space-y-3"><h3 className="text-sm font-medium">Traffic sources</h3><div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b border-border text-left text-muted-foreground">{["Source", "Medium", "Campaign tag", "Visits"].map(h => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
      <tbody>{active?.traffic_sources?.map((s,i) => <tr key={i} className="border-b border-border last:border-0">{[s.source,s.medium,s.campaign,s.visits].map((v,j) => <td key={j} className="py-3 pr-4 break-words">{v}</td>)}</tr>)}</tbody>
    </table></div>{!active?.traffic_sources?.length && <p className="text-sm text-muted-foreground">No recorded traffic sources in this period</p>}</div>
    <div className="space-y-3"><h3 className="text-sm font-medium">Identified visitors</h3>
      <p className="text-xs text-muted-foreground">Names and emails require verified sign-in, including sign-in in the same session. Email campaign tags identify a traffic source, not the recipient. Forwarded links and email security scanners can also generate visits.</p>
      <div className="max-h-96 overflow-auto">{active?.visitor_details.length ? <table className="w-full min-w-[680px] text-sm">
        <thead><tr className="border-b border-border text-left text-muted-foreground">{["Name", "Email", "Page views", "Downloads", "First activity (WITA)", "Last activity (WITA)"].map(h => <th key={h} className="whitespace-nowrap py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
        <tbody>{active.visitor_details.map(v => <tr key={v.wix_user_id} className="border-b border-border last:border-0"><td className="py-3 pr-4">{v.display_name || "Name unavailable"}</td><td className="max-w-64 break-all py-3 pr-4">{v.email || "Email unavailable"}</td><td className="py-3 pr-4">{v.page_views}</td><td className="py-3 pr-4">{v.downloads}</td>{[v.first_seen,v.last_seen].map((date,i) => <td key={i} className="whitespace-nowrap py-3 pr-4">{new Intl.DateTimeFormat("en-GB",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Makassar"}).format(new Date(date))}</td>)}</tr>)}</tbody>
      </table> : <p className="text-sm text-muted-foreground">No identified visitors in this period</p>}</div>
    </div>
  </section>;
}