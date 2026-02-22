import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, rows } = await req.json();

    if (action === "create_table") {
      // Create the rentals table if it doesn't exist
      const { error } = await supabase.rpc("execute_readonly_query", {
        query_text: "SELECT 1 FROM information_schema.tables WHERE table_name = 'rentals_2025' AND table_schema = 'public'"
      });

      // Use raw SQL via the REST API to create the table
      const createSQL = `
        CREATE TABLE IF NOT EXISTS public.rentals_2025 (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          date TEXT,
          region TEXT,
          location TEXT,
          type TEXT,
          mgmt TEXT,
          beds NUMERIC,
          count NUMERIC,
          occupancy NUMERIC,
          rate_idr NUMERIC,
          rate_usd NUMERIC,
          monthly_idr NUMERIC,
          monthly_usd NUMERIC,
          total_revenue NUMERIC
        );
        ALTER TABLE public.rentals_2025 ENABLE ROW LEVEL SECURITY;
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'rentals_2025' AND policyname = 'Rentals are publicly readable'
          ) THEN
            CREATE POLICY "Rentals are publicly readable" ON public.rentals_2025 FOR SELECT USING (true);
          END IF;
        END $$;
      `;

      // Execute via pg REST endpoint
      const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
      const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
      const sql = postgres(dbUrl);
      await sql.unsafe(createSQL);
      await sql.end();

      return new Response(JSON.stringify({ success: true, message: "Table created" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "insert") {
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return new Response(JSON.stringify({ error: "No rows provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
      const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
      const sql = postgres(dbUrl);

      // Insert in batches
      const batchSize = 500;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await sql`INSERT INTO public.rentals_2025 ${sql(batch, 'date', 'region', 'location', 'type', 'mgmt', 'beds', 'count', 'occupancy', 'rate_idr', 'rate_usd', 'monthly_idr', 'monthly_usd', 'total_revenue')}`;
        inserted += batch.length;
      }

      await sql.end();

      return new Response(JSON.stringify({ success: true, inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Import rentals error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
