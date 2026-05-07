import { useState, useEffect, useMemo } from "react";
import {
  BarChart3, Users, FileText, MessageSquare, MousePointerClick,
  RefreshCw, ClipboardList, Shield, Download, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminGate } from "@/components/AdminGate";
import { invokeAdmin } from "@/lib/adminApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RangePreset = "30" | "90" | "180" | "365" | "custom";

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Server aggregate payload shape (admin-data, action: "analytics") ----
interface AggregatePayload {
  source: "server_aggregated";
  truncated: boolean;
  range: { from: string; to: string };
  summary: {
    page_views: number;
    feature_events: number;
    unique_users: number;
    unique_sessions: number;
    conversations: number;
    total_messages: number;
    /** @deprecated alias of appraisal_requests; kept for back-compat */
    appraisal_submissions: number;
    appraisal_requests: number;
    appraisal_cta_events: number;
  };
  page_views_by_day: { day_key: string; views: number }[];
  chats_by_day: { day_key: string; chats: number }[];
  appraisals_by_day: { day_key: string; requests: number }[];
  top_pages: { page: string; count: number }[];
  feature_usage: { event_name: string; count: number }[];
  conversations_by_mode: { mode: string; value: number }[];
  funnel: {
    landing_views: number;
    login_started: number;
    login_success: number;
    first_prompt: number;
    report_view: number;
    appraisal_submitted: number;
    appraisal_cta_events: number;
  };
  mode_performance: {
    mode: string;
    conversations: number;
    total_messages: number;
    prompts: number;
    completed: number;
    unique_users: number;
  }[];
  top_referrers: { referrer: string; count: number }[];
  top_campaigns: { source: string; medium: string; campaign: string; count: number }[];
  new_appraisal_count: number;
  retention_snapshot?: {
    total_known_users: number;
    active_users_7d: number;
    active_users_30d: number;
    new_users_30d: number;
    returning_users: number;
    repeat_rate: number;
    computed_at: string;
    window: string;
  };
  weekly_retention_cohorts?: {
    cohort_week: string;
    cohort_start: string;
    cohort_size: number;
    retained_users: number;
    retention_rate: number;
  }[];
}

const CHART_COLOURS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210 70% 55%)",
  "hsl(340 65% 55%)",
  "hsl(160 55% 45%)",
  "hsl(45 80% 50%)",
  "hsl(270 55% 55%)",
  "hsl(20 70% 55%)",
];

// All day bucketing is anchored to Asia/Makassar (WITA, UTC+8, no DST) so
// midnight-UTC drift never reshuffles the chart.
const TZ = "Asia/Makassar";
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayLabelFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", timeZone: TZ,
});

function dayKey(d: Date | string): string {
  const t = (typeof d === "string" ? new Date(d) : d).getTime();
  return new Date(t + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function dayKeyToInstant(key: string): Date {
  return new Date(`${key}T00:00:00+08:00`);
}

function startOfDayWita(d: Date): Date {
  return dayKeyToInstant(dayKey(d));
}

function endOfDayWita(d: Date): Date {
  return new Date(`${dayKey(d)}T23:59:59.999+08:00`);
}

function formatDayKey(key: string): string {
  return dayLabelFmt.format(dayKeyToInstant(key));
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function daysBetween(from: Date, to: Date): string[] {
  const days: string[] = [];
  let cur = startOfDayWita(from).getTime();
  const end = startOfDayWita(to).getTime();
  while (cur <= end) {
    days.push(dayKey(new Date(cur)));
    cur += DAY_MS;
  }
  return days;
}

export default function AdminAnalytics() {
  const { authenticated, checking, error, signOut } = useAdminAuth();
  const [data, setData] = useState<AggregatePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [rangePreset, setRangePreset] = useState<RangePreset>("30");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const navigate = useNavigate();

  // ── Date range ──
  const { rangeFrom, rangeTo, rangeLabel } = useMemo(() => {
    let baseTo = rangePreset === "custom" && customTo ? new Date(customTo) : new Date();
    let baseFrom: Date;
    if (rangePreset === "custom" && customFrom) {
      baseFrom = new Date(customFrom);
    } else {
      const days = rangePreset === "custom" ? 30 : parseInt(rangePreset, 10);
      const anchorKey = dayKey(new Date());
      baseTo = dayKeyToInstant(anchorKey);
      baseFrom = new Date(baseTo.getTime() - (days - 1) * DAY_MS);
    }
    const from = startOfDayWita(baseFrom);
    const to = endOfDayWita(baseTo);
    const fmt = new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", year: "numeric", timeZone: TZ,
    });
    return { rangeFrom: from, rangeTo: to, rangeLabel: `${fmt.format(from)} to ${fmt.format(to)}` };
  }, [rangePreset, customFrom, customTo]);

  const fetchData = async (fromIso: string, toIso: string) => {
    setLoading(true);
    try {
      const result = await invokeAdmin<AggregatePayload>("admin-data", {
        action: "analytics",
        from: fromIso,
        to: toIso,
      });
      setData(result);
    } catch (e) {
      toast.error((e as Error).message || "Failed to load analytics");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authenticated) return;
    fetchData(rangeFrom.toISOString(), rangeTo.toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, rangeFrom.getTime(), rangeTo.getTime()]);

  // ── Chart data: fill missing days with zeros so the area chart renders a
  // continuous baseline even when traffic is sparse. ──
  const pageViewsChart = useMemo(() => {
    if (!data) return [];
    const lookup = new Map(data.page_views_by_day.map((r) => [r.day_key, r.views]));
    return daysBetween(rangeFrom, rangeTo).map((d) => ({
      date: formatDayKey(d), views: lookup.get(d) ?? 0,
    }));
  }, [data, rangeFrom, rangeTo]);

  const chatsChart = useMemo(() => {
    if (!data) return [];
    const lookup = new Map(data.chats_by_day.map((r) => [r.day_key, r.chats]));
    return daysBetween(rangeFrom, rangeTo).map((d) => ({
      date: formatDayKey(d), chats: lookup.get(d) ?? 0,
    }));
  }, [data, rangeFrom, rangeTo]);

  const appraisalsChart = useMemo(() => {
    if (!data) return [];
    const lookup = new Map((data.appraisals_by_day ?? []).map((r) => [r.day_key, r.requests]));
    return daysBetween(rangeFrom, rangeTo).map((d) => ({
      date: formatDayKey(d), requests: lookup.get(d) ?? 0,
    }));
  }, [data, rangeFrom, rangeTo]);

  const topPagesChart = useMemo(
    () => (data?.top_pages ?? []).slice(0, 8).map((r) => ({ page: r.page, count: r.count })),
    [data],
  );

  const featureUsageChart = useMemo(
    () => (data?.feature_usage ?? []).map((r) => ({
      name: r.event_name.replace(/_/g, " "), count: r.count,
    })),
    [data],
  );

  const chatByModeChart = useMemo(
    () => (data?.conversations_by_mode ?? []).map((r) => ({
      name: r.mode.replace(/-/g, " "), value: r.value,
    })),
    [data],
  );

  const funnelSteps = useMemo(() => {
    if (!data) return [];
    const f = data.funnel;
    const base = [
      { label: "Landing views",       value: f.landing_views },
      { label: "Login starts",        value: f.login_started },
      { label: "Logins",              value: f.login_success },
      { label: "First prompts",       value: f.first_prompt },
      { label: "Report views",        value: f.report_view },
      { label: "Appraisal requests", value: f.appraisal_submitted },
    ];
    return base.map((step, i) => ({
      ...step,
      rateFromPrevious:
        i === 0 || base[i - 1].value === 0
          ? null
          : (step.value / base[i - 1].value) * 100,
    }));
  }, [data]);

  const modePerformance = useMemo(() => {
    return (data?.mode_performance ?? []).map((r) => ({
      mode: r.mode,
      conversations: r.conversations,
      prompts: r.prompts,
      avgMessagesPerConversation: r.conversations ? r.total_messages / r.conversations : 0,
      completionRate: r.prompts ? (r.completed / r.prompts) * 100 : 0,
      uniqueUsers: r.unique_users,
    }));
  }, [data]);

  const topReferrers = data?.top_referrers ?? [];
  const topCampaigns = data?.top_campaigns ?? [];
  const retention = data?.retention_snapshot;
  const cohorts = data?.weekly_retention_cohorts ?? [];

  // ── Auth gate ──
  if (!authenticated) {
    return <AdminGate checking={checking} error={error} />;
  }

  const summary = data?.summary ?? {
    page_views: 0, feature_events: 0, unique_users: 0, unique_sessions: 0,
    conversations: 0, total_messages: 0, appraisal_submissions: 0,
    appraisal_requests: 0, appraisal_cta_events: 0,
  };
  const newAppraisalCount = data?.new_appraisal_count ?? 0;

  // ── CSV exports ──
  const exportAll = () => {
    if (!data) {
      toast.error("Nothing to export yet");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const sections: { name: string; rows: (string | number)[][] }[] = [];

    sections.push({
      name: "summary",
      rows: [
        ["Metric", "Value"],
        ["Date range", rangeLabel],
        ["Source", data.source],
        ["Truncated", String(data.truncated)],
        ["Page views", summary.page_views],
        ["Unique users", summary.unique_users],
        ["Unique sessions", summary.unique_sessions],
        ["Conversations", summary.conversations],
        ["Total messages", summary.total_messages],
        ["Appraisal requests (database rows)", summary.appraisal_requests],
        ["Appraisal CTA events (analytics)", summary.appraisal_cta_events],
      ],
    });
    sections.push({
      name: "page_views_by_day",
      rows: [["Date", "Views"], ...pageViewsChart.map((r) => [r.date, r.views])],
    });
    sections.push({
      name: "chats_by_day",
      rows: [["Date", "Chats"], ...chatsChart.map((r) => [r.date, r.chats])],
    });
    sections.push({
      name: "appraisal_requests_by_day",
      rows: [["Date", "Requests"], ...appraisalsChart.map((r) => [r.date, r.requests])],
    });
    sections.push({
      name: "top_pages",
      rows: [["Page", "Views"], ...(data.top_pages ?? []).map((r) => [r.page, r.count])],
    });
    sections.push({
      name: "feature_usage",
      rows: [["Feature", "Count"], ...(data.feature_usage ?? []).map((r) => [r.event_name, r.count])],
    });
    sections.push({
      name: "conversations_by_mode",
      rows: [["Mode", "Conversations"], ...(data.conversations_by_mode ?? []).map((r) => [r.mode, r.value])],
    });
    sections.push({
      name: "top_referrers",
      rows: [["Referrer", "Views"], ...topReferrers.map((r) => [r.referrer, r.count])],
    });
    sections.push({
      name: "top_campaigns",
      rows: [
        ["Source", "Medium", "Campaign", "Views"],
        ...topCampaigns.map((r) => [r.source, r.medium, r.campaign, r.count]),
      ],
    });
    sections.push({
      name: "conversion_funnel",
      rows: [
        ["Step", "Label", "Value", "Rate from previous (%)"],
        ...funnelSteps.map((s, i) => [
          i + 1, s.label, s.value, s.rateFromPrevious === null ? "" : s.rateFromPrevious.toFixed(1),
        ]),
      ],
    });
    sections.push({
      name: "mode_performance",
      rows: [
        ["Mode", "Conversations", "Prompts", "Avg messages", "Completion (%)", "Unique users"],
        ...modePerformance.map((r) => [
          r.mode, r.conversations, r.prompts,
          r.avgMessagesPerConversation.toFixed(1),
          r.completionRate.toFixed(1), r.uniqueUsers,
        ]),
      ],
    });

    if (retention) {
      sections.push({
        name: "retention_snapshot_all_time",
        rows: [
          ["Metric", "Value"],
          ["Total known users (all-time)", retention.total_known_users],
          ["Active users (7d)", retention.active_users_7d],
          ["Active users (30d)", retention.active_users_30d],
          ["New users (30d)", retention.new_users_30d],
          ["Returning users", retention.returning_users],
          ["Repeat rate (%)", (retention.repeat_rate * 100).toFixed(1)],
          ["Computed at", retention.computed_at],
        ],
      });
    }
    if (cohorts.length) {
      sections.push({
        name: "weekly_retention_cohorts",
        rows: [
          ["Cohort week", "Cohort start", "Cohort size", "Retained users", "Retention rate (%)"],
          ...cohorts.map((c) => [
            c.cohort_week, c.cohort_start, c.cohort_size, c.retained_users,
            (c.retention_rate * 100).toFixed(1),
          ]),
        ],
      });
    }

    const combined: (string | number)[][] = [];
    sections.forEach((sec, i) => {
      if (i > 0) combined.push([]);
      combined.push([`# ${sec.name}`]);
      sec.rows.forEach((r) => combined.push(r));
    });
    downloadCsv(`reid-analytics-${stamp}.csv`, combined);
  };

  // ── Dashboard ──
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Admin nav */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
            <span className="text-xs text-muted-foreground hidden md:inline">{rangeLabel}</span>
            {data?.truncated && (
              <span className="text-[10px] uppercase tracking-wide rounded bg-destructive/10 text-destructive px-2 py-0.5">
                Truncated
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={rangePreset} onValueChange={(v) => setRangePreset(v as RangePreset)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 180 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            {rangePreset === "custom" && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9", !customFrom && "text-muted-foreground")}>
                      {customFrom ? customFrom.toLocaleDateString("en-GB") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9", !customTo && "text-muted-foreground")}>
                      {customTo ? customTo.toLocaleDateString("en-GB") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/alerts")}>
              <Shield className="h-4 w-4 mr-1.5" /> Alerts
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/users")}>
              <Users className="h-4 w-4 mr-1.5" /> Users
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/chat-logs")}>
              <MessageSquare className="h-4 w-4 mr-1.5" /> Chat logs
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/appraisals")} className="relative">
              <ClipboardList className="h-4 w-4 mr-1.5" /> Appraisals
              {newAppraisalCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {newAppraisalCount}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={exportAll}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchData(rangeFrom.toISOString(), rangeTo.toISOString())} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading" : "Refresh"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} title="Sign out of admin">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Page views
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.page_views.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Unique users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.unique_users.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{summary.unique_sessions.toLocaleString()} sessions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.conversations.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{summary.total_messages.toLocaleString()} messages</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MousePointerClick className="h-4 w-4" /> Appraisal requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.appraisal_requests.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {summary.appraisal_cta_events.toLocaleString()} CTA events
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Page views</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pageViewsChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Chat activity</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chatsChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="chats" stroke="hsl(210 70% 55%)" fill="hsl(210 70% 55% / 0.15)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Top pages</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPagesChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="page" type="category" width={100} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Feature usage</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureUsageChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(340 65% 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Conversations by mode</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chatByModeChart}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
                  >
                    {chatByModeChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Acquisition row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Top referrers</CardTitle></CardHeader>
            <CardContent>
              {topReferrers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No external referrers in this range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Referrer</th>
                      <th className="py-2 font-medium">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topReferrers.map((r) => (
                      <tr key={r.referrer} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-4 text-foreground">{r.referrer}</td>
                        <td className="py-2 text-foreground">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Top campaigns</CardTitle></CardHeader>
            <CardContent>
              {topCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tagged UTM traffic in this range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Source</th>
                      <th className="py-2 pr-4 font-medium">Medium</th>
                      <th className="py-2 pr-4 font-medium">Campaign</th>
                      <th className="py-2 font-medium">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCampaigns.map((r, i) => (
                      <tr key={`${r.source}-${r.medium}-${r.campaign}-${i}`} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-4 text-foreground">{r.source || "n/a"}</td>
                        <td className="py-2 pr-4 text-foreground">{r.medium || "n/a"}</td>
                        <td className="py-2 pr-4 text-foreground">{r.campaign || "n/a"}</td>
                        <td className="py-2 text-foreground">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Retention (full-history, ignores selected date range) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Retention snapshot</CardTitle>
              <p className="text-xs text-muted-foreground">All-time, independent of date range</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!retention ? (
                <p className="text-muted-foreground">No retention data.</p>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total known users</span><span className="font-medium text-foreground">{retention.total_known_users.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Active (7d)</span><span className="font-medium text-foreground">{retention.active_users_7d.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Active (30d)</span><span className="font-medium text-foreground">{retention.active_users_30d.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">New users (30d)</span><span className="font-medium text-foreground">{retention.new_users_30d.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Returning users</span><span className="font-medium text-foreground">{retention.returning_users.toLocaleString()}</span></div>
                  <div className="flex justify-between border-t border-border pt-2"><span className="text-muted-foreground">Repeat rate</span><span className="font-semibold text-foreground">{formatPercent(retention.repeat_rate * 100)}</span></div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Weekly retention cohorts</CardTitle>
              <p className="text-xs text-muted-foreground">By first-seen week, retained if returned after 24h</p>
            </CardHeader>
            <CardContent>
              {cohorts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cohort data.</p>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Cohort week</th>
                        <th className="py-2 pr-4 font-medium">Start</th>
                        <th className="py-2 pr-4 font-medium">Size</th>
                        <th className="py-2 pr-4 font-medium">Retained</th>
                        <th className="py-2 font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.slice(0, 16).map((c) => (
                        <tr key={c.cohort_week} className="border-b border-border last:border-b-0">
                          <td className="py-2 pr-4 text-foreground">{c.cohort_week}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{c.cohort_start}</td>
                          <td className="py-2 pr-4 text-foreground">{c.cohort_size}</td>
                          <td className="py-2 pr-4 text-foreground">{c.retained_users}</td>
                          <td className="py-2 text-foreground">{formatPercent(c.retention_rate * 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Funnel + mode performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Conversion funnel</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {funnelSteps.map((step, index) => (
                <div key={step.label} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{index + 1}. {step.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {step.rateFromPrevious === null ? "Baseline" : `${formatPercent(step.rateFromPrevious)} from previous step`}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{step.value.toLocaleString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm font-medium">Mode performance</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Mode</th>
                      <th className="py-2 pr-4 font-medium">Conversations</th>
                      <th className="py-2 pr-4 font-medium">Prompts</th>
                      <th className="py-2 pr-4 font-medium">Avg messages</th>
                      <th className="py-2 pr-4 font-medium">Completion</th>
                      <th className="py-2 font-medium">Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modePerformance.map((row) => (
                      <tr key={row.mode} className="border-b border-border last:border-b-0">
                        <td className="py-3 pr-4 text-foreground">{row.mode.replace(/-/g, " ")}</td>
                        <td className="py-3 pr-4 text-foreground">{row.conversations}</td>
                        <td className="py-3 pr-4 text-foreground">{row.prompts}</td>
                        <td className="py-3 pr-4 text-foreground">{row.avgMessagesPerConversation.toFixed(1)}</td>
                        <td className="py-3 pr-4 text-foreground">{formatPercent(row.completionRate)}</td>
                        <td className="py-3 text-foreground">{row.uniqueUsers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
