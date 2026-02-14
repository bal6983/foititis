-- Lock core profile identity/academic fields for verified students.
-- Users must submit a manual change request flow (future) instead of direct edits.

create or replace function public.prevent_verified_profile_core_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP <> 'UPDATE' then
    return NEW;
  end if;

  if coalesce(OLD.is_verified_student, false) = true then
    if
      NEW.full_name is distinct from OLD.full_name or
      NEW.display_name is distinct from OLD.display_name or
      NEW.city_id is distinct from OLD.city_id or
      NEW.university_id is distinct from OLD.university_id or
      NEW.school_id is distinct from OLD.school_id or
      NEW.department_id is distinct from OLD.department_id
    then
      raise exception 'Το προφίλ επαληθευμένου φοιτητή είναι κλειδωμένο. Υπέβαλε αίτημα αλλαγής στοιχείων.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trigger_prevent_verified_profile_core_changes on public.profiles;

create trigger trigger_prevent_verified_profile_core_changes
before update on public.profiles
for each row
execute function public.prevent_verified_profile_core_changes();

