import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Plus, Download, Pencil, Trash2, Link as LinkIcon, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminGate } from "@/components/AdminGate";
import { invokeAdmin } from "@/lib/adminApi";

interface Affiliate {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  wix_coupon_code: string | null;
  commission_rate: number;
  notes: string | null;
  active: boolean;
  created_at: string;
}

interface Attribution {
  wix_user_id: string;
  affiliate_id: string;
  source: "click" | "coupon";
  attributed_at: string;
  first_paid_at: string | null;
  first_paid_tier: string | null;
  wix_plan_names: string[];
  email: string | null;
  display_name: string | null;
}

interface AffiliatesPayload {
  affiliates: Affiliate[];
  click_counts: Record<string, number>;
  attributions: Attribution[];
}

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

function emptyForm(): Partial<Affiliate> {
  return {
    slug: "",
    name: "",
    email: "",
    wix_coupon_code: "",
    commission_rate: 0.15,
    notes: "",
    active: true,
  };
}

function AffiliatesInner() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AffiliatesPayload | null>(null);
  const [editing, setEditing] = useState<Partial<Affiliate> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await invokeAdmin<AffiliatesPayload>("admin-data", { action: "affiliates" });
      setData(res);
    } catch (err) {
      toast.error((err as Error).message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const reportRows = useMemo(() => {
    if (!data) return [];
    return data.affiliates.map((a) => {
      const attrs = data.attributions.filter((r) => r.affiliate_id === a.id);
      const paid = attrs.filter((r) => r.first_paid_at);
      return {
        ...a,
        clicks: data.click_counts[a.id] ?? 0,
        signups: attrs.length,
        paid: paid.length,
      };
    });
  }, [data]);

  const save = async () => {
    if (!editing) return;
    try {
      await invokeAdmin("admin-mutate", {
        action: "upsert_affiliate",
        id: editing.id,
        slug: editing.slug,
        name: editing.name,
        email: editing.email,
        wix_coupon_code: editing.wix_coupon_code,
        commission_rate: editing.commission_rate,
        notes: editing.notes,
        active: editing.active,
      });
      toast.success(editing.id ? "Affiliate updated" : "Affiliate created");
      setEditing(null);
      fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const removeAffiliate = async (id: string) => {
    if (!confirm("Delete this affiliate? If they have attributed users, they will be deactivated instead.")) return;
    try {
      const res = await invokeAdmin<{ deactivated?: boolean; deleted?: boolean }>("admin-mutate", {
        action: "delete_affiliate",
        id,
      });
      toast.success(res.deactivated ? "Deactivated (has attributions)" : "Deleted");
      fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const copyLink = (slug: string) => {
    const url = `${APP_ORIGIN}/?ref=${encodeURIComponent(slug)}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const exportCommissionCsv = () => {
    if (!data) return;
    const header = ["affiliate_slug", "affiliate_name", "user_email", "user_name", "wix_user_id", "source", "attributed_at", "first_paid_at", "first_paid_tier", "wix_plans", "commission_rate"];
    const affBySlug = new Map(data.affiliates.map((a) => [a.id, a]));
    const lines = [header.join(",")];
    for (const r of data.attributions) {
      const aff = affBySlug.get(r.affiliate_id);
      if (!aff) continue;
      lines.push([
        aff.slug,
        aff.name,
        r.email ?? "",
        r.display_name ?? "",
        r.wix_user_id,
        r.source,
        r.attributed_at,
        r.first_paid_at ?? "",
        r.first_paid_tier ?? "",
        (r.wix_plan_names ?? []).join("; "),
        String(aff.commission_rate),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliate-commissions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/analytics")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <h1 className="text-2xl font-semibold">Affiliates</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCommissionCsv} disabled={!data}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setEditing(emptyForm())}>
              <Plus className="h-4 w-4 mr-2" /> New affiliate
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Share each affiliate's link. When a referred visitor signs up and activates a paid plan in Wix within 60 days, the conversion is attributed automatically. Coupon codes are optional and can be cross-checked manually against the report.
        </p>

        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead>Slug / link</TableHead>
                <TableHead>Coupon</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Signups</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportRows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No affiliates yet</TableCell></TableRow>
              )}
              {reportRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                  </TableCell>
                  <TableCell>
                    <button onClick={() => copyLink(r.slug)} className="flex items-center gap-1 text-sm hover:underline">
                      <LinkIcon className="h-3.5 w-3.5" /> /?ref={r.slug}
                      <Copy className="h-3 w-3 opacity-60" />
                    </button>
                  </TableCell>
                  <TableCell className="text-sm">{r.wix_coupon_code ?? "—"}</TableCell>
                  <TableCell className="text-right">{(r.commission_rate * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{r.clicks}</TableCell>
                  <TableCell className="text-right">{r.signups}</TableCell>
                  <TableCell className="text-right font-medium">{r.paid}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded ${r.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                      {r.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeAffiliate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data && data.attributions.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Recent attributions</h2>
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Attributed</TableHead>
                    <TableHead>First paid</TableHead>
                    <TableHead>Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attributions.slice(0, 100).map((r) => {
                    const aff = data.affiliates.find((a) => a.id === r.affiliate_id);
                    return (
                      <TableRow key={r.wix_user_id}>
                        <TableCell>
                          <div className="text-sm">{r.display_name ?? r.email ?? r.wix_user_id.slice(0, 8)}</div>
                          {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{aff?.name ?? r.affiliate_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm capitalize">{r.source}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.attributed_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.first_paid_at ? new Date(r.first_paid_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-sm">{r.first_paid_tier ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit affiliate" : "New affiliate"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div>
                <Label>Slug (used in link)</Label>
                <Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="jane-doe" />
                {editing.slug && <p className="text-xs text-muted-foreground mt-1">{APP_ORIGIN}/?ref={editing.slug}</p>}
              </div>
              <div>
                <Label>Email</Label>
                <Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="jane@example.com" />
              </div>
              <div>
                <Label>Commission rate (0 to 1, e.g. 0.15 for 15%)</Label>
                <Input type="number" step="0.01" min="0" max="1" value={editing.commission_rate ?? 0.15} onChange={(e) => setEditing({ ...editing, commission_rate: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Wix coupon code (optional)</Label>
                <Input value={editing.wix_coupon_code ?? ""} onChange={(e) => setEditing({ ...editing, wix_coupon_code: e.target.value })} placeholder="JANE10" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminAffiliates() {
  const { authenticated, checking } = useAdminAuth();
  if (checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Checking access…</div>;
  if (!authenticated) return <AdminGate />;
  return <AffiliatesInner />;
}
