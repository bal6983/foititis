-- ============================================================
-- FULL UNIVERSITY STRUCTURE
--
-- Adds:
-- - universities.domain + universities.allowed_email_domains
-- - departments table (schools -> departments -> cities)
-- - profiles.department_id
-- - server-side domain enforcement updates
-- - 2-stage verification hardening
-- ============================================================

-- ------------------------------------------------------------
-- 1) Universities: add canonical domain fields
-- ------------------------------------------------------------
alter table public.universities
  add column if not exists domain text;

alter table public.universities
  add column if not exists allowed_email_domains text[] not null default '{}';

create unique index if not exists idx_universities_domain_unique
  on public.universities(domain)
  where domain is not null;

-- Keep old column compatibility while moving to allowed_email_domains.
update public.universities
set allowed_email_domains = email_domains
where coalesce(array_length(allowed_email_domains, 1), 0) = 0
  and coalesce(array_length(email_domains, 1), 0) > 0;

update public.universities
set domain = coalesce(domain, allowed_email_domains[1], email_domains[1])
where domain is null;

-- ------------------------------------------------------------
-- 2) Seed base cities (idempotent)
-- ------------------------------------------------------------
create unique index if not exists idx_cities_name_unique
  on public.cities(name);

insert into public.cities (name)
values
  ('Αθήνα'),
  ('Θεσσαλονίκη'),
  ('Πάτρα'),
  ('Ιωάννινα'),
  ('Κομοτηνή'),
  ('Ηράκλειο'),
  ('Χανιά'),
  ('Μυτιλήνη'),
  ('Βόλος'),
  ('Πειραιάς'),
  ('Κέρκυρα'),
  ('Τρίπολη'),
  ('Κοζάνη')
on conflict (name) do nothing;

-- ------------------------------------------------------------
-- 3) Seed all 24 public universities with domain fields
-- ------------------------------------------------------------
with university_seed (name, city_name, domain, allowed_email_domains) as (
  values
    ('Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών', 'Αθήνα', 'uoa.gr', '{uoa.gr}'::text[]),
    ('Εθνικό Μετσόβιο Πολυτεχνείο', 'Αθήνα', 'ntua.gr', '{ntua.gr}'::text[]),
    ('Αριστοτέλειο Πανεπιστήμιο Θεσσαλονίκης', 'Θεσσαλονίκη', 'auth.gr', '{auth.gr}'::text[]),
    ('Πανεπιστήμιο Πατρών', 'Πάτρα', 'upatras.gr', '{upatras.gr}'::text[]),
    ('Πανεπιστήμιο Ιωαννίνων', 'Ιωάννινα', 'uoi.gr', '{uoi.gr}'::text[]),
    ('Δημοκρίτειο Πανεπιστήμιο Θράκης', 'Κομοτηνή', 'duth.gr', '{duth.gr}'::text[]),
    ('Πανεπιστήμιο Κρήτης', 'Ηράκλειο', 'uoc.gr', '{uoc.gr}'::text[]),
    ('Πολυτεχνείο Κρήτης', 'Χανιά', 'tuc.gr', '{tuc.gr}'::text[]),
    ('Πανεπιστήμιο Αιγαίου', 'Μυτιλήνη', 'aegean.gr', '{aegean.gr}'::text[]),
    ('Πανεπιστήμιο Θεσσαλίας', 'Βόλος', 'uth.gr', '{uth.gr}'::text[]),
    ('Πανεπιστήμιο Μακεδονίας', 'Θεσσαλονίκη', 'uom.edu.gr', '{uom.edu.gr,uom.gr}'::text[]),
    ('Πανεπιστήμιο Πειραιώς', 'Πειραιάς', 'unipi.gr', '{unipi.gr}'::text[]),
    ('Οικονομικό Πανεπιστήμιο Αθηνών', 'Αθήνα', 'aueb.gr', '{aueb.gr}'::text[]),
    ('Πάντειο Πανεπιστήμιο', 'Αθήνα', 'panteion.gr', '{panteion.gr}'::text[]),
    ('Γεωπονικό Πανεπιστήμιο Αθηνών', 'Αθήνα', 'aua.gr', '{aua.gr}'::text[]),
    ('Χαροκόπειο Πανεπιστήμιο', 'Αθήνα', 'hua.gr', '{hua.gr}'::text[]),
    ('Ιόνιο Πανεπιστήμιο', 'Κέρκυρα', 'ionio.gr', '{ionio.gr}'::text[]),
    ('Πανεπιστήμιο Πελοποννήσου', 'Τρίπολη', 'uop.gr', '{uop.gr}'::text[]),
    ('Πανεπιστήμιο Δυτικής Μακεδονίας', 'Κοζάνη', 'uowm.gr', '{uowm.gr}'::text[]),
    ('Ελληνικό Μεσογειακό Πανεπιστήμιο', 'Ηράκλειο', 'hmu.gr', '{hmu.gr}'::text[]),
    ('Πανεπιστήμιο Δυτικής Αττικής', 'Αθήνα', 'uniwa.gr', '{uniwa.gr}'::text[]),
    ('Διεθνές Πανεπιστήμιο της Ελλάδος', 'Θεσσαλονίκη', 'ihu.gr', '{ihu.gr,ihu.edu.gr}'::text[]),
    ('Ελληνικό Ανοικτό Πανεπιστήμιο', 'Πάτρα', 'eap.gr', '{eap.gr}'::text[]),
    ('Ανωτάτη Σχολή Καλών Τεχνών', 'Αθήνα', 'asfa.gr', '{asfa.gr}'::text[])
)
insert into public.universities (name, city_id, domain, allowed_email_domains, email_domains)
select
  seed.name,
  city.id,
  seed.domain,
  seed.allowed_email_domains,
  seed.allowed_email_domains
from university_seed as seed
join public.cities as city on city.name = seed.city_name
on conflict (name)
do update
set
  city_id = excluded.city_id,
  domain = excluded.domain,
  allowed_email_domains = excluded.allowed_email_domains,
  email_domains = excluded.email_domains;

-- ------------------------------------------------------------
-- 4) Schools hardening
-- ------------------------------------------------------------
create unique index if not exists idx_schools_university_name_unique
  on public.schools(university_id, name);

-- ------------------------------------------------------------
-- 5) Departments table + RLS
-- ------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (school_id, name, city_id)
);

alter table public.departments enable row level security;

do $$ begin
  create policy "departments_select_authenticated"
  on public.departments for select
  using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

create index if not exists idx_departments_school
  on public.departments(school_id);

create index if not exists idx_departments_city
  on public.departments(city_id);

-- ------------------------------------------------------------
-- 6) Profiles update: department_id + index
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists idx_profiles_department
  on public.profiles(department_id)
  where department_id is not null;

-- ------------------------------------------------------------
-- 7) Helper: email_matches_university(email, university_id)
--    Uses allowed_email_domains as source of truth.
-- ------------------------------------------------------------
create or replace function public.email_matches_university(
  p_email text,
  p_university_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_domain text;
  v_allowed_domains text[];
  v_allowed text;
begin
  if p_email is null or btrim(p_email) = '' then
    return false;
  end if;

  if position('@' in p_email) = 0 then
    return false;
  end if;

  v_domain := lower(trim(split_part(p_email, '@', 2)));
  if v_domain = '' then
    return false;
  end if;

  select
    case
      when coalesce(array_length(allowed_email_domains, 1), 0) > 0
        then allowed_email_domains
      else coalesce(email_domains, '{}'::text[])
    end
  into v_allowed_domains
  from public.universities
  where id = p_university_id;

  if coalesce(array_length(v_allowed_domains, 1), 0) = 0 then
    return false;
  end if;

  foreach v_allowed in array v_allowed_domains loop
    v_allowed := lower(trim(both from trim(leading '@' from coalesce(v_allowed, ''))));
    if v_allowed = '' then
      continue;
    end if;

    -- Exact domain or subdomain boundary match.
    if v_domain = v_allowed or v_domain like ('%.' || v_allowed) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- ------------------------------------------------------------
-- 8) Profile trigger: email domain enforcement + pre-student staging
-- ------------------------------------------------------------
create or replace function public.validate_profile_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    -- 2-stage verification: everyone starts pre_student unless already verified.
    if coalesce(NEW.is_verified_student, false) = false then
      NEW.is_pre_student := true;
    end if;

    if NEW.university_id is not null and coalesce(NEW.email, '') <> '' then
      if not public.email_matches_university(NEW.email, NEW.university_id) then
        raise exception 'Το email δεν αντιστοιχεί στο επιλεγμένο πανεπιστήμιο.'
          using errcode = 'P0001';
      end if;

      if NEW.university_email is null or btrim(NEW.university_email) = '' then
        NEW.university_email := NEW.email;
      end if;

      if NEW.verification_status is null then
        NEW.verification_status := 'pending';
      end if;
    end if;

    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if coalesce(NEW.is_verified_student, false) = false then
      NEW.is_pre_student := true;
    end if;

    if NEW.university_id is not null
      and NEW.university_email is not null
      and OLD.university_email is distinct from NEW.university_email then
      if not public.email_matches_university(NEW.university_email, NEW.university_id) then
        raise exception 'Το email δεν αντιστοιχεί στο επιλεγμένο πανεπιστήμιο.'
          using errcode = 'P0001';
      end if;
      if NEW.verification_status is null then
        NEW.verification_status := 'pending';
      end if;
    end if;

    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_validate_profile_email on public.profiles;

create trigger trigger_validate_profile_email
before insert or update on public.profiles
for each row
execute function public.validate_profile_email_domain();

-- ------------------------------------------------------------
-- 9) Profile trigger: department hierarchy consistency
-- ------------------------------------------------------------
create or replace function public.sync_profile_department_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_department_school_id uuid;
  v_department_city_id uuid;
  v_department_university_id uuid;
begin
  if NEW.department_id is null then
    return NEW;
  end if;

  select d.school_id, d.city_id, s.university_id
  into v_department_school_id, v_department_city_id, v_department_university_id
  from public.departments d
  join public.schools s on s.id = d.school_id
  where d.id = NEW.department_id;

  if not found then
    raise exception 'Invalid department selected.'
      using errcode = 'P0001';
  end if;

  if NEW.school_id is null then
    NEW.school_id := v_department_school_id;
  elsif NEW.school_id <> v_department_school_id then
    raise exception 'The selected department does not belong to the selected school.'
      using errcode = 'P0001';
  end if;

  if NEW.city_id is null then
    NEW.city_id := v_department_city_id;
  elsif NEW.city_id <> v_department_city_id then
    raise exception 'The selected department does not belong to the selected city.'
      using errcode = 'P0001';
  end if;

  if NEW.university_id is null then
    NEW.university_id := v_department_university_id;
  elsif NEW.university_id <> v_department_university_id then
    raise exception 'The selected department does not belong to the selected university.'
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_sync_profile_department_hierarchy on public.profiles;

create trigger trigger_sync_profile_department_hierarchy
before insert or update of department_id, school_id, city_id, university_id
on public.profiles
for each row
execute function public.sync_profile_department_hierarchy();

-- ------------------------------------------------------------
-- 10) RPCs: verification flow (replace with hardened versions)
-- ------------------------------------------------------------
create or replace function public.request_university_verification(
  p_university_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_university_id uuid;
  v_email text := lower(trim(p_university_email));
begin
  if v_user_id is null then
    raise exception 'You must be signed in.'
      using errcode = 'P0001';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Το email δεν αντιστοιχεί στο επιλεγμένο πανεπιστήμιο.'
      using errcode = 'P0001';
  end if;

  select university_id into v_university_id
  from public.profiles
  where id = v_user_id;

  if v_university_id is null then
    raise exception 'University is required before verification.'
      using errcode = 'P0001';
  end if;

  if not public.email_matches_university(v_email, v_university_id) then
    raise exception 'Το email δεν αντιστοιχεί στο επιλεγμένο πανεπιστήμιο.'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set
    university_email = v_email,
    is_pre_student = true,
    is_verified_student = false,
    verification_status = 'pending'
  where id = v_user_id;
end;
$$;

create or replace function public.finalize_university_verification()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_university_id uuid;
  v_university_email text;
  v_email_confirmed boolean;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.'
      using errcode = 'P0001';
  end if;

  select (email_confirmed_at is not null) into v_email_confirmed
  from auth.users
  where id = v_user_id;

  if coalesce(v_email_confirmed, false) = false then
    raise exception 'Email confirmation is required.'
      using errcode = 'P0001';
  end if;

  select university_id, university_email
  into v_university_id, v_university_email
  from public.profiles
  where id = v_user_id;

  if v_university_id is null or v_university_email is null then
    raise exception 'University verification data is incomplete.'
      using errcode = 'P0001';
  end if;

  if not public.email_matches_university(v_university_email, v_university_id) then
    raise exception 'Το email δεν αντιστοιχεί στο επιλεγμένο πανεπιστήμιο.'
      using errcode = 'P0001';
  end if;

  update public.profiles
  set
    is_verified_student = true,
    is_pre_student = false,
    verification_status = 'approved'
  where id = v_user_id;
end;
$$;

-- ------------------------------------------------------------
-- 11) public_profiles view: include department_id
-- ------------------------------------------------------------
create or replace view public.public_profiles as
select
  id,
  display_name,
  study_year,
  avatar_url,
  school_id,
  university_id,
  city_id,
  is_pre_student,
  is_verified_student,
  followers_count,
  following_count,
  last_seen_at,
  department_id
from public.profiles;

grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;
