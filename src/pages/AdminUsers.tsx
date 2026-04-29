import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Lock, Users, ArrowLeft, RefreshCw, Download, Search, ExternalLink,
  ChevronDown, ChevronRight, FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";


interface UserProfile {
  wix_user_id: string;
  display_name: string | null;
  email: string | null;
  business: string | null;
  nickname: string | null;
  occupation: string | null;
  about: string | null;
  tier: string | null;
  last_login: string | null;
}

interface UserStats {
  pageViews: number;
  downloads: number;
  chatCount: number;
  appraisalCount: number;
  pages: Record<string, number>;
  downloadItems: string[];
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, UserStats>>({});
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
    } else {
      toast.error("Incorrect password");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from("user_profiles" as any)
        .select("*")
        .order("last_login", { ascending: false });

      const users = (profileData as unknown as UserProfile[]) || [];
      setProfiles(users);

      // Fetch analytics events with page_path for detail
      const { data: events } = await supabase
        .from("analytics_events")
        .select("wix_user_id, event_type, event_name, page_path, metadata");

      // Fetch chat log counts
      const { data: chatLogs } = await supabase
        .from("chat_logs")
        .select("wix_user_id");

      // Fetch appraisal counts per user from analytics feature events
      // (appraisal_submitted events are tracked in analytics_events)

      const stats: Record<string, UserStats> = {};

      const ensureStats = (uid: string) => {
        if (!stats[uid])
          stats[uid] = {
            pageViews: 0,
            downloads: 0,
            chatCount: 0,
            appraisalCount: 0,
            pages: {},
            downloadItems: [],
          };
      };

      (events || []).forEach((e: any) => {
        if (!e.wix_user_id) return;
        ensureStats(e.wix_user_id);
        const s = stats[e.wix_user_id];
        if (e.event_type === "page_view") {
          s.pageViews++;
          const path = e.page_path || "unknown";
          s.pages[path] = (s.pages[path] || 0) + 1;
        }
        if (e.event_name === "report_download") {
          s.downloads++;
          const meta = e.metadata as any;
          const label = meta?.report || meta?.name || e.page_path || "Report";
          s.downloadItems.push(String(label));
        }
        if (e.event_name === "appraisal_submitted") {
          s.appraisalCount++;
        }
      });

      (chatLogs || []).forEach((c: any) => {
        if (!c.wix_user_id) return;
        ensureStats(c.wix_user_id);
        stats[c.wix_user_id].chatCount++;
      });

      setStatsMap(stats);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
      toast.error("Failed to load user data");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) fetchData();
  }, [authenticated]);

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.display_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.business?.toLowerCase().includes(q) ||
        p.tier?.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const handleDownloadCSV = () => {
    const headers = [
      "Name", "Email", "Business", "Tier", "Last Login",
      "Page Views", "Downloads", "Chats", "Appraisals",
      "Nickname", "Occupation", "About",
    ];
    const rows = filtered.map((p) => {
      const s = statsMap[p.wix_user_id] || { pageViews: 0, downloads: 0, chatCount: 0, appraisalCount: 0, pages: {}, downloadItems: [] };
      return [
        p.display_name || "",
        p.email || "",
        p.business || "",
        p.tier || "",
        p.last_login ? new Date(p.last_login).toLocaleString() : "",
        s.pageViews,
        s.downloads,
        s.chatCount,
        s.appraisalCount,
        p.nickname || "",
        p.occupation || "",
        p.about || "",
      ];
    });
    const csv =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reid_users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-xs space-y-4 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Admin Users</h1>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <Button onClick={handleLogin} className="w-full">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  const colCount = 10;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/analytics")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">User Directory</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, business or tier"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {filtered.length} user{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Table */}
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-center">Pages</TableHead>
                <TableHead className="text-center">Downloads</TableHead>
                <TableHead className="text-center">Appraisals</TableHead>
                <TableHead className="text-center">Chats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center py-12 text-muted-foreground">
                    {loading ? "Loading..." : "No users found"}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => {
                const s = statsMap[p.wix_user_id] || {
                  pageViews: 0, downloads: 0, chatCount: 0, appraisalCount: 0, pages: {}, downloadItems: [],
                };
                const isExpanded = expandedIds.has(p.wix_user_id);

                return (
                  <>
                    <TableRow
                      key={p.wix_user_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(p.wix_user_id)}
                    >
                      <TableCell className="w-8 px-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {p.display_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{p.email || "—"}</TableCell>
                      <TableCell className="text-sm">{p.business || "—"}</TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {p.tier || "freemium"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {p.last_login
                          ? new Date(p.last_login).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">{s.pageViews}</TableCell>
                      <TableCell className="text-center">{s.downloads}</TableCell>
                      <TableCell className="text-center">{s.appraisalCount}</TableCell>
                      <TableCell className="text-center">
                        {s.chatCount > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/chat-logs?user=${encodeURIComponent(p.wix_user_id)}`);
                            }}
                          >
                            {s.chatCount}
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        ) : (
                          "0"
                        )}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${p.wix_user_id}-detail`}>
                        <TableCell colSpan={colCount} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            {/* Personalisation */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-foreground">Personalisation</h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p><span className="font-medium text-foreground">Nickname:</span> {p.nickname || "—"}</p>
                                <p><span className="font-medium text-foreground">Occupation:</span> {p.occupation || "—"}</p>
                                <p><span className="font-medium text-foreground">Business:</span> {p.business || "—"}</p>
                                <p><span className="font-medium text-foreground">About:</span> {p.about || "—"}</p>
                              </div>
                            </div>

                            {/* Pages visited */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-foreground">Pages visited ({s.pageViews})</h4>
                              {Object.keys(s.pages).length > 0 ? (
                                <ul className="space-y-0.5 text-muted-foreground max-h-48 overflow-y-auto">
                                  {Object.entries(s.pages)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([path, count]) => (
                                      <li key={path} className="flex justify-between gap-2">
                                        <span className="truncate">{path}</span>
                                        <span className="text-foreground font-medium shrink-0">{count}</span>
                                      </li>
                                    ))}
                                </ul>
                              ) : (
                                <p className="text-muted-foreground">No page visits recorded</p>
                              )}
                            </div>

                            {/* Downloads & Appraisals */}
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-foreground">Downloads ({s.downloads})</h4>
                                {s.downloadItems.length > 0 ? (
                                  <ul className="space-y-0.5 text-muted-foreground max-h-24 overflow-y-auto">
                                    {s.downloadItems.map((item, i) => (
                                      <li key={i} className="flex items-center gap-1.5">
                                        <Download className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-muted-foreground">No downloads recorded</p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-semibold text-foreground">Appraisal requests ({s.appraisalCount})</h4>
                                {s.appraisalCount > 0 ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate("/admin/appraisals");
                                    }}
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    View appraisals
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <p className="text-muted-foreground">No appraisal requests</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
