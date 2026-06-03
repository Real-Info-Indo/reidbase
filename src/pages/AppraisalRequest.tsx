import { useRef, useState } from "react";
import { ArrowRight, Upload, CheckCircle2, FileText, X } from "lucide-react";
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

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
];
const ALLOWED_EXT_RE = /\.(pdf|jpe?g|png|csv|xlsx?|ods)$/i;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 120) || "file";
}

export default function AppraisalRequest() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/appraisal-request");
  const [propertyStatus, setPropertyStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (missingFields.includes(field) && value.trim() !== "") {
      setMissingFields((prev) => prev.filter((f) => f !== field));
    }
  };

  const isMissing = (key: string) => missingFields.includes(key);
  const fieldClass = (base: string, key: string) =>
    `${base} ${isMissing(key) ? "border-destructive ring-1 ring-destructive/40" : ""}`;

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const accepted: File[] = [];
    for (const f of arr) {
      const typeOk = ALLOWED_MIME.includes(f.type) || ALLOWED_EXT_RE.test(f.name);
      if (!typeOk) {
        toast.error("Unsupported file type", { description: `${f.name} – only PDF, JPG, PNG, CSV, XLS, XLSX, ODS allowed.` });
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error("File too large", { description: `${f.name} exceeds 10MB.` });
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => {
      const combined = [...prev, ...accepted];
      if (combined.length > MAX_FILES) {
        toast.error("Too many files", { description: `Maximum ${MAX_FILES} files allowed.` });
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side check mirroring server REQUIRED_FIELDS
    const payload: Record<string, string> = { ...form, propertyStatus };
    const missingNow = REQUIRED_FIELDS.filter(
      (f) => !payload[f.key] || String(payload[f.key]).trim() === "",
    );
    if (missingNow.length > 0) {
      const keys = missingNow.map((f) => f.key);
      setMissingFields(keys);
      toast.error("Please complete the required fields", {
        description: missingNow.map((f) => f.label).join(", "),
      });
      return;
    }

    setMissingFields([]);
    setSubmitting(true);
    const uploadedPaths: string[] = [];
    const cleanupUploads = async () => {
      if (uploadedPaths.length === 0) return;
      try {
        await supabase.storage.from("appraisals").remove(uploadedPaths);
      } catch (cleanupErr) {
        console.warn("Failed to clean up orphaned appraisal uploads:", cleanupErr);
      }
    };
    try {
      const requestId = crypto.randomUUID();
      const uploadedMeta: { name: string; path: string; mimeType: string; size: number }[] = [];

      // Upload files first
      for (const f of files) {
        const safeName = sanitizeFilename(f.name);
        const path = `appraisal-requests/${requestId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("appraisals")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) {
          toast.error("File upload failed", { description: `${f.name}: ${upErr.message}` });
          await cleanupUploads();
          setSubmitting(false);
          return;
        }
        uploadedPaths.push(path);
        uploadedMeta.push({
          name: f.name,
          path,
          mimeType: f.type || "application/octet-stream",
          size: f.size,
        });
      }

      const { data, error } = await supabase.functions.invoke("send-appraisal", {
        body: { ...payload, requestId, files: uploadedMeta },
        headers: await wixAuthHeader(),
      });
      if (error) {
        const ctx: any = (error as any).context;
        const status: number | undefined = ctx?.status;
        let body: any = undefined;
        try {
          body = ctx?.body ? JSON.parse(ctx.body) : undefined;
        } catch {}

        await cleanupUploads();

        const code: string | undefined = body?.error;
        const field: string | undefined = body?.field;

        if (status === 401 || code === "unauthorized") {
          toast.error("Sign in required", {
            description: "Please sign in again to submit appraisal requests.",
          });
          return;
        }

        if (status === 403 || code === "forbidden") {
          toast.error("Upgrade required", {
            description: "Your current plan does not include appraisal requests. Please upgrade to continue.",
          });
          return;
        }

        if (status === 400) {
          if (code === "missing_required_fields" && Array.isArray(body.missing)) {
            setMissingFields(body.missing);
            const labels = body.missing.map(
              (k: string) => REQUIRED_FIELDS.find((f) => f.key === k)?.label ?? k,
            );
            toast.error("Please complete the required fields", {
              description: labels.join(", "),
            });
            return;
          }

          const fileErrorMessages: Record<string, string> = {
            invalid_files: "File list is invalid.",
            too_many_files: "Too many files attached. Maximum is 5.",
            invalid_file_entry: "One of the attached files is invalid.",
            invalid_file_name: "A file name is invalid or too long.",
            invalid_file_type: "Unsupported file type. Only PDF, JPG, PNG, CSV, XLS, XLSX, ODS allowed.",
            invalid_file_size: "A file exceeds the 10MB limit.",
            invalid_file_path: "A file path is invalid.",
            file_not_found: "An attached file could not be verified in storage.",
            invalid_request_id: "Invalid request. Please try again.",
            invalid_body: "Invalid submission. Please try again.",
            invalid_field: "A form field is invalid.",
            field_too_long: "A form field exceeds the allowed length.",
          };

          if (code && fileErrorMessages[code]) {
            toast.error("File validation failed", {
              description: field ? `${field}: ${fileErrorMessages[code]}` : fileErrorMessages[code],
            });
            return;
          }

          toast.error("Submission failed", {
            description: body?.message ?? "Please check the form and try again.",
          });
          return;
        }

        // 500-level: storage_verification_failed, db_insert_failed, internal_error, or unknown
        toast.error("Submission failed", {
          description: "Please try again or contact support.",
        });
        return;
      }

      if ((data as any)?.ok === true) {
        setShowConfirmation(true);
        trackFeature("appraisal_submitted", { property_type: form.propertyType, location: form.location, file_count: uploadedMeta.length });
        // Reset form
        setForm({
          propertyType: "", location: "", description: "", ownershipType: "", landZone: "",
          leaseTerm: "", landSize: "", internalSize: "", bedrooms: "", bathrooms: "",
          yearBuilt: "", currentlyOperational: "", propertyWebsite: "", averageDailyRate: "",
          averageOccupancy: "", yearsOperating: "", constructionBudget: "", consultantBudget: "",
          ffeBudget: "", landscapingBudget: "", overheads: "",
        });
        setPropertyStatus("");
        setFiles([]);
      } else {
        await cleanupUploads();
        toast.error("Submission failed", {
          description: (data as any)?.message ?? "Unexpected response from server.",
        });
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      await cleanupUploads();
      toast.error("Submission failed", {
        description: err?.message ?? "Network error. Please try again.",
      });
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
              href="/downloads/sample-appraisal.html"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackFeature("appraisal_sample_viewed")}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors shrink-0"
            >
              <FileText className="h-4 w-4" />
              Sample Report
            </a>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Property Type <span className="text-destructive">*</span></label>
                <select
                  required
                  aria-invalid={isMissing("propertyType")}
                  className={fieldClass(selectClass, "propertyType")}
                  value={form.propertyType}
                  onChange={(e) => update("propertyType", e.target.value)}
                >
                  <option value="">Select type</option>
                  <option>Villa</option>
                  <option>Land</option>
                  <option>Commercial</option>
                  <option>Apartment</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Location <span className="text-destructive">*</span></label>
                <input
                  required
                  aria-invalid={isMissing("location")}
                  className={fieldClass(inputClass, "location")}
                  placeholder="Search location..."
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
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
                <select
                  required
                  aria-invalid={isMissing("ownershipType")}
                  className={fieldClass(selectClass, "ownershipType")}
                  value={form.ownershipType}
                  onChange={(e) => update("ownershipType", e.target.value)}
                >
                  <option value="">Select</option>
                  <option>Freehold</option>
                  <option>Leasehold</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Land Zone <span className="text-destructive">*</span></label>
                <select
                  required
                  aria-invalid={isMissing("landZone")}
                  className={fieldClass(selectClass, "landZone")}
                  value={form.landZone}
                  onChange={(e) => update("landZone", e.target.value)}
                >
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
                <input
                  type="number"
                  required
                  aria-invalid={isMissing("leaseTerm")}
                  className={fieldClass(inputClass, "leaseTerm")}
                  placeholder="e.g. 25"
                  value={form.leaseTerm}
                  onChange={(e) => update("leaseTerm", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Land Size (SQM) <span className="text-destructive">*</span></label>
                <input
                  type="number"
                  required
                  aria-invalid={isMissing("landSize")}
                  className={fieldClass(inputClass, "landSize")}
                  placeholder="e.g. 500"
                  value={form.landSize}
                  onChange={(e) => update("landSize", e.target.value)}
                />
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Internal Size (SQM) <span className="text-destructive">*</span></label>
                <input
                  type="number"
                  required
                  aria-invalid={isMissing("internalSize")}
                  className={fieldClass(inputClass, "internalSize")}
                  placeholder="e.g. 300"
                  value={form.internalSize}
                  onChange={(e) => update("internalSize", e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Property Status <span className="text-destructive">*</span></label>
                <select
                  required
                  aria-invalid={isMissing("propertyStatus")}
                  className={fieldClass(selectClass, "propertyStatus")}
                  value={propertyStatus}
                  onChange={(e) => {
                    setPropertyStatus(e.target.value);
                    if (missingFields.includes("propertyStatus") && e.target.value) {
                      setMissingFields((prev) => prev.filter((f) => f !== "propertyStatus"));
                    }
                  }}
                >
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
                <input
                  type="number"
                  required
                  aria-invalid={isMissing("bedrooms")}
                  className={fieldClass(inputClass, "bedrooms")}
                  placeholder="e.g. 3"
                  value={form.bedrooms}
                  onChange={(e) => update("bedrooms", e.target.value)}
                />
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
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Drop files here or click to upload</p>
                <p className="text-xs text-muted-foreground/60 mt-1">PDF, JPG, PNG up to 10MB (max {MAX_FILES} files)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {files.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {files.map((f, idx) => (
                    <li
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        disabled={submitting}
                        aria-label={`Remove ${f.name}`}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
