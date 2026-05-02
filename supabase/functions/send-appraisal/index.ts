import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyWixToken } from "../_shared/wix-auth.ts";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitiseInput(raw: any): { ok: true; data: AppraisalData } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_body" };
  const out: AppraisalData = {};
  for (const key of Object.keys(FIELD_LIMITS) as (keyof AppraisalData)[]) {
    const v = (raw as any)[key];
    if (v == null || v === "") continue;
    if (typeof v !== "string") return { ok: false, error: `invalid_field:${key}` };
    if (v.length > FIELD_LIMITS[key]) return { ok: false, error: `field_too_long:${key}` };
    out[key] = v;
  }
  if (!out.propertyType && !out.location) {
    return { ok: false, error: "missing_required_fields" };
  }
  return { ok: true, data: out };
}

function buildEmailHtml(data: AppraisalData, submitter: { wixUserId: string | null; email: string | null }): string {
  const row = (label: string, value?: string) =>
    value ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%">${escapeHtml(label)}</td><td style="padding:8px 12px;color:#1f2937;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>` : "";

  const constructionRows = data.propertyStatus === "off_plan" ? `
    ${row("Construction Budget ($)", data.constructionBudget)}
    ${row("Consultant Budget ($)", data.consultantBudget)}
    ${row("FF&E Budget ($)", data.ffeBudget)}
    ${row("Landscaping Budget ($)", data.landscapingBudget)}
    ${row("Overheads ($)", data.overheads)}
  ` : "";

  const submitterRows = (submitter.wixUserId || submitter.email) ? `
    ${row("Submitted by (Wix ID)", submitter.wixUserId ?? "")}
    ${row("Submitter email", submitter.email ?? "")}
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
    const rawBody = await req.json().catch(() => null);
    const parsed = sanitiseInput(rawBody);
    if (!parsed.ok) {
      return new Response(JSON.stringify({ error: parsed.error }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const data = parsed.data;

    // Best-effort identify the submitter via Wix bearer token. Anonymous
    // submissions remain allowed (the page may be embedded), but we never
    // trust client-supplied wix_user_id / email.
    let submitterWixId: string | null = null;
    let submitterEmail: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const ident = await verifyWixToken(authHeader);
        submitterWixId = ident.wixUserId;
        submitterEmail = ident.email ?? ident.loginEmail ?? null;
      } catch (_) {
        // Ignore — treat as anonymous submission.
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
      status: "new",
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
    }

    const emailResponse = await resend.emails.send({
      from: "REID Appraisals <appraisals@realinfo.id>",
      to: ["admin@realinfo.id"],
      subject: `New Appraisal Request – ${data.propertyType || "Property"} in ${data.location || "Unknown"}`,
      html: buildEmailHtml(data, { wixUserId: submitterWixId, email: submitterEmail }),
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
