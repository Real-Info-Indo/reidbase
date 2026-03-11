import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">This email was sent automatically from the REID platform.</p>
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
    console.error("Error sending appraisal email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
