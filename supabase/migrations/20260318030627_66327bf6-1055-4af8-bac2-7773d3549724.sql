
CREATE TABLE public.appraisal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_type text,
  location text,
  description text,
  ownership_type text,
  land_zone text,
  lease_term text,
  land_size text,
  internal_size text,
  property_status text,
  bedrooms text,
  bathrooms text,
  year_built text,
  currently_operational text,
  property_website text,
  average_daily_rate text,
  average_occupancy text,
  years_operating text,
  construction_budget text,
  consultant_budget text,
  ffe_budget text,
  landscaping_budget text,
  overheads text,
  status text NOT NULL DEFAULT 'new',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appraisal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appraisal requests insertable by anyone"
  ON public.appraisal_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Appraisal requests readable by anyone"
  ON public.appraisal_requests FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Appraisal requests updatable by anyone"
  ON public.appraisal_requests FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_appraisal_requests_status ON public.appraisal_requests (status);
CREATE INDEX idx_appraisal_requests_created ON public.appraisal_requests (created_at);
