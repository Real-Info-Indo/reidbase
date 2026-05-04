ALTER TABLE public.appraisal_requests
  ADD COLUMN IF NOT EXISTS wix_user_id text,
  ADD COLUMN IF NOT EXISTS wix_user_name text,
  ADD COLUMN IF NOT EXISTS wix_user_email text;