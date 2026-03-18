import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AppraisalData {
  propertyType: string;
  location: string;
  description: string;
  ownershipType: string;
  landZone: string;
  leaseTerm: string;
  landSize: string;
  internalSize: string;
  propertyStatus: string;
  bedrooms: string;
  bathrooms: string;
  yearBuilt: string;
  currentlyOperational: string;
  propertyWebsite: string;
  averageDailyRate: string;
  averageOccupancy: string;
  yearsOperating: string;
  constructionBudget?: string;
  consultantBudget?: string;
  ffeBudget?: string;
  landscapingBudget?: string;
  overheads?: string;
}

function buildEmailHtml(data: AppraisalData): string {
  const row = (label: string, value: string) =>
    value ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;width:40%">${label}</td><td style="padding:8px 12px;color:#1f2937;border-bottom:1px solid #e5e7eb">${value}</td></tr>` : "";

  const constructionRows = data.propertyStatus === "off_plan" ? `
    ${row("Construction Budget ($)", data.constructionBudget || "")}
    ${row("Consultant Budget ($)", data.consultantBudget || "")}
    ${row("FF&E Budget ($)", data.ffeBudget || "")}
    ${row("Landscaping Budget ($)", data.landscapingBudget || "")}
    ${row("Overheads ($)", data.overheads || "")}
  ` : "";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;padding:32px">
      <h1 style="font-size:22px;color:#111827;margin-bottom:4px">New Appraisal Request</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:24px">A new property appraisal has been submitted via REID.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;border-radius:8px">
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
    const data: AppraisalData = await req.json();

    if (!data.propertyType && !data.location) {
      throw new Error("Missing required fields");
    }

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase.from("appraisal_requests").insert({
      property_type: data.propertyType || null,
      location: data.location || null,
      description: data.description || null,
      ownership_type: data.ownershipType || null,
      land_zone: data.landZone || null,
      lease_term: data.leaseTerm || null,
      land_size: data.landSize || null,
      internal_size: data.internalSize || null,
      property_status: data.propertyStatus || null,
      bedrooms: data.bedrooms || null,
      bathrooms: data.bathrooms || null,
      year_built: data.yearBuilt || null,
      currently_operational: data.currentlyOperational || null,
      property_website: data.propertyWebsite || null,
      average_daily_rate: data.averageDailyRate || null,
      average_occupancy: data.averageOccupancy || null,
      years_operating: data.yearsOperating || null,
      construction_budget: data.constructionBudget || null,
      consultant_budget: data.consultantBudget || null,
      ffe_budget: data.ffeBudget || null,
      landscaping_budget: data.landscapingBudget || null,
      overheads: data.overheads || null,
      status: "new",
    });

    if (dbError) {
      console.error("DB insert error:", dbError);
    }

    // Send email notification
    const emailResponse = await resend.emails.send({
      from: "REID Appraisals <appraisals@realinfo.id>",
      to: ["admin@realinfo.id"],
      subject: `New Appraisal Request – ${data.propertyType || "Property"} in ${data.location || "Unknown"}`,
      html: buildEmailHtml(data),
    });

    console.log("Appraisal email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error processing appraisal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
