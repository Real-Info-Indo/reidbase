create or replace function public.reid_yoy(cur numeric, prior numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
           when cur is null or prior is null or prior = 0 then null
           else round(100.0 * (cur - prior) / prior, 1)
         end
$$;