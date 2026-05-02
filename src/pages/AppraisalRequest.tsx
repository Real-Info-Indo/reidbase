import { useState } from "react";
import { ArrowRight, Upload, CheckCircle2, FileText } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";
import { supabase } from "@/integrations/supabase/client";
import { trackFeature } from "@/lib/analytics";
import { wixAuthHeader } from "@/lib/wixToken";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const REQUIRED_FIELDS: { key: string; label: string }[] = [
  { key: "propertyType", label: "Property Type" },
  { key: "location", label: "Location" },
  { key: "ownershipType", label: "Ownership Type" },
  { key: "landZone", label: "Land Zone" },
  { key: "leaseTerm", label: "Lease Term" },
  { key: "landSize", label: "Land Size" },
  { key: "internalSize", label: "Internal Size" },
  { key: "propertyStatus", label: "Property Status" },
  { key: "bedrooms", label: "Bedrooms" },
];

export default function AppraisalRequest() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/appraisal-request");
  const [propertyStatus, setPropertyStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Form state
  const [form, setForm] = useState({
    propertyType: "",
    location: "",
    description: "",
    ownershipType: "",
    landZone: "",
    leaseTerm: "",
    landSize: "",
    internalSize: "",
    bedrooms: "",
    bathrooms: "",
    yearBuilt: "",
    currentlyOperational: "",
    propertyWebsite: "",
    averageDailyRate: "",
    averageOccupancy: "",
    yearsOperating: "",
    constructionBudget: "",
    consultantBudget: "",
    ffeBudget: "",
    landscapingBudget: "",
    overheads: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-appraisal", {
        body: { ...form, propertyStatus },
        headers: wixAuthHeader(),
      });
      if (error) throw error;
      setShowConfirmation(true);
      trackFeature("appraisal_submitted", { property_type: form.propertyType, location: form.location });
    } catch (err) {
      console.error("Submission error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const isOffPlan = propertyStatus === "off_plan";

  const selectClass = "w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const inputClass = selectClass;
  const labelClass = "block text-sm font-extralight mb-1.5";

  return (
    <div className="relative w-full overflow-x-hidden p-8">
      {!hasAccess && <UpgradeOverlay />}
      <div className={!hasAccess ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-1">Appraisal Request</h1>
              <p className="text-muted-foreground font-extralight">Discover your property fair market value.</p>
            </div>
            <a
              href="/downloads/REID_Property_Appraisal_Sample.pdf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackFeature("appraisal_sample_viewed")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors shrink-0"
            >
              <FileText className="h-4 w-4" />
              Sample Report
            </a>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Property Type <span className="text-destructive">*</span></label>
                <select className={selectClass} value={form.propertyType} onChange={(e) => update("propertyType", e.target.value)}>
                  <option value="">Select type</option>
                  <option>Villa</option>
                  <option>Land</option>
                  <option>Commercial</option>
                  <option>Apartment</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Location <span className="text-destructive">*</span></label>
                <input className={inputClass} placeholder="Search location..." value={form.location} onChange={(e) => update("location", e.target.value)} />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Property Description</label>
              <textarea className={`${inputClass} min-h-[100px] resize-none`} placeholder="Describe the property..." value={form.description} onChange={(e) => update("description", e.target.value)} />
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Ownership Type <span className="text-destructive">*</span></label>
                <select className={selectClass} value={form.ownershipType} onChange={(e) => update("ownershipType", e.target.value)}>
                  <option value="">Select</option>
                  <option>Freehold</option>
                  <option>Leasehold</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Land Zone <span className="text-destructive">*</span></label>
                <select className={selectClass} value={form.landZone} onChange={(e) => update("landZone", e.target.value)}>
                  <option value="">Select</option>
                  <option value="Residential (Yellow)">Residential (Yellow)</option>
                  <option value="Tourism (Pink)">Tourism (Pink)</option>
                  <option value="Commercial (Red)">Commercial (Red)</option>
                  <option value="Agriculture (Green)">Agriculture (Green)</option>
                </select>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Lease Term (years) <span className="text-destructive">*</span></label>
                <input type="number" className={inputClass} placeholder="e.g. 25" value={form.leaseTerm} onChange={(e) => update("leaseTerm", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Land Size (SQM) <span className="text-destructive">*</span></label>
                <input type="number" className={inputClass} placeholder="e.g. 500" value={form.landSize} onChange={(e) => update("landSize", e.target.value)} />
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Internal Size (SQM) <span className="text-destructive">*</span></label>
                <input type="number" className={inputClass} placeholder="e.g. 300" value={form.internalSize} onChange={(e) => update("internalSize", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Property Status <span className="text-destructive">*</span></label>
                <select className={selectClass} value={propertyStatus} onChange={(e) => setPropertyStatus(e.target.value)}>
                  <option value="">Select</option>
                  <option value="completed">Completed</option>
                  <option value="off_plan">Off Plan</option>
                </select>
              </div>
            </div>

            {/* Conditional: Off Plan budgets */}
            {isOffPlan && (
              <div className="border border-primary/30 rounded-xl p-6 bg-primary/5 space-y-6">
                <h3 className="font-bold text-sm uppercase tracking-wider text-primary">Construction Budget Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Construction Budget ($)</label>
                    <input type="number" className={inputClass} placeholder="Total construction cost" value={form.constructionBudget} onChange={(e) => update("constructionBudget", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Consultant Budget ($)</label>
                    <input type="number" className={inputClass} placeholder="Architect / Engineer" value={form.consultantBudget} onChange={(e) => update("consultantBudget", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>FF&E Budget ($)</label>
                    <input type="number" className={inputClass} placeholder="Furniture, Fixtures & Equipment" value={form.ffeBudget} onChange={(e) => update("ffeBudget", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Landscaping Budget ($)</label>
                    <input type="number" className={inputClass} placeholder="Landscaping costs" value={form.landscapingBudget} onChange={(e) => update("landscapingBudget", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Overheads ($)</label>
                    <input type="number" className={inputClass} placeholder="Overhead costs" value={form.overheads} onChange={(e) => update("overheads", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Row 5 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>Bedrooms <span className="text-destructive">*</span></label>
                <input type="number" className={inputClass} placeholder="e.g. 3" value={form.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Bathrooms</label>
                <input type="number" className={inputClass} placeholder="e.g. 2" value={form.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Year Built</label>
                <input type="number" className={inputClass} placeholder="e.g. 2022" value={form.yearBuilt} onChange={(e) => update("yearBuilt", e.target.value)} />
              </div>
            </div>

            {/* Row 6 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Currently Operational</label>
                <select className={selectClass} value={form.currentlyOperational} onChange={(e) => update("currentlyOperational", e.target.value)}>
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Property Website</label>
                <input type="text" className={inputClass} placeholder="www.example.com" value={form.propertyWebsite} onChange={(e) => update("propertyWebsite", e.target.value)} />
              </div>
            </div>

            {/* Row 7 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>Average Daily Rate ($)</label>
                <input type="number" className={inputClass} placeholder="e.g. 250" value={form.averageDailyRate} onChange={(e) => update("averageDailyRate", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Average Occupancy (%)</label>
                <input type="number" className={inputClass} placeholder="e.g. 75" value={form.averageOccupancy} onChange={(e) => update("averageOccupancy", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Years Operating</label>
                <input type="number" className={inputClass} placeholder="e.g. 3" value={form.yearsOperating} onChange={(e) => update("yearsOperating", e.target.value)} />
              </div>
            </div>


            {/* File upload */}
            <div>
              <label className={labelClass}>Property Files</label>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Drop files here or click to upload</p>
                <p className="text-xs text-muted-foreground/60 mt-1">PDF, JPG, PNG up to 10MB</p>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-bold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "SUBMITTING..." : "SUBMIT"} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center items-center">
            <CheckCircle2 className="h-12 w-12 text-primary mb-2" />
            <DialogTitle className="text-xl">Request Submitted</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2">
              Thank you for your appraisal request. A member of our appraisal team will get back to you within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <button
            onClick={() => setShowConfirmation(false)}
            className="w-full mt-4 rounded-lg bg-primary px-6 py-2.5 font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            OK
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
