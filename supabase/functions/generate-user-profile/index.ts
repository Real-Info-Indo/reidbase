import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AI_MODEL = "google/gemini-2-flash-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_CONVERSATION_LIMITS: Record<string, number> = {
  enterprise: 30,
  reid_base_pro: 15,
  reid_base: 5,
};

const PROFILE_GENERATION_PROMPT = `You are analysing a user's conversation history on REID, a Bali property market intelligence platform. Based on the conversations provided, generate a concise user profile summary that will help the AI personalise future responses.

The summary should capture:
- The user's apparent role or professional context (agent, investor, developer, etc.)
- Their primary location focus within Bali (which areas they ask about most)
- Their typical use pattern (which modes they use, what they are trying to achieve)
- Their apparent level of market knowledge (do they ask basic questions or sophisticated ones)
- Any recurring interests or themes (specific property types, yield focus, sales positioning, content creation, etc.)

Rules:
- Write in third person, present tense
- Maximum 150 words
- Be specific and factual -- only state what the conversation history actually supports
- Do not invent or infer beyond what is present in the data
- Do not include any specific property addresses, prices, or personal details
- If there is insufficient data to form a meaningful profile, return exactly: "Insufficient conversation history to generate profile."

Output only the profile summary text. No headings, no labels, no preamble.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Admin-only endpoint — must be called from a cron job or admin tooling.
  // Verify the shared admin secret so arbitrary callers cannot trigger a
  // full batch AI profile generation run across all Team/Enterprise users.
  const adminSecret = Deno.env.get("ADMIN_SECRET");
  const presented = req.headers.get("x-admin-secret") ?? "";
  if (!adminSecret || presented !== adminSecret) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find users with recent chat activity but stale or missing ai_summary
    // Only process users on Team or Enterprise tiers -- Member gets conversation
    // history only, no AI summary generation needed
    const { data: usersToProcess, error: usersError } = await supabase
      .from("user_profiles")
      .select("wix_user_id, nickname, display_name, occupation, business, about, tier, ai_summary, updated_at")
      .in("tier", ["reid_base_pro", "enterprise"]);

    if (usersError || !usersToProcess || usersToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No users to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { wix_user_id: string; status: string }[] = [];

    for (const user of usersToProcess) {
      try {
        const conversationLimit = TIER_CONVERSATION_LIMITS[user.tier] || 5;

        // Check if there are new conversations since last profile update
        const { data: recentChats, error: chatsError } = await supabase
          .from("chat_logs")
          .select("title, search_mode, messages, updated_at")
          .eq("wix_user_id", user.wix_user_id)
          .order("updated_at", { ascending: false })
          .limit(conversationLimit);

        if (chatsError || !recentChats || recentChats.length === 0) {
          results.push({ wix_user_id: user.wix_user_id, status: "skipped -- no conversations" });
          continue;
        }

        // Check if most recent conversation is newer than last profile update
        const mostRecentChat = recentChats[0];
        if (user.ai_summary && user.updated_at &&
            mostRecentChat.updated_at <= user.updated_at) {
          results.push({ wix_user_id: user.wix_user_id, status: "skipped -- profile up to date" });
          continue;
        }

        // Build conversation context for the AI
        const conversationContext = recentChats.map((c: any) => {
          const msgs = Array.isArray(c.messages) ? c.messages : [];
          const userMsgs = msgs.filter((m: any) => m.role === "user");
          const assistantMsgs = msgs.filter((m: any) => m.role === "assistant");
          const queries = userMsgs.map((m: any) => m.content?.slice(0, 200)).filter(Boolean).join(" | ");
          const lastResponse = assistantMsgs[assistantMsgs.length - 1]?.content?.slice(0, 200) || "";
          return `Conversation: "${c.title}" (mode: ${c.search_mode || "data-analyst"})\nUser queries: ${queries}\nAI response summary: ${lastResponse}`;
        }).join("\n\n");

        // Build personalisation context
        const personalisationContext = [
          user.nickname ? `Name: ${user.nickname}` : user.display_name ? `Name: ${user.display_name}` : null,
          user.occupation ? `Occupation: ${user.occupation}` : null,
          user.business ? `Business: ${user.business}` : null,
          user.about ? `About: ${user.about}` : null,
        ].filter(Boolean).join("\n");

        const userContext = [
          personalisationContext ? `USER PROVIDED INFO:\n${personalisationContext}` : null,
          `CONVERSATION HISTORY (${recentChats.length} most recent conversations):\n${conversationContext}`,
        ].filter(Boolean).join("\n\n");

        // Generate AI summary
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: "system", content: PROFILE_GENERATION_PROMPT },
              { role: "user", content: userContext },
            ],
          }),
        });

        if (!aiResponse.ok) {
          results.push({ wix_user_id: user.wix_user_id, status: `failed -- AI error ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const summary = aiData.choices?.[0]?.message?.content?.trim();

        if (!summary || summary === "Insufficient conversation history to generate profile.") {
          results.push({ wix_user_id: user.wix_user_id, status: "skipped -- insufficient data" });
          continue;
        }

        // Write summary back to user_profiles
        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({ ai_summary: summary, updated_at: new Date().toISOString() })
          .eq("wix_user_id", user.wix_user_id);

        if (updateError) {
          results.push({ wix_user_id: user.wix_user_id, status: `failed -- db error` });
          continue;
        }

        results.push({ wix_user_id: user.wix_user_id, status: "updated" });

      } catch (err) {
        results.push({ wix_user_id: user.wix_user_id, status: `error -- ${err instanceof Error ? err.message : "unknown"}` });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-user-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
