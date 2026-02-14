-- ============================================================
-- FIX SIGNUP PROFILE STATUS CONFLICT
--
-- Prevents auth signup failures caused by invalid status combo:
-- is_pre_student = true and is_verified_student = true
-- ============================================================

create or replace function public.validate_profile_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Normalize status flags to satisfy exclusivity constraint.
  -- If a row is marked pre-student, it can never be verified at the same time.
  if coalesce(NEW.is_pre_student, false) then
    NEW.is_verified_student := false;
  end if;

  if coalesce(NEW.is_verified_student, false) then
    NEW.is_pre_student := false;
    if NEW.verification_status is null then
      NEW.verification_status := 'approved';
    end if;
  else
    NEW.is_pre_student := true;
    if NEW.verification_status is null then
      NEW.verification_status := 'pending';
    end if;
  end if;

  -- New auth-created profile rows (without university data) must start unverified.
  if TG_OP = 'INSERT'
    and NEW.university_id is null
    and (NEW.university_email is null or btrim(NEW.university_email) = '') then
    NEW.is_verified_student := false;
    NEW.is_pre_student := true;
    if NEW.verification_status is null then
      NEW.verification_status := 'pending';
    end if;
  end if;

  if TG_OP = 'INSERT' then
    if NEW.university_id is not null and coalesce(NEW.email, '') <> '' then
      if not public.email_matches_university(NEW.email, NEW.university_id) then
        raise exception 'Το email δεν αντιστοιχεί στο επιλεγμένο πανεπιστήμιο.'
          using errcode = 'P0001';
      end if;

      if NEW.university_email is null or btrim(NEW.university_email) = '' then
        NEW.university_email := NEW.email;
      end if;
    end if;

    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if NEW.university_id is not null
      and NEW.university_email is not null
      and OLD.university_email is distinct from NEW.university_email then
      if not public.email_matches_university(NEW.university_email, NEW.university_id) then
        raise exception 'Το email δεν αντιστοιχεί στο επιλεγμένο πανεπιστήμιο.'
          using errcode = 'P0001';
      end if;
    end if;

    return NEW;
  end if;

  return NEW;
end;
$$;
