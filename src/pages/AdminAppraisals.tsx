import { useState, useEffect, useMemo } from "react";
import {
  ClipboardList, RefreshCw, Eye, CheckCircle2, Clock,
  ArrowLeft, ChevronDown, ChevronUp, Save, Download, FileText,
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
import { AdminGate } from "@/components/AdminGate";
import { invokeAdmin } from "@/lib/adminApi";
import { toast } from "sonner";


interface AppraisalFile {
  name: string;
  path: string;
  mimeType: string;
  size: number;
}

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
  files: AppraisalFile[] | null;
  wix_user_id: string | null;
  wix_user_name: string | null;
  wix_user_email: string | null;
}

function formatBytes(n: number): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
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
  const { authenticated, checking, error } = useAdminAuth();
  const [requests, setRequests] = useState<AppraisalRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const result = await invokeAdmin<{ requests: AppraisalRequest[] }>("admin-data", { action: "appraisals" });
      setRequests(result.requests || []);
    } catch (e) {
      toast.error((e as Error).message || "Failed to load appraisals");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authenticated) fetchRequests();
  }, [authenticated]);

  const markReviewed = async (id: string) => {
    try {
      await invokeAdmin("admin-mutate", { action: "review_appraisal", id });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: "reviewed", reviewed_at: new Date().toISOString() } : r
        )
      );
    } catch (e) {
      toast.error((e as Error).message || "Failed to update");
    }
  };

  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (expandedId) {
      const r = requests.find((req) => req.id === expandedId);
      setNotesValue(r?.admin_notes || "");
    }
  }, [expandedId]);

  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const downloadFile = async (file: AppraisalFile) => {
    setDownloadingPath(file.path);
    try {
      const { url } = await invokeAdmin<{ url: string }>("admin-data", {
        action: "appraisal_file_url",
        path: file.path,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message || "Failed to generate download link");
    }
    setDownloadingPath(null);
  };

  const saveNotes = async (id: string) => {
    setSavingNotes(true);
    try {
      await invokeAdmin("admin-mutate", { action: "save_appraisal_notes", id, admin_notes: notesValue });
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, admin_notes: notesValue } : r))
      );
    } catch (e) {
      toast.error((e as Error).message || "Failed to save notes");
    }
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
        r.ownership_type?.toLowerCase().includes(q) ||
        r.wix_user_name?.toLowerCase().includes(q) ||
        r.wix_user_email?.toLowerCase().includes(q)
      );
    });
  }, [requests, search, statusFilter]);

  const newCount = requests.filter((r) => r.status === "new").length;

  if (!authenticated) {
    return <AdminGate checking={checking} error={error} />;
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
                <TableHead className="w-[180px]">Submitter</TableHead>
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
                    <TableCell>
                      <div className="text-sm font-medium">{req.wix_user_name || "Anonymous"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[170px]">{req.wix_user_email || "No email"}</div>
                    </TableCell>
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

                          {/* Attached files */}
                          {Array.isArray(req.files) && req.files.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <label className="block text-sm font-medium text-muted-foreground mb-2">
                                Attached files ({req.files.length})
                              </label>
                              <ul className="space-y-2">
                                {req.files.map((f, i) => (
                                  <li
                                    key={`${f.path}-${i}`}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate font-medium">{f.name}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {f.mimeType} · {formatBytes(f.size)}
                                        </div>
                                        <div className="text-xs text-muted-foreground/70 truncate font-mono">
                                          {f.path}
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => { e.stopPropagation(); downloadFile(f); }}
                                      disabled={downloadingPath === f.path}
                                      className="h-7 text-xs shrink-0"
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      {downloadingPath === f.path ? "Loading..." : "Download"}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

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
