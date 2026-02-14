-- ============================================================
-- AUTH CITY -> UNIVERSITY LOOKUP FIX
--
-- Ensures multi-campus universities (e.g. IHU) are discoverable
-- from city-based selectors in auth flows, and exposes a single
-- DB function for stable server-side lookup.
-- ============================================================

-- 1) Ensure key IHU campus cities exist.
insert into public.cities (name)
values
  ('Θεσσαλονίκη'),
  ('Σέρρες'),
  ('Καβάλα'),
  ('Δράμα'),
  ('Κατερίνη'),
  ('Κιλκίς'),
  ('Διδυμότειχο')
on conflict (name) do nothing;

-- 2) Ensure a canonical school exists for IHU.
insert into public.schools (name, university_id)
select 'Κεντρική Σχολή', u.id
from public.universities u
where (u.domain in ('ihu.gr', 'ihu.edu.gr') or u.name = 'Διεθνές Πανεπιστήμιο της Ελλάδος')
  and not exists (
    select 1
    from public.schools s
    where s.university_id = u.id
      and s.name = 'Κεντρική Σχολή'
  );

-- 3) Ensure IHU department-city coverage rows exist.
with ih_uni as (
  select u.id
  from public.universities u
  where u.domain in ('ihu.gr', 'ihu.edu.gr')
     or u.name = 'Διεθνές Πανεπιστήμιο της Ελλάδος'
  order by u.created_at asc
  limit 1
),
ih_school as (
  select s.id
  from public.schools s
  where s.university_id = (select id from ih_uni)
  order by
    case when s.name = 'Κεντρική Σχολή' then 0 else 1 end,
    s.created_at asc
  limit 1
),
ih_cities as (
  select c.id, c.name
  from public.cities c
  where c.name in (
    'Θεσσαλονίκη',
    'Σέρρες',
    'Καβάλα',
    'Δράμα',
    'Κατερίνη',
    'Κιλκίς',
    'Διδυμότειχο'
  )
)
insert into public.departments (name, school_id, city_id)
select
  'Τμήμα ' || c.name,
  (select id from ih_school),
  c.id
from ih_cities c
where (select id from ih_school) is not null
on conflict (school_id, name, city_id) do nothing;

-- 4) Canonical lookup function used by auth flows.
create or replace function public.get_universities_for_city(p_city_id uuid)
returns table (
  id uuid,
  name text,
  city_id uuid,
  email_domains text[],
  allowed_email_domains text[]
)
language sql
security definer
set search_path = public
stable
as $$
  with mapped_universities as (
    select distinct s.university_id
    from public.departments d
    join public.schools s on s.id = d.school_id
    where d.city_id = p_city_id
  ),
  direct_universities as (
    select
      u.id,
      u.name,
      u.city_id,
      u.email_domains,
      u.allowed_email_domains
    from public.universities u
    where u.city_id = p_city_id
  ),
  campus_universities as (
    select
      u.id,
      u.name,
      u.city_id,
      u.email_domains,
      u.allowed_email_domains
    from public.universities u
    join mapped_universities m on m.university_id = u.id
  )
  select distinct on (merged.id)
    merged.id,
    merged.name,
    merged.city_id,
    merged.email_domains,
    merged.allowed_email_domains
  from (
    select * from direct_universities
    union all
    select * from campus_universities
  ) merged
  order by merged.id, merged.name;
$$;

grant execute on function public.get_universities_for_city(uuid) to authenticated;
grant execute on function public.get_universities_for_city(uuid) to anon;
