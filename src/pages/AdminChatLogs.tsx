import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Lock, MessageSquare, ChevronDown, ChevronUp, Copy, Trash2, ThumbsUp, ThumbsDown, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import type { Msg } from "@/lib/conversations";

const ADMIN_PASSWORD = "reid-admin-2025";

interface ChatLog {
  id: string;
  conversation_id: string;
  wix_user_id: string | null;
  wix_user_name: string | null;
  wix_user_email: string | null;
  title: string;
  messages: Msg[];
  search_mode: string | null;
  user_tier: string | null;
  message_count: number;
  copy_count: number;
  likes: number;
  dislikes: number;
  created_at: string;
  updated_at: string;
}

export default function AdminChatLogs() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      fetchLogs();
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_logs" as any)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500) as any;

    if (!error && data) setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) fetchLogs();
  }, [authenticated]);

  const handleCopyChat = (log: ChatLog) => {
    const text = log.messages
      .map((m) => `${m.role === "user" ? "User" : "REID"}:\n${m.content}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Full conversation copied");
  };

  const handleDelete = async (log: ChatLog) => {
    const { error } = await supabase
      .from("chat_logs" as any)
      .delete()
      .eq("id", log.id) as any;

    if (error) {
      toast.error("Failed to delete");
    } else {
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
      if (expandedId === log.id) setExpandedId(null);
      toast.success("Conversation deleted");
    }
  };

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      log.title?.toLowerCase().includes(q) ||
      log.wix_user_name?.toLowerCase().includes(q) ||
      log.wix_user_email?.toLowerCase().includes(q) ||
      log.messages?.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  };

  const handleDownloadSelected = () => {
    const selected = filtered.filter((l) => selectedIds.has(l.id));
    if (selected.length === 0) { toast.error("No conversations selected"); return; }

    const escCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["Title", "User Name", "User Email", "Mode", "Date", "Messages", "Likes", "Dislikes", "Copies", "Conversation"];
    const rows = selected.map((log) => {
      const conversation = log.messages.map((m) => `${m.role === "user" ? "User" : "REID"}: ${m.content}`).join("\n\n");
      return [
        escCsv(log.title),
        escCsv(log.wix_user_name || "Anonymous"),
        escCsv(log.wix_user_email || ""),
        escCsv(log.search_mode || "data-analyst"),
        escCsv(new Date(log.updated_at).toLocaleString("en-GB")),
        String(log.message_count),
        String(log.likes),
        String(log.dislikes),
        String(log.copy_count),
        escCsv(conversation),
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reid-chat-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${selected.length} conversation${selected.length > 1 ? "s" : ""}`);
  };

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

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Chat logs</h1>
            <span className="text-sm text-muted-foreground">({filtered.length} conversations)</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button variant="outline" size="sm" onClick={handleDownloadSelected}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, title, or message content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[200px]">User</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-[100px]">Mode</TableHead>
                <TableHead className="w-[80px]">Messages</TableHead>
                <TableHead className="w-[100px]">Feedback</TableHead>
                <TableHead className="w-[160px]">Last active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <>
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(log.id)}
                        onCheckedChange={() => toggleSelect(log.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.wix_user_name || "Anonymous"}</div>
                      <div className="text-xs text-muted-foreground">{log.wix_user_email || "No email"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{log.title}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {log.search_mode || "data-analyst"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-center">{log.message_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {log.likes > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-green-600">
                            <ThumbsUp className="h-3 w-3" /> {log.likes}
                          </span>
                        )}
                        {log.dislikes > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-red-500">
                            <ThumbsDown className="h-3 w-3" /> {log.dislikes}
                          </span>
                        )}
                        {log.copy_count > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Copy className="h-3 w-3" /> {log.copy_count}
                          </span>
                        )}
                        {log.likes === 0 && log.dislikes === 0 && log.copy_count === 0 && (
                          <span className="text-muted-foreground/40">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.updated_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleCopyChat(log)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          title="Copy full conversation"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(log)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete conversation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {expandedId === log.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow key={`${log.id}-expanded`}>
                      <TableCell colSpan={8} className="p-0">
                        <div className="max-h-96 overflow-y-auto p-4 space-y-3 bg-muted/30">
                          {log.messages?.map((msg, i) => (
                            <div
                              key={i}
                              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                                  msg.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card border border-border text-foreground"
                                }`}
                              >
                                <div className="text-[10px] font-medium opacity-60 mb-1">
                                  {msg.role === "user" ? "User" : "REID"}
                                </div>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {loading ? "Loading chat logs..." : "No conversations found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
