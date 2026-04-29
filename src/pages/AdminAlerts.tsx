import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Shield, AlertTriangle, Eye, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";


interface ChatFlag {
  id: string;
  conversation_id: string;
  wix_user_id: string | null;
  wix_user_name: string | null;
  wix_user_email: string | null;
  flagged_message: string;
  category: string;
  severity: string;
  details: string | null;
  reviewed: boolean;
  admin_notes: string | null;
  created_at: string;
}

export default function AdminAlerts() {
  const { authenticated, signIn } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [flags, setFlags] = useState<ChatFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const fetchFlags = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_flags" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500) as any;
    if (!error && data) setFlags(data);
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) fetchFlags();
  }, [authenticated]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn(password)) setPassword("");
  };

  const markReviewed = async (flag: ChatFlag) => {
    const notes = noteInputs[flag.id] || "";
    await supabase
      .from("chat_flags" as any)
      .update({ reviewed: true, admin_notes: notes || null } as any)
      .eq("id", flag.id) as any;
    fetchFlags();
  };

  const severityColour = (s: string) => {
    if (s === "high") return "destructive";
    if (s === "medium") return "default";
    return "secondary";
  };

  const categoryLabel = (c: string) => c.replace(/_/g, " ");

  const filtered = flags.filter((f) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      f.flagged_message?.toLowerCase().includes(q) ||
      f.wix_user_name?.toLowerCase().includes(q) ||
      f.wix_user_email?.toLowerCase().includes(q) ||
      f.category?.toLowerCase().includes(q)
    );
  });

  const unreviewed = flags.filter((f) => !f.reviewed).length;

  if (!authenticated) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-background">
        <form onSubmit={handleAuth} className="space-y-4 w-80">
          <h1 className="text-xl font-bold text-center">Admin Alerts</h1>
          <Input type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" className="w-full">Enter</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/analytics")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-6 w-6 text-destructive" />
          <h1 className="text-xl font-bold">Chat Alerts</h1>
          {unreviewed > 0 && (
            <Badge variant="destructive">{unreviewed} unreviewed</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/chat-logs")}>
            Chat Logs
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/users")}>
            Users
          </Button>
          <Button variant="outline" size="icon" onClick={fetchFlags} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Input
        placeholder="Search by user, message, or category..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No alerts found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((flag) => (
            <div key={flag.id} className={`border rounded-lg p-4 ${flag.reviewed ? "opacity-60" : ""}`}>
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === flag.id ? null : flag.id)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${flag.severity === "high" ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={severityColour(flag.severity) as any}>{flag.severity}</Badge>
                      <Badge variant="outline">{categoryLabel(flag.category)}</Badge>
                      {flag.reviewed && <Badge variant="secondary">reviewed</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {new Date(flag.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm mt-1 truncate">
                      <span className="font-medium">{flag.wix_user_name || "Unknown user"}</span>
                      {flag.wix_user_email && <span className="text-muted-foreground"> ({flag.wix_user_email})</span>}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{flag.flagged_message.substring(0, 120)}</p>
                  </div>
                </div>
                {expandedId === flag.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
              </div>

              {expandedId === flag.id && (
                <div className="mt-4 pl-7 space-y-3 border-t pt-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Full message</p>
                    <p className="text-sm bg-muted/50 p-3 rounded whitespace-pre-wrap">{flag.flagged_message}</p>
                  </div>
                  {flag.details && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Detection reason</p>
                      <p className="text-sm">{flag.details}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Conversation: {flag.conversation_id}</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => navigate(`/admin/chat-logs?conversation=${encodeURIComponent(flag.conversation_id)}&search=${encodeURIComponent(flag.flagged_message.substring(0, 40))}`)}
                    >
                      View chat
                    </Button>
                  </div>
                  {!flag.reviewed && (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Admin notes (optional)"
                        value={noteInputs[flag.id] || ""}
                        onChange={(e) => setNoteInputs({ ...noteInputs, [flag.id]: e.target.value })}
                        className="text-sm flex-1"
                      />
                      <Button size="sm" onClick={() => markReviewed(flag)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Mark reviewed
                      </Button>
                    </div>
                  )}
                  {flag.admin_notes && (
                    <p className="text-xs text-muted-foreground">Admin notes: {flag.admin_notes}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
