
-- 1. affiliates
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  commission_rate numeric(5,4) NOT NULL DEFAULT 0.15, -- 15%
  wix_coupon_code text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliates_service_only" ON public.affiliates FOR ALL
  USING (false) WITH CHECK (false);

CREATE INDEX idx_affiliates_slug ON public.affiliates(slug);
CREATE INDEX idx_affiliates_coupon ON public.affiliates(wix_coupon_code) WHERE wix_coupon_code IS NOT NULL;

-- 2. affiliate_clicks
CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  visitor_id text,            -- random id from localStorage
  wix_user_id text,           -- backfilled if/when the visitor signs in
  landing_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliate_clicks TO service_role;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate_clicks_service_only" ON public.affiliate_clicks FOR ALL
  USING (false) WITH CHECK (false);

CREATE INDEX idx_affiliate_clicks_affiliate ON public.affiliate_clicks(affiliate_id, created_at DESC);
CREATE INDEX idx_affiliate_clicks_visitor ON public.affiliate_clicks(visitor_id) WHERE visitor_id IS NOT NULL;
CREATE INDEX idx_affiliate_clicks_wix_user ON public.affiliate_clicks(wix_user_id) WHERE wix_user_id IS NOT NULL;

-- 3. affiliate_attributions (one active row per wix_user_id)
CREATE TABLE public.affiliate_attributions (
  wix_user_id text PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('click','coupon')),
  attributed_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  first_paid_at timestamptz,
  first_paid_tier text,
  wix_plan_names text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliate_attributions TO service_role;
ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate_attributions_service_only" ON public.affiliate_attributions FOR ALL
  USING (false) WITH CHECK (false);

CREATE INDEX idx_affiliate_attributions_affiliate ON public.affiliate_attributions(affiliate_id);
CREATE INDEX idx_affiliate_attributions_first_paid ON public.affiliate_attributions(first_paid_at) WHERE first_paid_at IS NOT NULL;

-- touch trigger reused
CREATE TRIGGER tg_affiliates_touch BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_entitlements_touch();
CREATE TRIGGER tg_affiliate_attributions_touch BEFORE UPDATE ON public.affiliate_attributions
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_entitlements_touch();
