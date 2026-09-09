-- Percentage-change helper: null-safe YoY change rounded to 1 decimal
create or replace function public.reid_yoy(cur numeric, prior numeric)
returns numeric
language sql
immutable
as $$
  select case
           when cur is null or prior is null or prior = 0 then null
           else round(100.0 * (cur - prior) / prior, 1)
         end
$$;

create or replace function public.reid_dashboard_metrics(p_module text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  res jsonb;
  win_from date;
  prior_filters jsonb;
BEGIN
  -- Default trailing 12-month window for time series
  SELECT coalesce(nullif(p_filters->>'date_from','')::date,
                  (SELECT max(public.reid_month(coalesce(sold_date, scrape_date))) FROM public.reid_properties) - interval '11 months')
    INTO win_from;

  -- Prior period: the 12 months immediately before the start date
  prior_filters := p_filters || jsonb_build_object(
    'date_from', to_char((win_from - interval '12 months')::date, 'YYYY-MM-DD'),
    'date_to',   to_char((win_from - interval '1 day')::date, 'YYYY-MM-DD'));

  IF p_module = 'market-overview' THEN
    WITH p AS MATERIALIZED (SELECT *, public.reid_month(sold_date) sold_mth FROM public.reid_filtered_properties(p_filters)),
    r AS MATERIALIZED (SELECT * FROM public.reid_filtered_rentals(p_filters)),
    r_latest AS MATERIALIZED (SELECT max(public.reid_month(date)) m FROM r),
    max_sold AS MATERIALIZED (SELECT max(sold_mth) m FROM p),
    months AS MATERIALIZED (SELECT generate_series(win_from, (SELECT m FROM max_sold), '1 month'::interval)::date m),
    sold_rolling AS MATERIALIZED (
      SELECT mo.m, percentile_cont(0.5) WITHIN GROUP (ORDER BY s.price_usd) v
      FROM months mo
      JOIN (SELECT price_usd, sold_mth FROM p WHERE availability = 'Sold' AND price_usd IS NOT NULL) s
        ON s.sold_mth BETWEEN mo.m - interval '11 months' AND mo.m
      GROUP BY mo.m
    ),
    cur AS MATERIALIZED (SELECT jsonb_build_object(
        'available_properties', (SELECT count(*) FROM p WHERE availability = 'Available'),
        'median_sold_price',    (SELECT v FROM sold_rolling WHERE m = (SELECT m FROM max_sold)),
        'clearance_rate',       (SELECT CASE WHEN sold_in_period + available_total = 0 THEN NULL ELSE 100.0 * sold_in_period / (sold_in_period + available_total) END
                                 FROM (SELECT
                                        count(*) FILTER (WHERE availability = 'Sold' AND public.reid_month(coalesce(sold_date, scrape_date)) >= win_from) AS sold_in_period,
                                        count(*) FILTER (WHERE availability = 'Available') AS available_total
                                       FROM p) x),
        'rental_records',       (SELECT coalesce(sum(count), 0) FROM r WHERE public.reid_month(date) = (SELECT m FROM r_latest))
      ) k),
    pp AS MATERIALIZED (SELECT * FROM public.reid_filtered_properties(prior_filters)),
    rr AS MATERIALIZED (SELECT * FROM public.reid_filtered_rentals(prior_filters)),
    rr_latest AS MATERIALIZED (SELECT max(public.reid_month(date)) m FROM rr),
    yoy AS MATERIALIZED (SELECT jsonb_build_object(
        'median_sold_price', public.reid_yoy((SELECT k->>'median_sold_price' FROM cur)::numeric,
                              (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FROM pp WHERE availability = 'Sold' AND price_usd IS NOT NULL)),
        'clearance_rate',    public.reid_yoy((SELECT k->>'clearance_rate' FROM cur)::numeric,
                              (SELECT CASE WHEN sold_p + avail = 0 THEN NULL ELSE 100.0 * sold_p / (sold_p + avail) END
                               FROM (SELECT count(*) FILTER (WHERE availability = 'Sold') sold_p FROM pp) s,
                                    (SELECT count(*) FILTER (WHERE availability = 'Available') avail FROM p) a)),
        'rental_records',    public.reid_yoy((SELECT k->>'rental_records' FROM cur)::numeric,
                              (SELECT coalesce(sum(count), 0) FROM rr WHERE public.reid_month(date) = (SELECT m FROM rr_latest)))
      ) y)
    SELECT jsonb_build_object(
      'kpis', (SELECT k FROM cur),
      'kpis_yoy', (SELECT y FROM yoy),
      'ownership', (SELECT jsonb_agg(jsonb_build_object('name', contract_type, 'value', c) ORDER BY c DESC)
                    FROM (SELECT contract_type, count(*) c FROM p WHERE contract_type IS NOT NULL GROUP BY 1) x),
      'sold_price_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM sold_rolling WHERE m IS NOT NULL),
      'rental_supply_by_beds', (SELECT jsonb_agg(jsonb_build_object('beds', beds, 'value', v) ORDER BY beds)
                    FROM (SELECT beds, sum(count) v FROM r WHERE public.reid_month(date) = (SELECT m FROM r_latest) AND beds BETWEEN 1 AND 6 GROUP BY 1) x),
      'available_by_beds', (SELECT jsonb_agg(jsonb_build_object('beds', b, 'leasehold', lh, 'freehold', fh) ORDER BY b)
                    FROM (SELECT bedrooms::int b,
                                 count(*) FILTER (WHERE contract_type = 'Leasehold') lh,
                                 count(*) FILTER (WHERE contract_type = 'Freehold') fh
                          FROM p WHERE availability = 'Available' AND bedrooms BETWEEN 1 AND 6 GROUP BY 1) x)
    ) INTO res;

  ELSIF p_module = 'supply-trends' THEN
    WITH p AS MATERIALIZED (SELECT * FROM public.reid_filtered_properties(p_filters)),
    mx AS MATERIALIZED (SELECT max(public.reid_month(scrape_date)) m FROM p),
    cur AS MATERIALIZED (SELECT jsonb_build_object(
        'available_properties', (SELECT count(*) FROM p WHERE availability = 'Available'),
        'median_listing_price', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FROM p WHERE availability = 'Available' AND price_usd IS NOT NULL),
        'clearance_rate',       (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE availability = 'Sold') / count(*) END FROM p),
        'new_listings',         (SELECT count(*) FROM p WHERE availability = 'Available' AND public.reid_month(scrape_date) = (SELECT m FROM mx))
      ) k),
    pp AS MATERIALIZED (SELECT * FROM public.reid_filtered_properties(prior_filters)),
    mxp AS MATERIALIZED (SELECT max(public.reid_month(scrape_date)) m FROM pp),
    yoy AS MATERIALIZED (SELECT jsonb_build_object(
        'median_listing_price', public.reid_yoy((SELECT k->>'median_listing_price' FROM cur)::numeric,
                                 (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FROM pp WHERE availability = 'Available' AND price_usd IS NOT NULL)),
        'clearance_rate',       public.reid_yoy((SELECT k->>'clearance_rate' FROM cur)::numeric,
                                 (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE availability = 'Sold') / count(*) END FROM pp)),
        'new_listings',         public.reid_yoy((SELECT k->>'new_listings' FROM cur)::numeric,
                                 (SELECT count(*) FROM pp WHERE availability = 'Available' AND public.reid_month(scrape_date) = (SELECT m FROM mxp)))
      ) y)
    SELECT jsonb_build_object(
      'kpis', (SELECT k FROM cur),
      'kpis_yoy', (SELECT y FROM yoy),
      'available_by_beds', (SELECT jsonb_agg(jsonb_build_object('beds', b, 'leasehold', lh, 'freehold', fh) ORDER BY b)
                    FROM (SELECT bedrooms::int b,
                                 count(*) FILTER (WHERE contract_type = 'Leasehold') lh,
                                 count(*) FILTER (WHERE contract_type = 'Freehold') fh
                          FROM p WHERE availability = 'Available' AND bedrooms BETWEEN 1 AND 6 GROUP BY 1) x),
      'development_status', (SELECT jsonb_agg(jsonb_build_object('name', s, 'value', c) ORDER BY c DESC)
                    FROM (SELECT CASE WHEN lower(off_plan) = 'completed' THEN 'Completed' ELSE 'Off plan' END s, count(*) c
                          FROM p WHERE off_plan IS NOT NULL GROUP BY 1) x),
      'listing_price_by_beds', (SELECT jsonb_agg(jsonb_build_object('beds', b, 'value', v) ORDER BY b)
                    FROM (SELECT bedrooms::int b, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) v
                          FROM p WHERE availability = 'Available' AND price_usd IS NOT NULL AND bedrooms BETWEEN 1 AND 6 GROUP BY 1) x),
      'supply_growth', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT public.reid_month(scrape_date) m, count(*) v FROM p
                          WHERE availability = 'Available' AND public.reid_month(scrape_date) >= win_from GROUP BY 1) x WHERE m IS NOT NULL),
      'clearance_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT public.reid_month(coalesce(sold_date, scrape_date)) m,
                                 100.0 * count(*) FILTER (WHERE availability = 'Sold') / nullif(count(*), 0) v
                          FROM p WHERE public.reid_month(coalesce(sold_date, scrape_date)) >= win_from GROUP BY 1) x WHERE m IS NOT NULL)
    ) INTO res;

  ELSIF p_module = 'sales-trends' THEN
    WITH p AS MATERIALIZED (SELECT *, public.reid_month(sold_date) sold_mth FROM public.reid_filtered_properties(p_filters)),
    max_sold AS MATERIALIZED (SELECT max(sold_mth) m FROM p),
    months AS MATERIALIZED (SELECT generate_series(win_from, (SELECT m FROM max_sold), '1 month'::interval)::date m),
    sold_rolling AS MATERIALIZED (
      SELECT mo.m, percentile_cont(0.5) WITHIN GROUP (ORDER BY s.price_usd) v
      FROM months mo
      JOIN (SELECT price_usd, sold_mth FROM p WHERE availability = 'Sold' AND price_usd IS NOT NULL) s
        ON s.sold_mth BETWEEN mo.m - interval '11 months' AND mo.m
      GROUP BY mo.m
    ),
    med AS MATERIALIZED (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Available') list_med
            FROM p WHERE price_usd IS NOT NULL),
    cur AS MATERIALIZED (SELECT jsonb_build_object(
        'sold_properties',   (SELECT count(*) FROM p WHERE availability = 'Sold'),
        'median_sold_price', (SELECT v FROM sold_rolling WHERE m = (SELECT m FROM max_sold)),
        'discount_rate',     (SELECT CASE WHEN list_med IS NULL OR list_med = 0 THEN NULL ELSE 100.0 * (list_med - (SELECT v FROM sold_rolling WHERE m = (SELECT m FROM max_sold))) / list_med END FROM med),
        'days_listed',       (SELECT avg(days_listed) FROM p WHERE availability = 'Sold' AND days_listed IS NOT NULL)
      ) k),
    pp AS MATERIALIZED (SELECT * FROM public.reid_filtered_properties(prior_filters)),
    yoy AS MATERIALIZED (SELECT jsonb_build_object(
        'sold_properties',   public.reid_yoy((SELECT k->>'sold_properties' FROM cur)::numeric,
                              (SELECT count(*) FROM pp WHERE availability = 'Sold')),
        'median_sold_price', public.reid_yoy((SELECT k->>'median_sold_price' FROM cur)::numeric,
                              (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FROM pp WHERE availability = 'Sold' AND price_usd IS NOT NULL)),
        'days_listed',       public.reid_yoy((SELECT k->>'days_listed' FROM cur)::numeric,
                              (SELECT avg(days_listed) FROM pp WHERE availability = 'Sold' AND days_listed IS NOT NULL))
      ) y)
    SELECT jsonb_build_object(
      'kpis', (SELECT k FROM cur),
      'kpis_yoy', (SELECT y FROM yoy),
      'sale_price_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM sold_rolling WHERE m IS NOT NULL),
      'ownership', (SELECT jsonb_agg(jsonb_build_object('name', contract_type, 'value', c) ORDER BY c DESC)
                    FROM (SELECT contract_type, count(*) c FROM p WHERE availability = 'Sold' AND contract_type IS NOT NULL GROUP BY 1) x),
      'sales_volume_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT public.reid_month(sold_date) m, count(*) v FROM p
                          WHERE availability = 'Sold' AND public.reid_month(sold_date) >= win_from GROUP BY 1) x WHERE m IS NOT NULL),
      'discount_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT public.reid_month(coalesce(sold_date, scrape_date)) m,
                                 100.0 * (percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Available')
                                        - percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Sold'))
                                  / nullif(percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Available'), 0) v
                          FROM p WHERE price_usd IS NOT NULL AND public.reid_month(coalesce(sold_date, scrape_date)) >= win_from GROUP BY 1) x WHERE m IS NOT NULL),
      'sales_volume_by_beds', (SELECT jsonb_agg(jsonb_build_object('beds', b, 'value', v) ORDER BY b)
                    FROM (SELECT bedrooms::int b, count(*) v FROM p WHERE availability = 'Sold' AND bedrooms BETWEEN 1 AND 6 GROUP BY 1) x)
    ) INTO res;

  ELSIF p_module = 'property-trends' THEN
    WITH p AS MATERIALIZED (SELECT *, public.reid_month(coalesce(sold_date, scrape_date)) mth,
                      nullif(replace(fsr, '%', ''), '')::numeric fsr_num
               FROM public.reid_filtered_properties(p_filters)),
    cur AS MATERIALIZED (SELECT jsonb_build_object(
        'price_per_sqm',     (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd) FROM p WHERE price_per_sqm_usd IS NOT NULL),
        'median_build_size', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY build_size_sqm) FROM p WHERE build_size_sqm IS NOT NULL),
        'median_fsr',        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY fsr_num) FROM p WHERE fsr_num IS NOT NULL),
        'price_per_year',    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_year_usd) FROM p WHERE price_per_year_usd IS NOT NULL)
      ) k),
    pp AS MATERIALIZED (SELECT *, nullif(replace(fsr, '%', ''), '')::numeric fsr_num
               FROM public.reid_filtered_properties(prior_filters)),
    yoy AS MATERIALIZED (SELECT jsonb_build_object(
        'price_per_sqm',     public.reid_yoy((SELECT k->>'price_per_sqm' FROM cur)::numeric,
                              (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd) FROM pp WHERE price_per_sqm_usd IS NOT NULL)),
        'median_build_size', public.reid_yoy((SELECT k->>'median_build_size' FROM cur)::numeric,
                              (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY build_size_sqm) FROM pp WHERE build_size_sqm IS NOT NULL)),
        'median_fsr',        public.reid_yoy((SELECT k->>'median_fsr' FROM cur)::numeric,
                              (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY fsr_num) FROM pp WHERE fsr_num IS NOT NULL)),
        'price_per_year',    public.reid_yoy((SELECT k->>'price_per_year' FROM cur)::numeric,
                              (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_year_usd) FROM pp WHERE price_per_year_usd IS NOT NULL))
      ) y)
    SELECT jsonb_build_object(
      'kpis', (SELECT k FROM cur),
      'kpis_yoy', (SELECT y FROM yoy),
      'price_per_sqm_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT mth m, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd) v FROM p
                          WHERE price_per_sqm_usd IS NOT NULL AND mth >= win_from GROUP BY 1) x),
      'build_size_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT mth m, avg(build_size_sqm) v FROM p WHERE build_size_sqm IS NOT NULL AND mth >= win_from GROUP BY 1) x),
      'lease_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT mth m, avg(years) v FROM p WHERE years IS NOT NULL AND years > 0 AND mth >= win_from GROUP BY 1) x),
      'price_per_year_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT mth m, avg(price_per_year_usd) v FROM p WHERE price_per_year_usd IS NOT NULL AND mth >= win_from GROUP BY 1) x),
      'fsr_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT mth m, avg(fsr_num) v FROM p WHERE fsr_num IS NOT NULL AND mth >= win_from GROUP BY 1) x)
    ) INTO res;

  ELSIF p_module = 'rental-trends' THEN
    WITH r AS MATERIALIZED (SELECT *, public.reid_month(date) mth FROM public.reid_filtered_rentals(p_filters)),
    rw AS MATERIALIZED (SELECT * FROM r WHERE mth >= (SELECT max(mth) FROM r) - interval '11 months'),
    cur AS MATERIALIZED (SELECT jsonb_build_object(
        'rental_properties', (SELECT coalesce(sum(count), 0) FROM r),
        'average_rate',      (SELECT avg(rate_usd) FROM r WHERE rate_usd IS NOT NULL),
        'average_occupancy', (SELECT avg(occupancy) FROM r WHERE occupancy IS NOT NULL),
        'total_revenue',     (SELECT sum(total_usd) FROM r WHERE total_usd IS NOT NULL)
      ) k),
    rr AS MATERIALIZED (SELECT * FROM public.reid_filtered_rentals(prior_filters)),
    yoy AS MATERIALIZED (SELECT jsonb_build_object(
        'rental_properties', public.reid_yoy((SELECT k->>'rental_properties' FROM cur)::numeric,
                              (SELECT coalesce(sum(count), 0) FROM rr)),
        'average_rate',      public.reid_yoy((SELECT k->>'average_rate' FROM cur)::numeric,
                              (SELECT avg(rate_usd) FROM rr WHERE rate_usd IS NOT NULL)),
        'average_occupancy', public.reid_yoy((SELECT k->>'average_occupancy' FROM cur)::numeric,
                              (SELECT avg(occupancy) FROM rr WHERE occupancy IS NOT NULL)),
        'total_revenue',     public.reid_yoy((SELECT k->>'total_revenue' FROM cur)::numeric,
                              (SELECT sum(total_usd) FROM rr WHERE total_usd IS NOT NULL))
      ) y)
    SELECT jsonb_build_object(
      'kpis', (SELECT k FROM cur),
      'kpis_yoy', (SELECT y FROM yoy),
      'adr_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT mth m, avg(rate_usd) v FROM rw WHERE rate_usd IS NOT NULL GROUP BY 1) x),
      'occupancy_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT mth m, avg(occupancy) v FROM rw WHERE occupancy IS NOT NULL GROUP BY 1) x),
      'mgmt_split', (SELECT jsonb_agg(jsonb_build_object('name', mgmt, 'value', v) ORDER BY v DESC)
                    FROM (SELECT mgmt, sum(count) v FROM r WHERE mgmt IS NOT NULL GROUP BY 1) x),
      'type_split', (SELECT jsonb_agg(jsonb_build_object('name', type, 'value', v) ORDER BY v DESC)
                    FROM (SELECT type, sum(count) v FROM r WHERE type IS NOT NULL GROUP BY 1) x),
      'revenue_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT mth m, avg(monthly_usd) v FROM rw WHERE monthly_usd IS NOT NULL GROUP BY 1) x)
    ) INTO res;

  ELSIF p_module = 'location-report' THEN
    WITH p AS MATERIALIZED (SELECT *, nullif(replace(fsr, '%', ''), '')::numeric fsr_num, public.reid_month(sold_date) sold_mth FROM public.reid_filtered_properties(p_filters)),
    r AS MATERIALIZED (SELECT * FROM public.reid_filtered_rentals(p_filters)),
    max_sold AS MATERIALIZED (SELECT max(sold_mth) m FROM p),
    months AS MATERIALIZED (SELECT generate_series(win_from, (SELECT m FROM max_sold), '1 month'::interval)::date m),
    sold_rolling AS MATERIALIZED (
      SELECT mo.m, percentile_cont(0.5) WITHIN GROUP (ORDER BY s.price_usd) v
      FROM months mo
      JOIN (SELECT price_usd, sold_mth FROM p WHERE availability = 'Sold' AND price_usd IS NOT NULL) s
        ON s.sold_mth BETWEEN mo.m - interval '11 months' AND mo.m
      GROUP BY mo.m
    ),
    m AS MATERIALIZED (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Available') list_med
          FROM p WHERE price_usd IS NOT NULL),
    cur AS MATERIALIZED (SELECT jsonb_build_object(
        'median_listing_price', (SELECT list_med FROM m),
        'median_sold_price',    (SELECT v FROM sold_rolling WHERE m = (SELECT m FROM max_sold)),
        'clearance_rate',       (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE availability = 'Sold') / count(*) END FROM p),
        'available_properties', (SELECT count(*) FROM p WHERE availability = 'Available')
      ) k),
    pp AS MATERIALIZED (SELECT * FROM public.reid_filtered_properties(prior_filters)),
    yoy AS MATERIALIZED (SELECT jsonb_build_object(
        'median_listing_price', public.reid_yoy((SELECT k->>'median_listing_price' FROM cur)::numeric,
                                 (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FROM pp WHERE availability = 'Available' AND price_usd IS NOT NULL)),
        'median_sold_price',    public.reid_yoy((SELECT k->>'median_sold_price' FROM cur)::numeric,
                                 (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FROM pp WHERE availability = 'Sold' AND price_usd IS NOT NULL)),
        'clearance_rate',       public.reid_yoy((SELECT k->>'clearance_rate' FROM cur)::numeric,
                                 (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE availability = 'Sold') / count(*) END FROM pp))
      ) y)
    SELECT jsonb_build_object(
      'kpis', (SELECT k FROM cur),
      'kpis_yoy', (SELECT y FROM yoy),
      'secondary', jsonb_build_object(
        'days_listed',       (SELECT avg(days_listed) FROM p WHERE days_listed IS NOT NULL),
        'price_per_sqm',     (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd) FROM p WHERE price_per_sqm_usd IS NOT NULL),
        'build_size',        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY build_size_sqm) FROM p WHERE build_size_sqm IS NOT NULL),
        'average_occupancy', (SELECT avg(occupancy) FROM r WHERE occupancy IS NOT NULL),
        'discount_rate',     (SELECT CASE WHEN list_med IS NULL OR list_med = 0 THEN NULL ELSE 100.0 * (list_med - (SELECT v FROM sold_rolling WHERE m = (SELECT m FROM max_sold))) / list_med END FROM m),
        'price_per_year',    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_year_usd) FROM p WHERE price_per_year_usd IS NOT NULL),
        'lease_term',        (SELECT avg(years) FROM p WHERE years IS NOT NULL AND years > 0),
        'gross_yield',       (SELECT CASE WHEN (SELECT v FROM sold_rolling WHERE m = (SELECT m FROM max_sold)) IS NULL OR (SELECT v FROM sold_rolling WHERE m = (SELECT m FROM max_sold)) = 0 THEN NULL
                                          ELSE 100.0 * (avg(monthly_usd) * 12) / (SELECT v FROM sold_rolling WHERE m = (SELECT m FROM max_sold)) END
                              FROM r WHERE monthly_usd IS NOT NULL),
        'record_count',      (SELECT count(*) FROM p)
      ),
      'sold_price_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM sold_rolling WHERE m IS NOT NULL),
      'volume_series', (SELECT jsonb_agg(jsonb_build_object('month', mm, 'available', av, 'sold', sd) ORDER BY mm)
                    FROM (SELECT public.reid_month(coalesce(sold_date, scrape_date)) mm,
                                 count(*) FILTER (WHERE availability = 'Available') av,
                                 count(*) FILTER (WHERE availability = 'Sold') sd
                          FROM p WHERE public.reid_month(coalesce(sold_date, scrape_date)) >= win_from GROUP BY 1) x WHERE mm IS NOT NULL),
      'status_split', (SELECT jsonb_agg(jsonb_build_object('name', s, 'value', c) ORDER BY c DESC)
                    FROM (SELECT CASE WHEN lower(off_plan) = 'completed' THEN 'Completed' ELSE 'Off plan' END s, count(*) c
                          FROM p WHERE off_plan IS NOT NULL GROUP BY 1) x)
    ) INTO res;

  ELSE
    RETURN jsonb_build_object('error', 'unknown_module');
  END IF;

  RETURN coalesce(res, '{}'::jsonb);
END;
$function$