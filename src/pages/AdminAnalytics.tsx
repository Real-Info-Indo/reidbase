import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Lock, BarChart3, Users, FileText, MessageSquare, MousePointerClick,
  RefreshCw, ClipboardList, Shield, Download, LogOut,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
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

interface AnalyticsEvent {
  id: string;
  event_type: string;
  event_name: string;
  page_path: string | null;
  metadata: Record<string, unknown>;
  wix_user_id: string | null;
  session_id: string | null;
  created_at: string;
}

interface ChatLog {
  id: string;
  conversation_id: string;
  wix_user_id: string | null;
  wix_user_name: string | null;
  message_count: number;
  search_mode: string | null;
  created_at: string;
  updated_at: string;
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

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date) {
  return startOfWeek(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function daysBetween(from: Date, to: Date): string[] {
  const days: string[] = [];
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  const end = new Date(to); end.setHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function AdminAnalytics() {
  const { authenticated, signIn, signOut } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [allEvents, setAllEvents] = useState<AnalyticsEvent[]>([]);
  const [allChatLogs, setAllChatLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAppraisalCount, setNewAppraisalCount] = useState(0);
  const [rangePreset, setRangePreset] = useState<RangePreset>("30");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const navigate = useNavigate();

  const handleLogin = () => {
    if (!signIn(password)) setPassword("");
  };

  const fetchData = async () => {
    setLoading(true);
    const [eventsRes, logsRes, appraisalRes] = await Promise.all([
      supabase
        .from("analytics_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20000) as any,
      supabase
        .from("chat_logs" as any)
        .select("id,conversation_id,wix_user_id,wix_user_name,message_count,search_mode,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(5000) as any,
      supabase
        .from("appraisal_requests" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "new") as any,
    ]);
    if (eventsRes.data) setAllEvents(eventsRes.data);
    if (logsRes.data) setAllChatLogs(logsRes.data);
    setNewAppraisalCount(appraisalRes.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated]);

  // ── Date range ──
  const { rangeFrom, rangeTo, rangeLabel } = useMemo(() => {
    const to = rangePreset === "custom" && customTo ? new Date(customTo) : new Date();
    let from: Date;
    if (rangePreset === "custom" && customFrom) {
      from = new Date(customFrom);
    } else {
      const days = rangePreset === "custom" ? 30 : parseInt(rangePreset, 10);
      from = new Date();
      from.setDate(from.getDate() - (days - 1));
    }
    from.setHours(0, 0, 0, 0);
    const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999);
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return { rangeFrom: from, rangeTo: toEnd, rangeLabel: `${fmt(from)} to ${fmt(toEnd)}` };
  }, [rangePreset, customFrom, customTo]);

  const events = useMemo(() => {
    const fromMs = rangeFrom.getTime();
    const toMs = rangeTo.getTime();
    return allEvents.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= fromMs && t <= toMs;
    });
  }, [allEvents, rangeFrom, rangeTo]);

  const chatLogs = useMemo(() => {
    const fromMs = rangeFrom.getTime();
    const toMs = rangeTo.getTime();
    return allChatLogs.filter((l) => {
      const t = new Date(l.updated_at).getTime();
      return t >= fromMs && t <= toMs;
    });
  }, [allChatLogs, rangeFrom, rangeTo]);


  // ── Derived metrics ──

  const pageViews = useMemo(
    () => events.filter((e) => e.event_type === "page_view"),
    [events],
  );
  const featureEvents = useMemo(
    () => events.filter((e) => e.event_type === "feature"),
    [events],
  );

  // Page views over time (selected range)
  const pageViewsByDay = useMemo(() => {
    const days = daysBetween(rangeFrom, rangeTo);
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d] = 0));
    pageViews.forEach((e) => {
      const day = e.created_at.slice(0, 10);
      if (counts[day] !== undefined) counts[day]++;
    });
    return days.map((d) => ({ date: formatDate(new Date(d)), views: counts[d] }));
  }, [pageViews, rangeFrom, rangeTo]);

  // Top pages
  const topPages = useMemo(() => {
    const map: Record<string, number> = {};
    pageViews.forEach((e) => {
      const p = e.page_path || "/";
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([page, count]) => ({ page, count }));
  }, [pageViews]);

  // Feature usage
  const featureCounts = useMemo(() => {
    const map: Record<string, number> = {};
    featureEvents.forEach((e) => {
      map[e.event_name] = (map[e.event_name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name: name.replace(/_/g, " "), count }));
  }, [featureEvents]);

  const featureCountByName = useMemo(() => {
    const map: Record<string, number> = {};
    featureEvents.forEach((event) => {
      map[event.event_name] = (map[event.event_name] || 0) + 1;
    });
    return map;
  }, [featureEvents]);

  // Unique users & sessions
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => { if (e.wix_user_id) set.add(e.wix_user_id); });
    return set.size;
  }, [events]);

  const uniqueSessions = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => { if (e.session_id) set.add(e.session_id); });
    return set.size;
  }, [events]);

  // Appraisal submissions
  const appraisalCount = useMemo(
    () => featureEvents.filter((e) => e.event_name === "appraisal_submitted").length,
    [featureEvents],
  );

  // Chat logs by search mode (pie)
  const chatByMode = useMemo(() => {
    const map: Record<string, number> = {};
    chatLogs.forEach((l) => {
      const mode = l.search_mode || "data-analyst";
      map[mode] = (map[mode] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name.replace(/-/g, " "),
      value,
    }));
  }, [chatLogs]);

  // Chat activity over time
  const chatsByDay = useMemo(() => {
    const days = daysBetween(rangeFrom, rangeTo);
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d] = 0));
    chatLogs.forEach((l) => {
      const day = l.updated_at.slice(0, 10);
      if (counts[day] !== undefined) counts[day]++;
    });
    return days.map((d) => ({ date: formatDate(new Date(d)), chats: counts[d] }));
  }, [chatLogs, rangeFrom, rangeTo]);

  const totalMessages = useMemo(
    () => chatLogs.reduce((sum, l) => sum + l.message_count, 0),
    [chatLogs],
  );

  const funnelSteps = useMemo(() => {
    const baseSteps = [
      { label: "Landing views", value: pageViews.filter((e) => (e.page_path || "/") === "/").length },
      { label: "Login starts", value: featureCountByName.login_started ?? 0 },
      { label: "Logins", value: featureCountByName.login_success ?? 0 },
      { label: "First prompts", value: featureCountByName.funnel_first_prompt ?? 0 },
      { label: "Report views", value: featureCountByName.funnel_report_view ?? 0 },
      { label: "Appraisal requests", value: featureCountByName.appraisal_submitted ?? 0 },
    ];

    return baseSteps.map((step, index) => ({
      ...step,
      rateFromPrevious:
        index === 0 || baseSteps[index - 1].value === 0
          ? null
          : (step.value / baseSteps[index - 1].value) * 100,
    }));
  }, [pageViews, featureCountByName]);

  const modePerformance = useMemo(() => {
    const stats = new Map<string, {
      mode: string;
      conversations: number;
      totalMessages: number;
      prompts: number;
      completedResponses: number;
      users: Set<string>;
    }>();

    const ensureMode = (modeKey: string) => {
      if (!stats.has(modeKey)) {
        stats.set(modeKey, {
          mode: modeKey,
          conversations: 0,
          totalMessages: 0,
          prompts: 0,
          completedResponses: 0,
          users: new Set<string>(),
        });
      }
      return stats.get(modeKey)!;
    };

    chatLogs.forEach((log) => {
      const modeKey = log.search_mode || "data-analyst";
      const entry = ensureMode(modeKey);
      entry.conversations += 1;
      entry.totalMessages += log.message_count;
      if (log.wix_user_id) entry.users.add(log.wix_user_id);
    });

    featureEvents.forEach((event) => {
      const modeKey = typeof event.metadata?.search_mode === "string"
        ? event.metadata.search_mode
        : "data-analyst";
      const entry = ensureMode(modeKey);
      if (event.event_name === "chat_message_sent") entry.prompts += 1;
      if (event.event_name === "chat_response_completed") entry.completedResponses += 1;
      if (event.wix_user_id) entry.users.add(event.wix_user_id);
    });

    return Array.from(stats.values())
      .map((entry) => ({
        ...entry,
        avgMessagesPerConversation: entry.conversations ? entry.totalMessages / entry.conversations : 0,
        completionRate: entry.prompts ? (entry.completedResponses / entry.prompts) * 100 : 0,
        uniqueUsers: entry.users.size,
      }))
      .sort((a, b) => b.conversations - a.conversations);
  }, [chatLogs, featureEvents]);

  const retentionMetrics = useMemo(() => {
    const userMap = new Map<string, {
      firstSeen: number;
      lastSeen: number;
      sessions: Map<string, number>;
    }>();

    events.forEach((event) => {
      if (!event.wix_user_id) return;
      const timestamp = new Date(event.created_at).getTime();
      if (!userMap.has(event.wix_user_id)) {
        userMap.set(event.wix_user_id, {
          firstSeen: timestamp,
          lastSeen: timestamp,
          sessions: new Map<string, number>(),
        });
      }

      const user = userMap.get(event.wix_user_id)!;
      user.firstSeen = Math.min(user.firstSeen, timestamp);
      user.lastSeen = Math.max(user.lastSeen, timestamp);
      if (event.session_id) {
        const existing = user.sessions.get(event.session_id);
        user.sessions.set(event.session_id, existing ? Math.min(existing, timestamp) : timestamp);
      }
    });

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    let returningUsers = 0;
    let activeUsers7d = 0;
    let activeUsers30d = 0;
    let newUsers30d = 0;
    const cohorts = new Map<string, { cohort: string; users: number; retained: number }>();

    userMap.forEach((user) => {
      if (user.lastSeen >= sevenDaysAgo) activeUsers7d += 1;
      if (user.lastSeen >= thirtyDaysAgo) activeUsers30d += 1;
      if (user.firstSeen >= thirtyDaysAgo) newUsers30d += 1;

      const sessionStarts = Array.from(user.sessions.values()).sort((a, b) => a - b);
      const hasReturnVisit = sessionStarts.some((time, index) => index > 0 && time - sessionStarts[0] >= 24 * 60 * 60 * 1000);
      if (hasReturnVisit) returningUsers += 1;

      const cohort = formatWeekLabel(new Date(user.firstSeen));
      if (!cohorts.has(cohort)) cohorts.set(cohort, { cohort, users: 0, retained: 0 });
      const entry = cohorts.get(cohort)!;
      entry.users += 1;
      if (hasReturnVisit) entry.retained += 1;
    });

    const totalUsers = userMap.size;
    const cohortRows = Array.from(cohorts.values())
      .sort((a, b) => new Date(b.cohort).getTime() - new Date(a.cohort).getTime())
      .slice(0, 6)
      .map((entry) => ({
        ...entry,
        retentionRate: entry.users ? (entry.retained / entry.users) * 100 : 0,
      }));

    return {
      activeUsers7d,
      activeUsers30d,
      newUsers30d,
      returningUsers,
      avgSessionsPerUser: totalUsers
        ? Array.from(userMap.values()).reduce((sum, user) => sum + user.sessions.size, 0) / totalUsers
        : 0,
      repeatRate: totalUsers ? (returningUsers / totalUsers) * 100 : 0,
      cohortRows,
    };
  }, [events]);

  // ── Auth gate ──

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full overflow-x-hidden bg-background">
        <div className="w-full max-w-sm space-y-4 p-8 border border-border rounded-xl bg-card">
          <div className="flex items-center gap-2 text-foreground">
            <Lock className="h-5 w-5" />
            <h1 className="text-lg font-medium">Admin access</h1>
          </div>
          <Input
            type="password"
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <Button onClick={handleLogin} className="w-full">Sign in</Button>
        </div>
      </div>
    );
  }

  // ── CSV exports ──
  const exportAll = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const sections: { name: string; rows: (string | number)[][] }[] = [];

    sections.push({
      name: "summary",
      rows: [
        ["Metric", "Value"],
        ["Date range", rangeLabel],
        ["Page views", pageViews.length],
        ["Unique users", uniqueUsers],
        ["Unique sessions", uniqueSessions],
        ["Conversations", chatLogs.length],
        ["Total messages", totalMessages],
        ["Appraisal submissions", appraisalCount],
      ],
    });

    sections.push({
      name: "page_views_by_day",
      rows: [["Date", "Views"], ...pageViewsByDay.map((r) => [r.date, r.views])],
    });
    sections.push({
      name: "chats_by_day",
      rows: [["Date", "Chats"], ...chatsByDay.map((r) => [r.date, r.chats])],
    });
    sections.push({
      name: "top_pages",
      rows: [["Page", "Views"], ...topPages.map((r) => [r.page, r.count])],
    });
    sections.push({
      name: "feature_usage",
      rows: [["Feature", "Count"], ...featureCounts.map((r) => [r.name, r.count])],
    });
    sections.push({
      name: "conversations_by_mode",
      rows: [["Mode", "Conversations"], ...chatByMode.map((r) => [r.name, r.value])],
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
    sections.push({
      name: "retention_snapshot",
      rows: [
        ["Metric", "Value"],
        ["Active users 7d", retentionMetrics.activeUsers7d],
        ["Active users 30d", retentionMetrics.activeUsers30d],
        ["New users 30d", retentionMetrics.newUsers30d],
        ["Repeat user rate (%)", retentionMetrics.repeatRate.toFixed(1)],
        ["Avg sessions per user", retentionMetrics.avgSessionsPerUser.toFixed(2)],
      ],
    });
    sections.push({
      name: "weekly_retention_cohorts",
      rows: [
        ["Cohort week", "Users", "Returned", "Retention (%)"],
        ...retentionMetrics.cohortRows.map((r) => [
          r.cohort, r.users, r.retained, r.retentionRate.toFixed(1),
        ]),
      ],
    });

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
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
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
              <p className="text-2xl font-bold">{pageViews.length.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Unique users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{uniqueUsers}</p>
              <p className="text-xs text-muted-foreground">{uniqueSessions} sessions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{chatLogs.length}</p>
              <p className="text-xs text-muted-foreground">{totalMessages.toLocaleString()} messages</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MousePointerClick className="h-4 w-4" /> Appraisals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{appraisalCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Page views over time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Page views</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pageViewsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.15)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Chat activity over time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Chat activity</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chatsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="chats"
                    stroke="hsl(210 70% 55%)"
                    fill="hsl(210 70% 55% / 0.15)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top pages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Top pages</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPages} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    dataKey="page"
                    type="category"
                    width={100}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Feature usage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Feature usage</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureCounts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(340 65% 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Chat modes pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conversations by mode</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chatByMode}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
                  >
                    {chatByMode.map((_, i) => (
                      <Cell key={i} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Conversion funnel</CardTitle>
            </CardHeader>
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
            <CardHeader>
              <CardTitle className="text-sm font-medium">Mode performance</CardTitle>
            </CardHeader>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Retention snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Active users, 7 days</p>
                <p className="text-xl font-semibold text-foreground">{retentionMetrics.activeUsers7d}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active users, 30 days</p>
                <p className="text-xl font-semibold text-foreground">{retentionMetrics.activeUsers30d}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">New users, 30 days</p>
                <p className="text-xl font-semibold text-foreground">{retentionMetrics.newUsers30d}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Repeat user rate</p>
                <p className="text-xl font-semibold text-foreground">{formatPercent(retentionMetrics.repeatRate)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Average sessions per user</p>
                <p className="text-xl font-semibold text-foreground">{retentionMetrics.avgSessionsPerUser.toFixed(1)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Weekly retention cohorts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Cohort week</th>
                      <th className="py-2 pr-4 font-medium">Users</th>
                      <th className="py-2 pr-4 font-medium">Returned</th>
                      <th className="py-2 font-medium">Retention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retentionMetrics.cohortRows.map((row) => (
                      <tr key={row.cohort} className="border-b border-border last:border-b-0">
                        <td className="py-3 pr-4 text-foreground">{row.cohort}</td>
                        <td className="py-3 pr-4 text-foreground">{row.users}</td>
                        <td className="py-3 pr-4 text-foreground">{row.retained}</td>
                        <td className="py-3 text-foreground">{formatPercent(row.retentionRate)}</td>
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
