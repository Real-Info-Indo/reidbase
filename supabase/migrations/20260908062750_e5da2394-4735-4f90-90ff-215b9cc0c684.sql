
create table if not exists public.reid_dashboard_cache (
  module text not null,
  filters_key text not null,
  payload jsonb not null,
  computed_at timestamptz not null default now(),
  primary key (module, filters_key)
);

grant all on public.reid_dashboard_cache to service_role;
alter table public.reid_dashboard_cache enable row level security;

create or replace function public.reid_dashboard_metrics_cached(p_module text, p_filters jsonb, p_max_age_seconds int default 900)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := md5(coalesce(p_filters, '{}'::jsonb)::text);
  v_payload jsonb;
begin
  select payload into v_payload
  from public.reid_dashboard_cache
  where module = p_module
    and filters_key = v_key
    and computed_at > now() - make_interval(secs => p_max_age_seconds);

  if v_payload is not null then
    return v_payload;
  end if;

  v_payload := public.reid_dashboard_metrics(p_module, coalesce(p_filters, '{}'::jsonb));

  insert into public.reid_dashboard_cache (module, filters_key, payload, computed_at)
  values (p_module, v_key, v_payload, now())
  on conflict (module, filters_key)
  do update set payload = excluded.payload, computed_at = excluded.computed_at;

  return v_payload;
end;
$$;
