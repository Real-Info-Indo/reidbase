-- Idempotent: ensure files column exists on appraisal_requests
ALTER TABLE public.appraisal_requests
  ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Idempotent: ensure private appraisals bucket exists with size + mime restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'appraisals',
  'appraisals',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];