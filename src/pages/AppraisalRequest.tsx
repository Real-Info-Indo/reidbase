import { useState } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { useTier } from "@/contexts/TierContext";
import { UpgradeOverlay } from "@/components/UpgradeOverlay";
import { useToast } from "@/hooks/use-toast";

export default function AppraisalRequest() {
  const { canAccess } = useTier();
  const hasAccess = canAccess("/appraisal-request");
  const { toast } = useToast();
  const [propertyStatus, setPropertyStatus] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Appraisal Request Submitted", description: "We'll get back to you within 48 hours." });
  };

  const isUnderConstruction = propertyStatus === "under_construction";

  const selectClass = "w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const inputClass = selectClass;
  const labelClass = "block text-sm font-medium mb-1.5";

  return (
    <div className="relative p-8">
      {!hasAccess && <UpgradeOverlay />}
      <div className={!hasAccess ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold mb-1">Appraisal Request</h1>
          <p className="text-muted-foreground mb-8">Discover your property fair market value.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Property Type</label>
                <select className={selectClass}>
                  <option value="">Select type</option>
                  <option>Villa</option>
                  <option>Land</option>
                  <option>Commercial</option>
                  <option>Apartment</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input className={inputClass} placeholder="Search location..." />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelClass}>Property Description</label>
              <textarea className={`${inputClass} min-h-[100px] resize-none`} placeholder="Describe the property..." />
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Ownership Type</label>
                <select className={selectClass}>
                  <option value="">Select</option>
                  <option>Freehold</option>
                  <option>Leasehold</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Land Zone</label>
                <select className={selectClass}>
                  <option value="">Select</option>
                  <option>Residential</option>
                  <option>Commercial</option>
                  <option>Tourism</option>
                  <option>Agricultural</option>
                </select>
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Lease Term (years)</label>
                <input type="number" className={inputClass} placeholder="e.g. 25" />
              </div>
              <div>
                <label className={labelClass}>Land Size (SQM)</label>
                <input type="number" className={inputClass} placeholder="e.g. 500" />
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Internal Size (SQM)</label>
                <input type="number" className={inputClass} placeholder="e.g. 300" />
              </div>
              <div>
                <label className={labelClass}>Property Status</label>
                <select className={selectClass} value={propertyStatus} onChange={(e) => setPropertyStatus(e.target.value)}>
                  <option value="">Select</option>
                  <option value="completed">Completed</option>
                  <option value="under_construction">Under Construction</option>
                  <option value="off_plan">Off Plan</option>
                </select>
              </div>
            </div>

            {/* Row 5 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>Bedrooms</label>
                <input type="number" className={inputClass} placeholder="e.g. 3" />
              </div>
              <div>
                <label className={labelClass}>Bathrooms</label>
                <input type="number" className={inputClass} placeholder="e.g. 2" />
              </div>
              <div>
                <label className={labelClass}>Year Built</label>
                <input type="number" className={inputClass} placeholder="e.g. 2022" />
              </div>
            </div>

            {/* Row 6 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Currently Operational</label>
                <select className={selectClass}>
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Property Website</label>
                <input type="url" className={inputClass} placeholder="https://..." />
              </div>
            </div>

            {/* Row 7 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelClass}>Average Daily Rate ($)</label>
                <input type="number" className={inputClass} placeholder="e.g. 250" />
              </div>
              <div>
                <label className={labelClass}>Average Occupancy (%)</label>
                <input type="number" className={inputClass} placeholder="e.g. 75" />
              </div>
              <div>
                <label className={labelClass}>Years Operating</label>
                <input type="number" className={inputClass} placeholder="e.g. 3" />
              </div>
            </div>

            {/* Conditional: Under Construction budgets */}
            {isUnderConstruction && (
              <div className="border border-primary/30 rounded-xl p-6 bg-primary/5 space-y-6">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-primary">Construction Budget Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>Construction Budget ($)</label>
                    <input type="number" className={inputClass} placeholder="Total construction cost" />
                  </div>
                  <div>
                    <label className={labelClass}>Consultant Budget ($)</label>
                    <input type="number" className={inputClass} placeholder="Architect / Engineer" />
                  </div>
                  <div>
                    <label className={labelClass}>FF&E Budget ($)</label>
                    <input type="number" className={inputClass} placeholder="Furniture, Fixtures & Equipment" />
                  </div>
                  <div>
                    <label className={labelClass}>Landscaping Budget ($)</label>
                    <input type="number" className={inputClass} placeholder="Landscaping costs" />
                  </div>
                  <div>
                    <label className={labelClass}>Overheads ($)</label>
                    <input type="number" className={inputClass} placeholder="Overhead costs" />
                  </div>
                </div>
              </div>
            )}

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
              className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              SUBMIT <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
