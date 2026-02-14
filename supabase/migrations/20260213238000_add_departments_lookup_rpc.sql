-- ============================================================
-- DEPARTMENTS LOOKUP RPC FOR SIGNUP/AUTH FLOWS
--
-- Allows city-aware department lookup without relying on
-- direct table access from unauthenticated clients.
-- ============================================================

do $$
begin
  create policy "departments_select_public"
  on public.departments for select
  using (true);
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.get_departments_for_school_city(
  p_school_id uuid,
  p_city_id uuid default null
)
returns table (
  id uuid,
  name text,
  school_id uuid
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_city_id is null then
    return query
    select d.id, d.name, d.school_id
    from public.departments d
    where d.school_id = p_school_id
    order by d.name;
    return;
  end if;

  return query
  with by_city as (
    select d.id, d.name, d.school_id
    from public.departments d
    where d.school_id = p_school_id
      and d.city_id = p_city_id
  )
  select b.id, b.name, b.school_id
  from by_city b
  order by b.name;

  if found then
    return;
  end if;

  return query
  select d.id, d.name, d.school_id
  from public.departments d
  where d.school_id = p_school_id
  order by d.name;
end;
$$;

grant execute on function public.get_departments_for_school_city(uuid, uuid) to authenticated;
grant execute on function public.get_departments_for_school_city(uuid, uuid) to anon;
