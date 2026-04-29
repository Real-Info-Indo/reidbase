import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Lock, ClipboardList, RefreshCw, Eye, CheckCircle2, Clock,
  ArrowLeft, ChevronDown, ChevronUp, Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/hooks/useAdminAuth";


interface AppraisalRequest {
  id: string;
  property_type: string | null;
  location: string | null;
  description: string | null;
  ownership_type: string | null;
  land_zone: string | null;
  lease_term: string | null;
  land_size: string | null;
  internal_size: string | null;
  property_status: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  year_built: string | null;
  currently_operational: string | null;
  property_website: string | null;
  average_daily_rate: string | null;
  average_occupancy: string | null;
  years_operating: string | null;
  construction_budget: string | null;
  consultant_budget: string | null;
  ffe_budget: string | null;
  landscaping_budget: string | null;
  overheads: string | null;
  admin_notes: string | null;
  status: string;
  reviewed_at: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "new") {
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">New</Badge>;
  }
  if (status === "reviewed") {
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">Reviewed</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export default function AdminAppraisals() {
  const { authenticated, signIn } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [requests, setRequests] = useState<AppraisalRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    if (!signIn(password)) setPassword("");
  };

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("appraisal_requests" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500) as any;

    if (!error && data) setRequests(data);
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) fetchRequests();
  }, [authenticated]);

  const markReviewed = async (id: string) => {
    await supabase
      .from("appraisal_requests" as any)
      .update({ status: "reviewed", reviewed_at: new Date().toISOString() } as any)
      .eq("id", id) as any;
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "reviewed", reviewed_at: new Date().toISOString() } : r
      )
    );
  };

  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (expandedId) {
      const r = requests.find((req) => req.id === expandedId);
      setNotesValue(r?.admin_notes || "");
    }
  }, [expandedId]);

  const saveNotes = async (id: string) => {
    setSavingNotes(true);
    await supabase
      .from("appraisal_requests" as any)
      .update({ admin_notes: notesValue } as any)
      .eq("id", id) as any;
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, admin_notes: notesValue } : r))
    );
    setSavingNotes(false);
  };

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.property_type?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.ownership_type?.toLowerCase().includes(q)
      );
    });
  }, [requests, search, statusFilter]);

  const newCount = requests.filter((r) => r.status === "new").length;

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

  const detailRow = (label: string, value: string | null) => {
    if (!value) return null;
    return (
      <div className="flex gap-4 py-1.5">
        <span className="text-muted-foreground text-sm w-40 shrink-0">{label}</span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin/analytics")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Appraisal requests</h1>
            {newCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-500/15 px-2 py-0.5 rounded-full">
                {newCount} new
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading" : "Refresh"}
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{requests.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{newCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Reviewed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{requests.filter((r) => r.status === "reviewed").length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <Input
            placeholder="Search by type, location, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-[100px]">Ownership</TableHead>
                <TableHead className="w-[80px]">Beds</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[140px]">Submitted</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => (
                <>
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                  >
                    <TableCell className="text-sm font-medium">{req.property_type || "—"}</TableCell>
                    <TableCell className="text-sm">{req.location || "—"}</TableCell>
                    <TableCell className="text-sm">{req.ownership_type || "—"}</TableCell>
                    <TableCell className="text-sm text-center">{req.bedrooms || "—"}</TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {req.status === "new" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); markReviewed(req.id); }}
                          className="h-7 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" /> Review
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {expandedId === req.id
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                  </TableRow>
                  {expandedId === req.id && (
                    <TableRow key={`${req.id}-detail`}>
                      <TableCell colSpan={8} className="p-0">
                        <div className="p-6 bg-muted/30 space-y-1">
                          {detailRow("Property type", req.property_type)}
                          {detailRow("Location", req.location)}
                          {detailRow("Description", req.description)}
                          {detailRow("Ownership", req.ownership_type)}
                          {detailRow("Land zone", req.land_zone)}
                          {detailRow("Lease term", req.lease_term ? `${req.lease_term} years` : null)}
                          {detailRow("Land size", req.land_size ? `${req.land_size} sqm` : null)}
                          {detailRow("Internal size", req.internal_size ? `${req.internal_size} sqm` : null)}
                          {detailRow("Property status", req.property_status)}
                          {detailRow("Bedrooms", req.bedrooms)}
                          {detailRow("Bathrooms", req.bathrooms)}
                          {detailRow("Year built", req.year_built)}
                          {detailRow("Operational", req.currently_operational)}
                          {detailRow("Website", req.property_website)}
                          {detailRow("Average daily rate", req.average_daily_rate ? `$${req.average_daily_rate}` : null)}
                          {detailRow("Occupancy", req.average_occupancy ? `${req.average_occupancy}%` : null)}
                          {detailRow("Years operating", req.years_operating)}
                          {req.property_status === "off_plan" && (
                            <>
                              {detailRow("Construction budget", req.construction_budget ? `$${req.construction_budget}` : null)}
                              {detailRow("Consultant budget", req.consultant_budget ? `$${req.consultant_budget}` : null)}
                              {detailRow("FF&E budget", req.ffe_budget ? `$${req.ffe_budget}` : null)}
                              {detailRow("Landscaping budget", req.landscaping_budget ? `$${req.landscaping_budget}` : null)}
                              {detailRow("Overheads", req.overheads ? `$${req.overheads}` : null)}
                            </>
                          )}
                          {req.reviewed_at && detailRow("Reviewed at", new Date(req.reviewed_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                          }))}

                          {/* Admin notes */}
                          <div className="mt-4 pt-4 border-t border-border">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Admin notes</label>
                            <textarea
                              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                              placeholder="Add notes about this request..."
                              value={notesValue}
                              onChange={(e) => setNotesValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex justify-end mt-2">
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); saveNotes(req.id); }}
                                disabled={savingNotes}
                                className="h-7 text-xs"
                              >
                                <Save className="h-3 w-3 mr-1" />
                                {savingNotes ? "Saving..." : "Save notes"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {loading ? "Loading requests..." : "No appraisal requests found"}
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
