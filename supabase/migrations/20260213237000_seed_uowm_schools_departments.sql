-- ============================================================
-- UOWM SCHOOLS + DEPARTMENTS (FROM PROVIDED LIST)
--
-- Normalizes Western Macedonia school names and seeds all
-- requested departments in Greek for immediate Auth/Directory use.
-- ============================================================

create unique index if not exists idx_schools_university_name_unique
  on public.schools(university_id, name);

insert into public.cities (name)
values ('Καστοριά')
on conflict (name) do nothing;

do $$
declare
  v_university_id uuid;
  v_city_kastoria_id uuid;
  v_src_name text;
  v_dst_name text;
  v_src_id uuid;
  v_dst_id uuid;
begin
  select id into v_university_id
  from public.universities
  where domain = 'uowm.gr'
  limit 1;

  if v_university_id is null then
    raise exception 'University with domain uowm.gr was not found.'
      using errcode = 'P0001';
  end if;

  select id into v_city_kastoria_id
  from public.cities
  where name = 'Καστοριά'
  limit 1;

  if v_city_kastoria_id is null then
    raise exception 'City Καστοριά was not found.'
      using errcode = 'P0001';
  end if;

  insert into public.schools (name, university_id)
  select school_name, v_university_id
  from (
    values
      ('Πολυτεχνική Σχολή'),
      ('Σχολή Επιστημών Υγείας'),
      ('Σχολή Κοινωνικών Και Ανθρωπιστικών Επιστημών'),
      ('Σχολή Θετικών Επιστημών'),
      ('Σχολή Γεωπονικών Επιστημών'),
      ('Σχολή Οικονομικών Επιστημών'),
      ('Σχολή Καλών Τεχνών')
  ) as seed(school_name)
  on conflict (university_id, name) do nothing;

  -- Merge old aliases to canonical names for UOWM only.
  for v_src_name, v_dst_name in
    select *
    from (
      values
        ('Σχολή Μηχανικών', 'Πολυτεχνική Σχολή'),
        ('Σχολή Γεωπονίας', 'Σχολή Γεωπονικών Επιστημών'),
        ('Σχολή Κοινωνικών και Ανθρωπιστικών Επιστημών', 'Σχολή Κοινωνικών Και Ανθρωπιστικών Επιστημών')
    ) as aliases(src_name, dst_name)
  loop
    select id into v_src_id
    from public.schools
    where university_id = v_university_id
      and name = v_src_name
    order by created_at asc
    limit 1;

    select id into v_dst_id
    from public.schools
    where university_id = v_university_id
      and name = v_dst_name
    order by created_at asc
    limit 1;

    if v_src_id is null or v_dst_id is null or v_src_id = v_dst_id then
      continue;
    end if;

    update public.profiles
    set school_id = v_dst_id
    where school_id = v_src_id;

    update public.departments d
    set school_id = v_dst_id
    where d.school_id = v_src_id
      and not exists (
        select 1
        from public.departments d2
        where d2.school_id = v_dst_id
          and d2.city_id = d.city_id
          and lower(d2.name) = lower(d.name)
      );

    delete from public.departments
    where school_id = v_src_id;

    delete from public.schools
    where id = v_src_id;
  end loop;

  -- Seed all requested departments for UOWM (current rollout: Καστοριά).
  insert into public.departments (name, school_id, city_id)
  select d.department_name, s.id, v_city_kastoria_id
  from (
    values
      ('Πολυτεχνική Σχολή', 'Τμήμα Ηλεκτρολόγων Μηχανικών Και Μηχανικών Υπολογιστών'),
      ('Πολυτεχνική Σχολή', 'Τμήμα Μηχανικών Ορυκτών Πόρων'),
      ('Πολυτεχνική Σχολή', 'Τμήμα Μηχανικών Σχεδίασης Προϊόντων Και Συστημάτων'),
      ('Πολυτεχνική Σχολή', 'Τμήμα Μηχανολόγων Μηχανικών'),
      ('Πολυτεχνική Σχολή', 'Τμήμα Χημικών Μηχανικών'),

      ('Σχολή Επιστημών Υγείας', 'Τμήμα Εργοθεραπείας'),
      ('Σχολή Επιστημών Υγείας', 'Τμήμα Μαιευτικής'),

      ('Σχολή Κοινωνικών Και Ανθρωπιστικών Επιστημών', 'Παιδαγωγικό Τμήμα Δημοτικής Εκπαίδευσης'),
      ('Σχολή Κοινωνικών Και Ανθρωπιστικών Επιστημών', 'Παιδαγωγικό Τμήμα Νηπιαγωγών'),
      ('Σχολή Κοινωνικών Και Ανθρωπιστικών Επιστημών', 'Τμήμα Ψυχολογίας'),
      ('Σχολή Κοινωνικών Και Ανθρωπιστικών Επιστημών', 'Τμήμα Επικοινωνίας Και Ψηφιακών Μέσων'),

      ('Σχολή Θετικών Επιστημών', 'Τμήμα Μαθηματικών'),
      ('Σχολή Θετικών Επιστημών', 'Τμήμα Πληροφορικής'),

      ('Σχολή Γεωπονικών Επιστημών', 'Τμήμα Γεωπονίας'),

      ('Σχολή Οικονομικών Επιστημών', 'Τμήμα Διεθνών Και Ευρωπαϊκών Οικονομικών Σπουδών'),
      ('Σχολή Οικονομικών Επιστημών', 'Τμήμα Διοικητικής Επιστήμης Και Τεχνολογίας'),
      ('Σχολή Οικονομικών Επιστημών', 'Τμήμα Λογιστικής Και Χρηματοοικονομικής'),
      ('Σχολή Οικονομικών Επιστημών', 'Τμήμα Οικονομικών Επιστημών'),
      ('Σχολή Οικονομικών Επιστημών', 'Τμήμα Οργάνωσης Και Διοίκησης Επιχειρήσεων'),
      ('Σχολή Οικονομικών Επιστημών', 'Τμήμα Περιφερειακής Και Διασυνοριακής Ανάπτυξης'),
      ('Σχολή Οικονομικών Επιστημών', 'Τμήμα Στατιστικής'),

      ('Σχολή Καλών Τεχνών', 'Τμήμα Εικαστικών Και Εφαρμοσμένων Τεχνών')
  ) as d(school_name, department_name)
  join public.schools s
    on s.university_id = v_university_id
   and s.name = d.school_name
  on conflict (school_id, name, city_id) do nothing;
end;
$$;
