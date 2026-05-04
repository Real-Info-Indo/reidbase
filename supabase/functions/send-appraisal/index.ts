import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyWixToken, WixAuthError } from "../_shared/wix-auth.ts";
import { getEntitlement, meetsTier } from "../_shared/entitlements.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AppraisalData {
  propertyType?: string;
  location?: string;
  description?: string;
  ownershipType?: string;
  landZone?: string;
  leaseTerm?: string;
  landSize?: string;
  internalSize?: string;
  propertyStatus?: string;
  bedrooms?: string;
  bathrooms?: string;
  yearBuilt?: string;
  currentlyOperational?: string;
  propertyWebsite?: string;
  averageDailyRate?: string;
  averageOccupancy?: string;
  yearsOperating?: string;
  constructionBudget?: string;
  consultantBudget?: string;
  ffeBudget?: string;
  landscapingBudget?: string;
  overheads?: string;
}

// Field-by-field length caps to prevent abuse / oversized email payloads.
const FIELD_LIMITS: Record<keyof AppraisalData, number> = {
  propertyType: 80,
  location: 200,
  description: 4000,
  ownershipType: 80,
  landZone: 80,
  leaseTerm: 40,
  landSize: 40,
  internalSize: 40,
  propertyStatus: 80,
  bedrooms: 20,
  bathrooms: 20,
  yearBuilt: 20,
  currentlyOperational: 40,
  propertyWebsite: 500,
  averageDailyRate: 40,
  averageOccupancy: 40,
  yearsOperating: 40,
  constructionBudget: 40,
  consultantBudget: 40,
  ffeBudget: 40,
  landscapingBudget: 40,
  overheads: 40,
};

interface AppraisalFile {
  name: string;
  path: string;
  mimeType: string;
  size: number;
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function validateFiles(
  raw: unknown,
  requestId: string,
):
  | { ok: true; files: AppraisalFile[] }
  | { ok: false; error: string; field?: string } {
  if (raw == null) return { ok: true, files: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "invalid_files" };
  if (raw.length > MAX_FILES) return { ok: false, error: "too_many_files" };
  const expectedPrefix = `appraisal-requests/${requestId}/`;
  const out: AppraisalFile[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") return { ok: false, error: "invalid_file_entry" };
    const name = typeof (f as any).name === "string" ? (f as any).name.trim() : "";
    const path = typeof (f as any).path === "string" ? (f as any).path.trim() : "";
    const mimeType = typeof (f as any).mimeType === "string" ? (f as any).mimeType.trim() : "";
    const size = Number((f as any).size);
    if (!name || name.length > 255) return { ok: false, error: "invalid_file_name" };
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return { ok: false, error: "invalid_file_type", field: name };
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) {
      return { ok: false, error: "invalid_file_size", field: name };
    }
    if (!path.startsWith(expectedPrefix) || path.length > 1024) {
      return { ok: false, error: "invalid_file_path", field: name };
    }
    out.push({ name, path, mimeType, size });
  }
  return { ok: true, files: out };
}

function isValidRequestId(id: unknown): id is string {
  return typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const REQUIRED_FIELDS: (keyof AppraisalData)[] = [
  "propertyType",
  "location",
  "ownershipType",
  "landZone",
  "leaseTerm",
  "landSize",
  "internalSize",
  "propertyStatus",
  "bedrooms",
];

function sanitiseInput(
  raw: any,
):
  | { ok: true; data: AppraisalData }
  | { ok: false; error: string; missing?: string[]; field?: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_body" };
  const out: AppraisalData = {};
  for (const key of Object.keys(FIELD_LIMITS) as (keyof AppraisalData)[]) {
    const v = (raw as any)[key];
    if (v == null || v === "") continue;
    if (typeof v !== "string") return { ok: false, error: "invalid_field", field: key };
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (trimmed.length > FIELD_LIMITS[key]) {
      return { ok: false, error: "field_too_long", field: key };
    }
    out[key] = trimmed;
  }
  const missing = REQUIRED_FIELDS.filter((f) => !out[f]);
  if (missing.length > 0) {
    return { ok: false, error: "missing_required_fields", missing };
  }
  return { ok: true, data: out };
}


function buildEmailHtml(
  data: AppraisalData,
  submitter: { wixUserId: string | null; email: string | null; name?: string | null },
  files: AppraisalFile[],
  requestId: string,
): string {
  const row = (label: string, value?: string) =>
    value ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%">${escapeHtml(label)}</td><td style="padding:8px 12px;color:#1f2937;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>` : "";

  const constructionRows = data.propertyStatus === "off_plan" ? `
    ${row("Construction Budget ($)", data.constructionBudget)}
    ${row("Consultant Budget ($)", data.consultantBudget)}
    ${row("FF&E Budget ($)", data.ffeBudget)}
    ${row("Landscaping Budget ($)", data.landscapingBudget)}
    ${row("Overheads ($)", data.overheads)}
  ` : "";

  const submitterRows = (submitter.wixUserId || submitter.email || submitter.name) ? `
    ${row("Submitter name", submitter.name ?? "")}
    ${row("Submitter email", submitter.email ?? "")}
    ${row("Submitted by (Wix ID)", submitter.wixUserId ?? "")}
    ${row("Request ID", requestId)}
  ` : row("Request ID", requestId);

  const filesSection = files.length > 0 ? `
    <h2 style="font-size:16px;color:#111827;margin-top:24px;margin-bottom:8px">Attached Files (${files.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:8px">
      ${files.map((f) => `
        <tr>
          <td style="padding:8px 12px;color:#1f2937;border-bottom:1px solid #e5e7eb">${escapeHtml(f.name)}</td>
          <td style="padding:8px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb;width:90px">${escapeHtml(formatBytes(f.size))}</td>
          <td style="padding:8px 12px;color:#6b7280;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px">${escapeHtml(f.path)}</td>
        </tr>
      `).join("")}
    </table>
    <p style="color:#6b7280;font-size:12px;margin-top:8px">Files stored in private bucket <code>appraisals</code>. Retrieve via admin tools.</p>
  ` : "";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;padding:32px">
      <h1 style="font-size:22px;color:#111827;margin-bottom:4px">New Appraisal Request</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:24px">A new property appraisal has been submitted via REID.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;border-radius:8px">
        ${submitterRows}
        ${row("Property Type", data.propertyType)}
        ${row("Location", data.location)}
        ${row("Description", data.description)}
        ${row("Ownership Type", data.ownershipType)}
        ${row("Land Zone", data.landZone)}
        ${row("Lease Term (years)", data.leaseTerm)}
        ${row("Land Size (SQM)", data.landSize)}
        ${row("Internal Size (SQM)", data.internalSize)}
        ${row("Property Status", data.propertyStatus)}
        ${row("Bedrooms", data.bedrooms)}
        ${row("Bathrooms", data.bathrooms)}
        ${row("Year Built", data.yearBuilt)}
        ${row("Currently Operational", data.currentlyOperational)}
        ${row("Property Website", data.propertyWebsite)}
        ${row("Average Daily Rate ($)", data.averageDailyRate)}
        ${row("Average Occupancy (%)", data.averageOccupancy)}
        ${row("Years Operating", data.yearsOperating)}
        ${constructionRows}
      </table>
      ${filesSection}
      <p style="color:#6b7280;font-size:13px;margin-top:20px">View all requests at <a href="https://reidbase.lovable.app/admin/appraisals" style="color:#2563eb">reidbase.lovable.app/admin/appraisals</a></p>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px">This email was sent automatically from the REID platform.</p>
    </div>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a valid Wix bearer token. Anonymous submissions are not allowed.
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Sign in required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let submitterWixId: string;
    let submitterEmail: string | null;
    let submitterName: string | null;
    try {
      const ident = await verifyWixToken(authHeader);
      submitterWixId = ident.wixUserId;
      submitterEmail = ident.email ?? ident.loginEmail ?? null;
      submitterName = ident.displayName ?? null;
    } catch (err) {
      const status = err instanceof WixAuthError ? err.status : 401;
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Invalid or expired session" }),
        { status, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Appraisal requests are open to any signed-in user (auth already verified above).

    const rawBody = await req.json().catch(() => null);
    const parsed = sanitiseInput(rawBody);
    if (!parsed.ok) {
      const payload: Record<string, unknown> = { error: parsed.error };
      if (parsed.missing) payload.missing = parsed.missing;
      if (parsed.field) payload.field = parsed.field;
      return new Response(JSON.stringify(payload), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const data = parsed.data;

    // Validate requestId and attached files metadata
    const requestId = (rawBody as any)?.requestId;
    if (!isValidRequestId(requestId)) {
      return new Response(
        JSON.stringify({ error: "invalid_request_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const filesResult = validateFiles((rawBody as any)?.files, requestId);
    if (!filesResult.ok) {
      return new Response(
        JSON.stringify({ error: filesResult.error, field: filesResult.field }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const files = filesResult.files;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify each referenced storage object actually exists in the appraisals bucket
    // before persisting metadata or sending email. Guards against tampered paths.
    for (const f of files) {
      const lastSlash = f.path.lastIndexOf("/");
      const dir = f.path.slice(0, lastSlash);
      const filename = f.path.slice(lastSlash + 1);
      const { data: listed, error: listErr } = await supabase.storage
        .from("appraisals")
        .list(dir, { limit: 100, search: filename });
      if (listErr) {
        console.error("Storage list error:", listErr);
        return new Response(
          JSON.stringify({ error: "storage_verification_failed" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      const found = (listed ?? []).some((o) => o.name === filename);
      if (!found) {
        return new Response(
          JSON.stringify({ error: "file_not_found", field: f.name }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
    }

    const { error: dbError } = await supabase.from("appraisal_requests").insert({
      property_type: data.propertyType ?? null,
      location: data.location ?? null,
      description: data.description ?? null,
      ownership_type: data.ownershipType ?? null,
      land_zone: data.landZone ?? null,
      lease_term: data.leaseTerm ?? null,
      land_size: data.landSize ?? null,
      internal_size: data.internalSize ?? null,
      property_status: data.propertyStatus ?? null,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      year_built: data.yearBuilt ?? null,
      currently_operational: data.currentlyOperational ?? null,
      property_website: data.propertyWebsite ?? null,
      average_daily_rate: data.averageDailyRate ?? null,
      average_occupancy: data.averageOccupancy ?? null,
      years_operating: data.yearsOperating ?? null,
      construction_budget: data.constructionBudget ?? null,
      consultant_budget: data.consultantBudget ?? null,
      ffe_budget: data.ffeBudget ?? null,
      landscaping_budget: data.landscapingBudget ?? null,
      overheads: data.overheads ?? null,
      files: files,
      status: "new",
      wix_user_id: submitterWixId,
      wix_user_name: submitterName,
      wix_user_email: submitterEmail,
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
      return new Response(
        JSON.stringify({ error: "db_insert_failed", message: dbError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const emailResponse = await resend.emails.send({
      from: "REID Appraisals <appraisals@realinfo.id>",
      to: ["admin@realinfo.id"],
      subject: `New Appraisal Request – ${data.propertyType || "Property"} in ${data.location || "Unknown"}`,
      html: buildEmailHtml(data, { wixUserId: submitterWixId, email: submitterEmail, name: submitterName } as any, files, requestId),
    });

    console.log("Appraisal email sent for submitter:", submitterWixId ?? "anonymous");

    return new Response(JSON.stringify({ ok: true, id: (emailResponse as any)?.data?.id ?? null }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error processing appraisal:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: error?.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
