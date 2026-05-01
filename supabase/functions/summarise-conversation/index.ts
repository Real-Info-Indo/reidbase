import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_MODEL = "google/gemini-3-flash-preview";

const SUMMARY_SYSTEM_PROMPT = `You summarise a Bali property market intelligence conversation between a user and the REID assistant.

Produce a concise British English summary (3 to 5 sentences, max 600 characters) that captures:
- The user's working topic or project (e.g. "evaluating a 2-bedroom leasehold villa in Pererenan").
- Specific locations, property types, tenure, bedrooms, build/land sizes, prices, occupancy, ADR or yield figures discussed.
- Decisions, conclusions, or open questions left at the end of the conversation.

Rules:
- British English. No em dashes. No emojis. No filler.
- Use REID terminology: occupancy, ADR, yield, leasehold, freehold, off-plan, micro-location.
- USD and SQM. Preserve specific numbers exactly as they appeared.
- Do NOT invent details that were not in the conversation.
- Output plain prose only. No headings, no bullets, no markdown.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal-only function. Must be called from another Edge Function
  // (currently `user-data`) which has already verified the caller's Wix
  // identity and confirmed they own the conversation. Public callers
  // (anon Wix users) cannot invoke this directly.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") || serviceRoleKey;
  const presented = req.headers.get("x-internal-token") || "";
  if (!presented || presented !== internalToken) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { conversationId, force } = await req.json();
    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversationId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: log, error } = await supabase
      .from("chat_logs")
      .select("messages, message_count, summary, summary_message_count, folder_id")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (error || !log) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if not in a folder (folder memory only)
    if (!log.folder_id && !force) {
      return new Response(JSON.stringify({ skipped: "not in folder" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = Array.isArray(log.messages) ? log.messages : [];
    if (messages.length < 2) {
      return new Response(JSON.stringify({ skipped: "too few messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh threshold: only regenerate if 4+ new messages since last summary
    const lastCount = log.summary_message_count || 0;
    if (!force && log.summary && messages.length - lastCount < 4) {
      return new Response(JSON.stringify({ skipped: "summary fresh", summary: log.summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compose conversation transcript (cap at last ~30 messages, ~12k chars)
    const recent = messages.slice(-30);
    const transcript = recent
      .map((m: any) => `${m.role === "user" ? "USER" : "REID"}: ${String(m.content || "").slice(0, 1500)}`)
      .join("\n\n")
      .slice(0, 12000);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: `Summarise this conversation:\n\n${transcript}` },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      console.error("Summary AI error", status, await aiResp.text().catch(() => ""));
      return new Response(JSON.stringify({ error: `AI gateway error ${status}` }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const summary = (data.choices?.[0]?.message?.content || "").trim();
    if (!summary) {
      return new Response(JSON.stringify({ error: "Empty summary" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("chat_logs")
      .update({
        summary,
        summary_updated_at: new Date().toISOString(),
        summary_message_count: messages.length,
      })
      .eq("conversation_id", conversationId);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarise-conversation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
