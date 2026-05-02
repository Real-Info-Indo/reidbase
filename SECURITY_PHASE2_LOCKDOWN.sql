-- =============================================================================
-- Phase 2 RLS Lockdown — DRAFT, NOT APPLIED
-- =============================================================================
-- This file is intentionally OUTSIDE supabase/migrations/ so it will NOT be
-- auto-applied. After review, move (or copy) the contents into a new
-- timestamped file under supabase/migrations/ to execute.
--
-- Effect: drops all permissive USING (true) / WITH CHECK (true) policies on
-- the 9 still-exposed tables. RLS remains ENABLED on every table. Service
-- role (Edge Functions) bypasses RLS so the new function-mediated paths
-- continue to work.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- analytics_events — keep public INSERT, drop SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Analytics events readable by anyone"  ON public.analytics_events;
-- KEEP: "Analytics events insertable by anyone" (write-only beacon)

-- ---------------------------------------------------------------------------
-- appraisal_requests — drop all public policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Appraisal requests insertable by anyone" ON public.appraisal_requests;
DROP POLICY IF EXISTS "Appraisal requests readable by anyone"   ON public.appraisal_requests;
DROP POLICY IF EXISTS "Appraisal requests updatable by anyone"  ON public.appraisal_requests;

-- ---------------------------------------------------------------------------
-- chat_feedback — keep public INSERT, drop SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read feedback" ON public.chat_feedback;
-- KEEP: "Anyone can insert feedback"

-- ---------------------------------------------------------------------------
-- chat_flags — drop all public policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Chat flags insertable by anyone" ON public.chat_flags;
DROP POLICY IF EXISTS "Chat flags readable by anyone"   ON public.chat_flags;
DROP POLICY IF EXISTS "Chat flags updatable by anyone"  ON public.chat_flags;

-- ---------------------------------------------------------------------------
-- chat_logs — drop all public policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Chat logs are insertable by anyone" ON public.chat_logs;
DROP POLICY IF EXISTS "Chat logs are readable by anyone"   ON public.chat_logs;
DROP POLICY IF EXISTS "Chat logs are updatable by anyone"  ON public.chat_logs;
DROP POLICY IF EXISTS "Chat logs are deletable by anyone"  ON public.chat_logs;

-- ---------------------------------------------------------------------------
-- folders — drop all public policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Folders insertable by anyone" ON public.folders;
DROP POLICY IF EXISTS "Folders readable by anyone"   ON public.folders;
DROP POLICY IF EXISTS "Folders updatable by anyone"  ON public.folders;
DROP POLICY IF EXISTS "Folders deletable by anyone"  ON public.folders;

-- ---------------------------------------------------------------------------
-- shared_conversations — drop all public policies
-- (public reads now go through the `shared-conversation` Edge Function)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Shared conversations insertable by anyone" ON public.shared_conversations;
DROP POLICY IF EXISTS "Shared conversations readable by anyone"   ON public.shared_conversations;

-- ---------------------------------------------------------------------------
-- user_profiles — drop all public policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "User profiles insertable by anyone" ON public.user_profiles;
DROP POLICY IF EXISTS "User profiles readable by anyone"   ON public.user_profiles;
DROP POLICY IF EXISTS "User profiles updatable by anyone"  ON public.user_profiles;

-- ---------------------------------------------------------------------------
-- user_sessions — drop all public policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Sessions insertable by anyone" ON public.user_sessions;
DROP POLICY IF EXISTS "Sessions readable by anyone"   ON public.user_sessions;
DROP POLICY IF EXISTS "Sessions updatable by anyone"  ON public.user_sessions;
DROP POLICY IF EXISTS "Sessions deletable by anyone"  ON public.user_sessions;

-- ---------------------------------------------------------------------------
-- Re-assert RLS is enabled (defensive; should already be true)
-- ---------------------------------------------------------------------------
ALTER TABLE public.analytics_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appraisal_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_feedback        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_flags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions        ENABLE ROW LEVEL SECURITY;
