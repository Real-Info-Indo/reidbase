import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Lock, BarChart3, Users, FileText, MessageSquare, MousePointerClick,
  RefreshCw, ClipboardList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";

const ADMIN_PASSWORD = "reid-admin-2025";

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

function last30Days() {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function AdminAnalytics() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [newAppraisalCount, setNewAppraisalCount] = useState(0);
  const navigate = useNavigate();

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const [eventsRes, logsRes, appraisalRes] = await Promise.all([
      supabase
        .from("analytics_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000) as any,
      supabase
        .from("chat_logs" as any)
        .select("id,conversation_id,wix_user_id,wix_user_name,message_count,search_mode,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(1000) as any,
      supabase
        .from("appraisal_requests" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "new") as any,
    ]);
    if (eventsRes.data) setEvents(eventsRes.data);
    if (logsRes.data) setChatLogs(logsRes.data);
    setNewAppraisalCount(appraisalRes.count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated]);

  // ── Derived metrics ──

  const pageViews = useMemo(
    () => events.filter((e) => e.event_type === "page_view"),
    [events],
  );
  const featureEvents = useMemo(
    () => events.filter((e) => e.event_type === "feature"),
    [events],
  );

  // Page views over time (last 30 days)
  const pageViewsByDay = useMemo(() => {
    const days = last30Days();
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d] = 0));
    pageViews.forEach((e) => {
      const day = e.created_at.slice(0, 10);
      if (counts[day] !== undefined) counts[day]++;
    });
    return days.map((d) => ({ date: formatDate(new Date(d)), views: counts[d] }));
  }, [pageViews]);

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
    const days = last30Days();
    const counts: Record<string, number> = {};
    days.forEach((d) => (counts[d] = 0));
    chatLogs.forEach((l) => {
      const day = l.updated_at.slice(0, 10);
      if (counts[day] !== undefined) counts[day]++;
    });
    return days.map((d) => ({ date: formatDate(new Date(d)), chats: counts[d] }));
  }, [chatLogs]);

  const totalMessages = useMemo(
    () => chatLogs.reduce((sum, l) => sum + l.message_count, 0),
    [chatLogs],
  );

  // ── Auth gate ──

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
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

  // ── Dashboard ──

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Admin nav */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
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
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Loading" : "Refresh"}
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
              <CardTitle className="text-sm font-medium">Page views (last 30 days)</CardTitle>
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
              <CardTitle className="text-sm font-medium">Chat activity (last 30 days)</CardTitle>
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
      </div>
    </div>
  );
}
