-- ============================================================================
-- PHASE 1: SECURITY OVERHAUL — ADDITIVE
-- This migration adds new tables, helpers, and storage. It DOES NOT remove
-- the existing permissive RLS policies on private tables. Those will be
-- revoked in a Phase 2 migration after the frontend has been migrated to
-- call edge functions instead of reading Supabase directly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tier value migration: 'member' (legacy unpaid) -> 'free'
-- ---------------------------------------------------------------------------

UPDATE public.user_profiles
SET tier = 'free'
WHERE tier = 'member' OR tier = 'freemium' OR tier IS NULL;

UPDATE public.chat_logs
SET user_tier = 'free'
WHERE user_tier = 'member' OR user_tier = 'freemium' OR user_tier IS NULL;

ALTER TABLE public.chat_logs
  ALTER COLUMN user_tier SET DEFAULT 'free';

-- ---------------------------------------------------------------------------
-- 2. admin_users table (Wix user IDs with admin access)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_user_id TEXT NOT NULL UNIQUE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated -> only service role can access.

CREATE OR REPLACE FUNCTION public.has_admin(_wix_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE wix_user_id = _wix_user_id
  )
$$;

-- ---------------------------------------------------------------------------
-- 3. user_entitlements table (server-maintained tier per Wix user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  wix_user_id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'reid_base', 'reid_base_pro', 'enterprise')),
  wix_plan_names TEXT[] DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'wix' CHECK (source IN ('wix', 'manual', 'fallback')),
  refreshed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_entitlements_refreshed_at_idx
  ON public.user_entitlements (refreshed_at DESC);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated -> only service role can access.

-- Auto-update updated_at on row update
CREATE OR REPLACE FUNCTION public.tg_user_entitlements_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_entitlements_touch ON public.user_entitlements;
CREATE TRIGGER user_entitlements_touch
  BEFORE UPDATE ON public.user_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_user_entitlements_touch();

-- ---------------------------------------------------------------------------
-- 4. report_downloads audit table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wix_user_id TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('market', 'location')),
  report_key TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  user_tier TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_downloads_user_idx
  ON public.report_downloads (wix_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS report_downloads_report_idx
  ON public.report_downloads (report_type, report_key, created_at DESC);

ALTER TABLE public.report_downloads ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated -> only service role can access.

-- ---------------------------------------------------------------------------
-- 5. Private storage bucket for gated reports
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- No SELECT/INSERT/UPDATE/DELETE policies on storage.objects for the
-- 'reports' bucket -> only the service role can read/write objects.
-- Clients receive short-lived signed URLs from the download-report function.

-- ---------------------------------------------------------------------------
-- 6. PHASE 2 TODO (do NOT execute in this migration)
-- ---------------------------------------------------------------------------
-- After the frontend is fully migrated to call the new edge functions, a
-- follow-up migration must:
--   * DROP every "USING (true)" / "WITH CHECK (true)" policy on:
--       chat_logs, folders, user_profiles, chat_feedback, user_sessions,
--       chat_flags, appraisal_requests, analytics_events, shared_conversations
--   * Replace them with no-anon/no-authenticated policies (service role only),
--     OR with owner-scoped policies if Wix identity becomes RLS-checkable.
--   * Keep properties_2025 and rentals_2025 publicly readable (intentional).
-- ---------------------------------------------------------------------------