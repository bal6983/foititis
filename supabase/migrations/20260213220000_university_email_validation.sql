-- ============================================================
-- UNIVERSITY EMAIL VALIDATION
--
-- 1. Seed 13 Greek cities + 24 public universities
-- 2. Helper function: email_matches_university()
-- 3. BEFORE INSERT/UPDATE trigger for domain validation
-- 4. RPC: request_university_verification()
-- 5. RPC: finalize_university_verification()
-- ============================================================

-- ============================================================
-- 0. Unique indexes on name columns (for ON CONFLICT)
-- ============================================================
create unique index if not exists idx_cities_name_unique
  on public.cities(name);

create unique index if not exists idx_universities_name_unique
  on public.universities(name);

-- ============================================================
-- 1. Seed Greek cities
-- ============================================================
insert into public.cities (name) values
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

-- ============================================================
-- 2. Seed 24 Greek public universities with email domains
-- ============================================================
insert into public.universities (name, city_id, email_domains) values
  ('Εθνικό και Καποδιστριακό Πανεπιστήμιο Αθηνών',
    (select id from public.cities where name = 'Αθήνα'),
    '{uoa.gr}'),
  ('Εθνικό Μετσόβιο Πολυτεχνείο',
    (select id from public.cities where name = 'Αθήνα'),
    '{ntua.gr}'),
  ('Αριστοτέλειο Πανεπιστήμιο Θεσσαλονίκης',
    (select id from public.cities where name = 'Θεσσαλονίκη'),
    '{auth.gr}'),
  ('Πανεπιστήμιο Πατρών',
    (select id from public.cities where name = 'Πάτρα'),
    '{upatras.gr}'),
  ('Πανεπιστήμιο Ιωαννίνων',
    (select id from public.cities where name = 'Ιωάννινα'),
    '{uoi.gr}'),
  ('Δημοκρίτειο Πανεπιστήμιο Θράκης',
    (select id from public.cities where name = 'Κομοτηνή'),
    '{duth.gr}'),
  ('Πανεπιστήμιο Κρήτης',
    (select id from public.cities where name = 'Ηράκλειο'),
    '{uoc.gr}'),
  ('Πολυτεχνείο Κρήτης',
    (select id from public.cities where name = 'Χανιά'),
    '{tuc.gr}'),
  ('Πανεπιστήμιο Αιγαίου',
    (select id from public.cities where name = 'Μυτιλήνη'),
    '{aegean.gr}'),
  ('Πανεπιστήμιο Θεσσαλίας',
    (select id from public.cities where name = 'Βόλος'),
    '{uth.gr}'),
  ('Πανεπιστήμιο Μακεδονίας',
    (select id from public.cities where name = 'Θεσσαλονίκη'),
    '{uom.edu.gr,uom.gr}'),
  ('Πανεπιστήμιο Πειραιώς',
    (select id from public.cities where name = 'Πειραιάς'),
    '{unipi.gr}'),
  ('Οικονομικό Πανεπιστήμιο Αθηνών',
    (select id from public.cities where name = 'Αθήνα'),
    '{aueb.gr}'),
  ('Πάντειο Πανεπιστήμιο',
    (select id from public.cities where name = 'Αθήνα'),
    '{panteion.gr}'),
  ('Γεωπονικό Πανεπιστήμιο Αθηνών',
    (select id from public.cities where name = 'Αθήνα'),
    '{aua.gr}'),
  ('Χαροκόπειο Πανεπιστήμιο',
    (select id from public.cities where name = 'Αθήνα'),
    '{hua.gr}'),
  ('Ιόνιο Πανεπιστήμιο',
    (select id from public.cities where name = 'Κέρκυρα'),
    '{ionio.gr}'),
  ('Πανεπιστήμιο Πελοποννήσου',
    (select id from public.cities where name = 'Τρίπολη'),
    '{uop.gr}'),
  ('Πανεπιστήμιο Δυτικής Μακεδονίας',
    (select id from public.cities where name = 'Κοζάνη'),
    '{uowm.gr}'),
  ('Ελληνικό Μεσογειακό Πανεπιστήμιο',
    (select id from public.cities where name = 'Ηράκλειο'),
    '{hmu.gr}'),
  ('Πανεπιστήμιο Δυτικής Αττικής',
    (select id from public.cities where name = 'Αθήνα'),
    '{uniwa.gr}'),
  ('Διεθνές Πανεπιστήμιο της Ελλάδος',
    (select id from public.cities where name = 'Θεσσαλονίκη'),
    '{ihu.gr,ihu.edu.gr}'),
  ('Ελληνικό Ανοικτό Πανεπιστήμιο',
    (select id from public.cities where name = 'Πάτρα'),
    '{eap.gr}'),
  ('Ανωτάτη Σχολή Καλών Τεχνών',
    (select id from public.cities where name = 'Αθήνα'),
    '{asfa.gr}')
on conflict (name) do update set
  email_domains = excluded.email_domains,
  city_id = excluded.city_id;

-- ============================================================
-- 3. Helper: email_matches_university(email, university_id)
--    Suffix matching: user@di.uoa.gr matches domain 'uoa.gr'
--    Boundary-safe: fakeuoa.gr does NOT match 'uoa.gr'
-- ============================================================
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
  v_domain := lower(trim(split_part(p_email, '@', 2)));

  if v_domain = '' or v_domain is null then
    return false;
  end if;

  select email_domains into v_allowed_domains
  from universities
  where id = p_university_id;

  if v_allowed_domains is null or array_length(v_allowed_domains, 1) is null then
    return false;
  end if;

  foreach v_allowed in array v_allowed_domains loop
    v_allowed := lower(trim(v_allowed));
    if v_domain = v_allowed then
      return true;
    end if;
    if v_domain like ('%.' || v_allowed) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- ============================================================
-- 4. Trigger: validate email domain on profiles INSERT/UPDATE
--
-- INSERT: validate email against university when university_id set
--         auto-set university_email = email if valid
-- UPDATE: validate only when university_email is changing
--         (safe for pre-students adding university_id alone)
-- ============================================================
create or replace function public.validate_profile_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- === INSERT (student signup) ===
  if TG_OP = 'INSERT' then
    if NEW.university_id is not null and NEW.email is not null then
      if not email_matches_university(NEW.email, NEW.university_id) then
        raise exception
          'Το email δεν αντιστοιχεί στο πανεπιστήμιο. Χρησιμοποίησε το πανεπιστημιακό σου email.'
          using errcode = 'P0001';
      end if;
      -- Auto-set university_email for student signups
      if NEW.university_email is null then
        NEW.university_email := NEW.email;
      end if;
    end if;
    return NEW;
  end if;

  -- === UPDATE (verification flow / direct update) ===
  if TG_OP = 'UPDATE' then
    if (OLD.university_email is distinct from NEW.university_email)
       and NEW.university_email is not null
       and NEW.university_id is not null then
      if not email_matches_university(NEW.university_email, NEW.university_id) then
        raise exception
          'Το πανεπιστημιακό email δεν αντιστοιχεί στο πανεπιστήμιο.'
          using errcode = 'P0001';
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

-- ============================================================
-- 5. RPC: request_university_verification(p_university_email)
--
-- Called by Verification.tsx for pre-students (or anyone) who
-- wants to verify with a university email.
-- Validates domain, stores university_email, sets status.
-- ============================================================
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
begin
  if v_user_id is null then
    raise exception 'Δεν είσαι συνδεδεμένος.'
      using errcode = 'P0001';
  end if;

  if p_university_email is null or trim(p_university_email) = '' then
    raise exception 'Συμπλήρωσε πανεπιστημιακό email.'
      using errcode = 'P0001';
  end if;

  select university_id into v_university_id
  from profiles
  where id = v_user_id;

  if v_university_id is null then
    raise exception 'Δεν έχεις επιλέξει πανεπιστήμιο.'
      using errcode = 'P0001';
  end if;

  if not email_matches_university(trim(p_university_email), v_university_id) then
    raise exception 'Το email δεν αντιστοιχεί στο πανεπιστήμιο που έχεις επιλέξει.'
      using errcode = 'P0001';
  end if;

  -- The BEFORE UPDATE trigger also validates (belt + suspenders)
  update profiles
  set
    university_email = lower(trim(p_university_email)),
    verification_status = 'pending'
  where id = v_user_id;
end;
$$;

-- ============================================================
-- 6. RPC: finalize_university_verification()
--
-- Called by ProtectedRoute.tsx after page load when:
--   email_confirmed_at IS NOT NULL
--   AND university_email IS NOT NULL
--   AND is_verified_student = false
--
-- Promotes user to verified_student.
-- ============================================================
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
    raise exception 'Δεν είσαι συνδεδεμένος.'
      using errcode = 'P0001';
  end if;

  select (email_confirmed_at is not null) into v_email_confirmed
  from auth.users
  where id = v_user_id;

  if not coalesce(v_email_confirmed, false) then
    raise exception 'Το email δεν έχει επιβεβαιωθεί ακόμα.'
      using errcode = 'P0001';
  end if;

  select university_email, university_id
  into v_university_email, v_university_id
  from profiles
  where id = v_user_id;

  if v_university_email is null then
    raise exception 'Δεν έχεις καταχωρίσει πανεπιστημιακό email.'
      using errcode = 'P0001';
  end if;

  if v_university_id is null then
    raise exception 'Δεν έχεις επιλέξει πανεπιστήμιο.'
      using errcode = 'P0001';
  end if;

  if not email_matches_university(v_university_email, v_university_id) then
    raise exception 'Το πανεπιστημιακό email δεν αντιστοιχεί πλέον στο πανεπιστήμιο.'
      using errcode = 'P0001';
  end if;

  update profiles
  set
    is_verified_student = true,
    is_pre_student = false,
    verification_status = 'approved'
  where id = v_user_id
    and is_verified_student = false;
end;
$$;
