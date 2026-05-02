-- Drop the permissive anon INSERT policy on shared_conversations.
-- All inserts go through the `user-data` edge function which uses the
-- service-role key — no direct anon write access is needed.
-- The SELECT policy is intentionally kept: shared conversations must be
-- publicly readable by anyone with the share link.

DROP POLICY IF EXISTS "Shared conversations insertable by anyone" ON public.shared_conversations;
