-- Period label helper: "Jul/25" -> 2025-07-01
CREATE OR REPLACE FUNCTION public.reid_month(t text)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN t IS NULL OR btrim(t) = '' THEN NULL ELSE to_date(btrim(t), 'Mon/YY') END
$$;

-- Filtered property rows
CREATE OR REPLACE FUNCTION public.reid_filtered_properties(f jsonb)
RETURNS SETOF public.reid_properties LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.reid_properties r
  WHERE (nullif(f->>'region','')     IS NULL OR r.region = f->>'region')
    AND (nullif(f->>'location','')   IS NULL OR r.location = f->>'location')
    AND (nullif(f->>'contract','')   IS NULL OR r.contract_type = f->>'contract')
    AND (nullif(f->>'ptype','')      IS NULL OR initcap(r.property_type) = initcap(f->>'ptype'))
    AND (nullif(f->>'beds','')       IS NULL OR r.bedrooms = (f->>'beds')::numeric)
    AND (nullif(f->>'price_min','')  IS NULL OR r.price_usd >= (f->>'price_min')::numeric)
    AND (nullif(f->>'price_max','')  IS NULL OR r.price_usd <= (f->>'price_max')::numeric)
    AND (nullif(f->>'size_min','')   IS NULL OR r.build_size_sqm >= (f->>'size_min')::numeric)
    AND (nullif(f->>'size_max','')   IS NULL OR r.build_size_sqm <= (f->>'size_max')::numeric)
    AND (nullif(f->>'date_from','')  IS NULL OR public.reid_month(coalesce(r.sold_date, r.scrape_date)) >= (f->>'date_from')::date)
    AND (nullif(f->>'date_to','')    IS NULL OR public.reid_month(coalesce(r.sold_date, r.scrape_date)) <= (f->>'date_to')::date)
$$;

-- Filtered rental rows
CREATE OR REPLACE FUNCTION public.reid_filtered_rentals(f jsonb)
RETURNS SETOF public.reid_rentals LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.reid_rentals r
  WHERE (nullif(f->>'region','')    IS NULL OR r.region = f->>'region')
    AND (nullif(f->>'location','')  IS NULL OR r.location = f->>'location')
    AND (nullif(f->>'ptype','')     IS NULL OR initcap(r.type) = initcap(f->>'ptype'))
    AND (nullif(f->>'beds','')      IS NULL OR r.beds = (f->>'beds')::int)
    AND (nullif(f->>'date_from','') IS NULL OR public.reid_month(r.date) >= (f->>'date_from')::date)
    AND (nullif(f->>'date_to','')   IS NULL OR public.reid_month(r.date) <= (f->>'date_to')::date)
$$;

-- Filter option lists
CREATE OR REPLACE FUNCTION public.reid_dashboard_filter_options()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'regions',   (SELECT jsonb_agg(DISTINCT region ORDER BY region) FROM public.reid_properties WHERE region IS NOT NULL),
    'locations', (SELECT jsonb_agg(DISTINCT location ORDER BY location) FROM public.reid_properties WHERE location IS NOT NULL),
    'contracts', (SELECT jsonb_agg(DISTINCT contract_type ORDER BY contract_type) FROM public.reid_properties WHERE contract_type IS NOT NULL),
    'ptypes',    to_jsonb(ARRAY['Villa','Apartment','Guest House']),
    'beds',      to_jsonb(ARRAY[1,2,3,4,5,6]),
    'months',    (SELECT jsonb_agg(m ORDER BY m) FROM (
                    SELECT DISTINCT public.reid_month(coalesce(sold_date, scrape_date)) AS m FROM public.reid_properties
                  ) x WHERE m IS NOT NULL)
  )
$$;

-- Main reporting function
CREATE OR REPLACE FUNCTION public.reid_dashboard_metrics(p_module text, p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  res jsonb;
  win_from date;
BEGIN
  -- Default trailing 12-month window for time series
  SELECT coalesce(nullif(p_filters->>'date_from','')::date,
                  (SELECT max(public.reid_month(coalesce(sold_date, scrape_date))) FROM public.reid_properties) - interval '11 months')
    INTO win_from;

  IF p_module = 'market-overview' THEN
    WITH p AS (SELECT * FROM public.reid_filtered_properties(p_filters)),
    r AS (SELECT * FROM public.reid_filtered_rentals(p_filters))
    SELECT jsonb_build_object(
      'kpis', jsonb_build_object(
        'available_properties', (SELECT count(*) FROM p WHERE availability = 'Available'),
        'median_sold_price',    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FROM p WHERE availability = 'Sold' AND price_usd IS NOT NULL),
        'clearance_rate',       (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE availability = 'Sold') / count(*) END FROM p),
        'rental_records',       (SELECT coalesce(sum(count), 0) FROM r)
      ),
      'ownership', (SELECT jsonb_agg(jsonb_build_object('name', contract_type, 'value', c) ORDER BY c DESC)
                    FROM (SELECT contract_type, count(*) c FROM p WHERE contract_type IS NOT NULL GROUP BY 1) x),
      'sold_price_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT public.reid_month(sold_date) m, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) v
                          FROM p WHERE availability = 'Sold' AND price_usd IS NOT NULL AND public.reid_month(sold_date) >= win_from
                          GROUP BY 1) x WHERE m IS NOT NULL),
      'rental_supply_by_beds', (SELECT jsonb_agg(jsonb_build_object('beds', beds, 'value', v) ORDER BY beds)
                    FROM (SELECT beds, sum(count) v FROM r WHERE beds BETWEEN 1 AND 6 GROUP BY 1) x),
      'available_by_beds', (SELECT jsonb_agg(jsonb_build_object('beds', b, 'leasehold', lh, 'freehold', fh) ORDER BY b)
                    FROM (SELECT bedrooms::int b,
                                 count(*) FILTER (WHERE contract_type = 'Leasehold') lh,
                                 count(*) FILTER (WHERE contract_type = 'Freehold') fh
                          FROM p WHERE availability = 'Available' AND bedrooms BETWEEN 1 AND 6 GROUP BY 1) x)
    ) INTO res;

  ELSIF p_module = 'supply-trends' THEN
    WITH p AS (SELECT * FROM public.reid_filtered_properties(p_filters)),
    mx AS (SELECT max(public.reid_month(scrape_date)) m FROM p)
    SELECT jsonb_build_object(
      'kpis', jsonb_build_object(
        'available_properties', (SELECT count(*) FROM p WHERE availability = 'Available'),
        'median_listing_price', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FROM p WHERE availability = 'Available' AND price_usd IS NOT NULL),
        'clearance_rate',       (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE availability = 'Sold') / count(*) END FROM p),
        'new_listings',         (SELECT count(*) FROM p WHERE availability = 'Available' AND public.reid_month(scrape_date) = (SELECT m FROM mx))
      ),
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
    WITH p AS (SELECT * FROM public.reid_filtered_properties(p_filters)),
    med AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Available') list_med,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Sold') sold_med
            FROM p WHERE price_usd IS NOT NULL)
    SELECT jsonb_build_object(
      'kpis', jsonb_build_object(
        'sold_properties',   (SELECT count(*) FROM p WHERE availability = 'Sold'),
        'median_sold_price', (SELECT sold_med FROM med),
        'discount_rate',     (SELECT CASE WHEN list_med IS NULL OR list_med = 0 THEN NULL ELSE 100.0 * (list_med - sold_med) / list_med END FROM med),
        'days_listed',       (SELECT avg(days_listed) FROM p WHERE availability = 'Sold' AND days_listed IS NOT NULL)
      ),
      'sale_price_series', (SELECT jsonb_agg(jsonb_build_object('month', m, 'value', v) ORDER BY m)
                    FROM (SELECT public.reid_month(sold_date) m, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) v
                          FROM p WHERE availability = 'Sold' AND price_usd IS NOT NULL AND public.reid_month(sold_date) >= win_from GROUP BY 1) x WHERE m IS NOT NULL),
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
    WITH p AS (SELECT *, public.reid_month(coalesce(sold_date, scrape_date)) mth,
                      nullif(replace(fsr, '%', ''), '')::numeric fsr_num
               FROM public.reid_filtered_properties(p_filters))
    SELECT jsonb_build_object(
      'kpis', jsonb_build_object(
        'price_per_sqm',     (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd) FROM p WHERE price_per_sqm_usd IS NOT NULL),
        'median_build_size', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY build_size_sqm) FROM p WHERE build_size_sqm IS NOT NULL),
        'median_fsr',        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY fsr_num) FROM p WHERE fsr_num IS NOT NULL),
        'price_per_year',    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_year_usd) FROM p WHERE price_per_year_usd IS NOT NULL)
      ),
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
    WITH r AS (SELECT *, public.reid_month(date) mth FROM public.reid_filtered_rentals(p_filters)),
    rw AS (SELECT * FROM r WHERE mth >= (SELECT max(mth) FROM r) - interval '11 months')
    SELECT jsonb_build_object(
      'kpis', jsonb_build_object(
        'rental_properties', (SELECT coalesce(sum(count), 0) FROM r),
        'average_rate',      (SELECT avg(rate_usd) FROM r WHERE rate_usd IS NOT NULL),
        'average_occupancy', (SELECT avg(occupancy) FROM r WHERE occupancy IS NOT NULL),
        'total_revenue',     (SELECT sum(total_usd) FROM r WHERE total_usd IS NOT NULL)
      ),
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
    WITH p AS (SELECT *, nullif(replace(fsr, '%', ''), '')::numeric fsr_num FROM public.reid_filtered_properties(p_filters)),
    r AS (SELECT * FROM public.reid_filtered_rentals(p_filters)),
    m AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Available') list_med,
                 percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) FILTER (WHERE availability = 'Sold') sold_med
          FROM p WHERE price_usd IS NOT NULL)
    SELECT jsonb_build_object(
      'kpis', jsonb_build_object(
        'median_listing_price', (SELECT list_med FROM m),
        'median_sold_price',    (SELECT sold_med FROM m),
        'clearance_rate',       (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE 100.0 * count(*) FILTER (WHERE availability = 'Sold') / count(*) END FROM p),
        'available_properties', (SELECT count(*) FROM p WHERE availability = 'Available')
      ),
      'secondary', jsonb_build_object(
        'days_listed',       (SELECT avg(days_listed) FROM p WHERE days_listed IS NOT NULL),
        'price_per_sqm',     (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_sqm_usd) FROM p WHERE price_per_sqm_usd IS NOT NULL),
        'build_size',        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY build_size_sqm) FROM p WHERE build_size_sqm IS NOT NULL),
        'average_occupancy', (SELECT avg(occupancy) FROM r WHERE occupancy IS NOT NULL),
        'discount_rate',     (SELECT CASE WHEN list_med IS NULL OR list_med = 0 THEN NULL ELSE 100.0 * (list_med - sold_med) / list_med END FROM m),
        'price_per_year',    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_year_usd) FROM p WHERE price_per_year_usd IS NOT NULL),
        'lease_term',        (SELECT avg(years) FROM p WHERE years IS NOT NULL AND years > 0),
        'gross_yield',       (SELECT CASE WHEN (SELECT sold_med FROM m) IS NULL OR (SELECT sold_med FROM m) = 0 THEN NULL
                                          ELSE 100.0 * (avg(monthly_usd) * 12) / (SELECT sold_med FROM m) END
                              FROM r WHERE monthly_usd IS NOT NULL),
        'record_count',      (SELECT count(*) FROM p)
      ),
      'sold_price_series', (SELECT jsonb_agg(jsonb_build_object('month', mm, 'value', v) ORDER BY mm)
                    FROM (SELECT public.reid_month(sold_date) mm, percentile_cont(0.5) WITHIN GROUP (ORDER BY price_usd) v
                          FROM p WHERE availability = 'Sold' AND price_usd IS NOT NULL AND public.reid_month(sold_date) >= win_from GROUP BY 1) x WHERE mm IS NOT NULL),
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
$$;

REVOKE ALL ON FUNCTION public.reid_dashboard_metrics(text, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reid_dashboard_filter_options() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reid_filtered_properties(jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.reid_filtered_rentals(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reid_dashboard_metrics(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reid_dashboard_filter_options() TO service_role;