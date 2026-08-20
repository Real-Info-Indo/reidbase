GRANT EXECUTE ON FUNCTION public.reid_month(text) TO supabase_read_only_user;
GRANT EXECUTE ON FUNCTION public.reid_filtered_properties(jsonb) TO supabase_read_only_user;
GRANT EXECUTE ON FUNCTION public.reid_filtered_rentals(jsonb) TO supabase_read_only_user;
GRANT EXECUTE ON FUNCTION public.reid_dashboard_filter_options() TO supabase_read_only_user;
GRANT EXECUTE ON FUNCTION public.reid_dashboard_metrics(text, jsonb) TO supabase_read_only_user;