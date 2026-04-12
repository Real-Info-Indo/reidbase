import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface FlagResult {
  flagged: boolean;
  category: string;
  severity: string;
  details: string;
}

const PATTERNS: { regex: RegExp; category: string; severity: string; details: string }[] = [
  // Database access attempts
  { regex: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b/i, category: "database_access", severity: "high", details: "User attempted to write or reference SQL commands directly." },
  { regex: /\b(schema|pg_catalog|information_schema|pg_tables|auth\.users|service_role|supabase)\b/i, category: "database_access", severity: "high", details: "User referenced internal database objects or service credentials." },
  { regex: /\bexecute_readonly_query\b/i, category: "database_access", severity: "high", details: "User attempted to invoke the database query function directly." },

  // Data falsification
  { regex: /\b(change|alter|modify|update|replace|set)\b.{0,30}\b(data|numbers|figures|prices?|values?|statistics?|results?)\b/i, category: "data_falsification", severity: "high", details: "User requested altering or falsifying data outputs." },
  { regex: /\b(fake|fabricate|falsify|invent|make\s*up)\b.{0,30}\b(data|numbers|figures|statistics?|results?)\b/i, category: "data_falsification", severity: "high", details: "User explicitly asked the AI to fabricate data." },
  { regex: /\b(pretend|assume|act\s*as\s*if)\b.{0,30}\b(data|numbers?|prices?|market)\b/i, category: "data_falsification", severity: "medium", details: "User asked AI to pretend data is different from actual values." },

  // AI manipulation / jailbreak
  { regex: /\b(ignore|forget|disregard|override|bypass)\b.{0,30}\b(instructions?|rules?|guidelines?|restrictions?|system\s*prompt|previous)\b/i, category: "manipulation", severity: "high", details: "User attempted to override AI system instructions." },
  { regex: /\b(you\s*are\s*now|act\s*as|pretend\s*to\s*be|new\s*persona|roleplay\s*as)\b/i, category: "manipulation", severity: "medium", details: "User attempted to change the AI persona or role." },
  { regex: /\b(DAN|do\s*anything\s*now|jailbreak|prompt\s*injection|system\s*prompt)\b/i, category: "manipulation", severity: "high", details: "User attempted a known jailbreak technique." },
  { regex: /\brepeat\b.{0,20}\b(system|instructions|prompt|rules)\b/i, category: "manipulation", severity: "medium", details: "User asked AI to reveal system prompt or instructions." },

  // Untrustworthy behaviour
  { regex: /\b(hack|exploit|vulnerabilit|penetration\s*test|injection)\b/i, category: "untrustworthy", severity: "medium", details: "User referenced hacking or exploitation terminology." },
  { regex: /\b(scrape|extract|dump|export)\b.{0,30}\b(all|entire|full|complete|database|dataset)\b/i, category: "untrustworthy", severity: "high", details: "User attempted bulk data extraction." },
  { regex: /\b(api\s*key|secret\s*key|password|credentials?|token)\b/i, category: "untrustworthy", severity: "medium", details: "User asked about API keys or credentials." },
];

export function checkMessage(message: string): FlagResult | null {
  for (const pattern of PATTERNS) {
    if (pattern.regex.test(message)) {
      return {
        flagged: true,
        category: pattern.category,
        severity: pattern.severity,
        details: pattern.details,
      };
    }
  }
  return null;
}

export async function logFlag(opts: {
  conversationId: string;
  wixUserId?: string;
  wixUserName?: string;
  wixUserEmail?: string;
  message: string;
  category: string;
  severity: string;
  details: string;
}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.from("chat_flags").insert({
    conversation_id: opts.conversationId,
    wix_user_id: opts.wixUserId || null,
    wix_user_name: opts.wixUserName || null,
    wix_user_email: opts.wixUserEmail || null,
    flagged_message: opts.message,
    category: opts.category,
    severity: opts.severity,
    details: opts.details,
  });

  if (error) {
    console.error("Failed to log chat flag:", error.message);
    return;
  }

  // Send email alert for high severity
  if (opts.severity === "high") {
    try {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (RESEND_API_KEY && LOVABLE_API_KEY) {
        await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "REID Alerts <alerts@realinfo.id>",
            to: ["admin@realinfo.id"],
            subject: `[REID Alert] ${opts.category.replace(/_/g, " ")} — ${opts.severity} severity`,
            html: `
              <h2>Chat Flag Alert</h2>
              <p><strong>Category:</strong> ${opts.category.replace(/_/g, " ")}</p>
              <p><strong>Severity:</strong> ${opts.severity}</p>
              <p><strong>User:</strong> ${opts.wixUserName || "Unknown"} (${opts.wixUserEmail || "no email"})</p>
              <p><strong>Details:</strong> ${opts.details}</p>
              <p><strong>Message:</strong></p>
              <blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">${opts.message.substring(0, 500)}</blockquote>
              <p><a href="https://reidbase.lovable.app/admin/alerts">View all alerts</a></p>
            `,
          }),
        });
      }
    } catch (emailErr) {
      console.error("Alert email failed:", emailErr);
    }
  }
}

/** Run moderation check on the latest user message, log if flagged. Non-blocking. */
export function moderateMessage(
  message: string,
  context: {
    conversationId: string;
    wixUserId?: string;
    wixUserName?: string;
    wixUserEmail?: string;
  }
) {
  const result = checkMessage(message);
  if (result) {
    // Fire-and-forget so it doesn't block the chat response
    logFlag({
      conversationId: context.conversationId,
      wixUserId: context.wixUserId,
      wixUserName: context.wixUserName,
      wixUserEmail: context.wixUserEmail,
      message,
      category: result.category,
      severity: result.severity,
      details: result.details,
    }).catch((e) => console.error("Moderation log error:", e));
  }
}
