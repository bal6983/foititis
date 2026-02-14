-- ============================================================
-- REFRESH UNIVERSITY CATALOG FROM UPDATED USER LIST
--
-- Adds missing cities, enriches schools, and aligns university
-- city coverage to the updated list shared by the product owner.
-- ============================================================

create unique index if not exists idx_cities_name_unique
  on public.cities(name);

create unique index if not exists idx_schools_university_name_unique
  on public.schools(university_id, name);

-- 1) Missing cities from updated list.
insert into public.cities (name)
values
  ('Ψαχνά'),
  ('Χαλκίδα'),
  ('Αγρίνιο'),
  ('Ιθάκη'),
  ('Κεφαλονιά')
on conflict (name) do nothing;

-- 2) Updated university-city coverage.
with campus_map (university_domain, city_name) as (
  values
    ('uoa.gr', 'Αθήνα'),
    ('uoa.gr', 'Ψαχνά'),
    ('uoa.gr', 'Χαλκίδα'),
    ('ntua.gr', 'Αθήνα'),
    ('aueb.gr', 'Αθήνα'),
    ('panteion.gr', 'Αθήνα'),
    ('unipi.gr', 'Πειραιάς'),
    ('aua.gr', 'Αθήνα'),
    ('hua.gr', 'Αθήνα'),
    ('asfa.gr', 'Αθήνα'),
    ('eap.gr', 'Πάτρα'),
    ('auth.gr', 'Θεσσαλονίκη'),
    ('uom.edu.gr', 'Θεσσαλονίκη'),
    ('ihu.gr', 'Θεσσαλονίκη'),
    ('ihu.gr', 'Καβάλα'),
    ('ihu.gr', 'Σέρρες'),
    ('ihu.gr', 'Κατερίνη'),
    ('ihu.gr', 'Κιλκίς'),
    ('duth.gr', 'Κομοτηνή'),
    ('duth.gr', 'Ξάνθη'),
    ('duth.gr', 'Αλεξανδρούπολη'),
    ('duth.gr', 'Ορεστιάδα'),
    ('uth.gr', 'Βόλος'),
    ('uth.gr', 'Λάρισα'),
    ('uth.gr', 'Καρδίτσα'),
    ('uth.gr', 'Τρίκαλα'),
    ('uth.gr', 'Λαμία'),
    ('uoi.gr', 'Ιωάννινα'),
    ('uoi.gr', 'Άρτα'),
    ('uop.gr', 'Τρίπολη'),
    ('uop.gr', 'Καλαμάτα'),
    ('uop.gr', 'Σπάρτη'),
    ('uop.gr', 'Ναύπλιο'),
    ('uop.gr', 'Κόρινθος'),
    ('aegean.gr', 'Μυτιλήνη'),
    ('aegean.gr', 'Χίος'),
    ('aegean.gr', 'Σάμος'),
    ('aegean.gr', 'Ρόδος'),
    ('aegean.gr', 'Λήμνος'),
    ('aegean.gr', 'Σύρος'),
    ('uoc.gr', 'Ηράκλειο'),
    ('uoc.gr', 'Ρέθυμνο'),
    ('tuc.gr', 'Χανιά'),
    ('hmu.gr', 'Ηράκλειο'),
    ('hmu.gr', 'Χανιά'),
    ('hmu.gr', 'Ρέθυμνο'),
    ('hmu.gr', 'Άγιος Νικόλαος'),
    ('hmu.gr', 'Ιεράπετρα'),
    ('hmu.gr', 'Σητεία'),
    ('upatras.gr', 'Πάτρα'),
    ('upatras.gr', 'Αγρίνιο'),
    ('uowm.gr', 'Κοζάνη'),
    ('uowm.gr', 'Πτολεμαΐδα'),
    ('uowm.gr', 'Φλώρινα'),
    ('uowm.gr', 'Καστοριά'),
    ('uowm.gr', 'Γρεβενά'),
    ('ionio.gr', 'Κέρκυρα'),
    ('ionio.gr', 'Ζάκυνθος'),
    ('ionio.gr', 'Λευκάδα'),
    ('ionio.gr', 'Κεφαλονιά'),
    ('ionio.gr', 'Ιθάκη')
),
resolved as (
  select
    u.id as university_id,
    c.id as city_id,
    c.name as city_name
  from campus_map m
  join public.universities u on u.domain = m.university_domain
  join public.cities c on c.name = m.city_name
),
resolved_school as (
  select
    r.university_id,
    r.city_id,
    r.city_name,
    coalesce(
      (
        select s.id
        from public.schools s
        where s.university_id = r.university_id
          and s.name = 'Κεντρική Σχολή'
        limit 1
      ),
      (
        select s2.id
        from public.schools s2
        where s2.university_id = r.university_id
        order by s2.created_at asc
        limit 1
      )
    ) as school_id
  from resolved r
)
insert into public.departments (name, school_id, city_id)
select
  'Τμήμα ' || city_name,
  school_id,
  city_id
from resolved_school
where school_id is not null
on conflict (school_id, name, city_id) do nothing;

-- 3) Enriched school catalog from updated list (high-level schools).
with school_seed (university_domain, school_name) as (
  values
    ('uoa.gr', 'Φιλοσοφική Σχολή'),
    ('uoa.gr', 'Νομική Σχολή'),
    ('uoa.gr', 'Σχολή Θετικών Επιστημών'),
    ('uoa.gr', 'Σχολή Επιστημών Υγείας'),
    ('uoa.gr', 'Σχολή Οικονομικών και Πολιτικών Επιστημών'),

    ('ntua.gr', 'Σχολή Πολιτικών Μηχανικών'),
    ('ntua.gr', 'Σχολή Ηλεκτρολόγων Μηχανικών και Μηχανικών Υπολογιστών'),
    ('ntua.gr', 'Σχολή Μηχανολόγων Μηχανικών'),

    ('aueb.gr', 'Σχολή Οικονομικών Επιστημών'),
    ('aueb.gr', 'Σχολή Διοίκησης Επιχειρήσεων'),
    ('aueb.gr', 'Σχολή Πληροφορικής'),
    ('aueb.gr', 'Σχολή Στατιστικής'),

    ('panteion.gr', 'Σχολή Διεθνών Σπουδών'),
    ('panteion.gr', 'Σχολή Κοινωνικών Επιστημών'),
    ('panteion.gr', 'Σχολή Πολιτικής Επιστήμης'),
    ('panteion.gr', 'Σχολή Επικοινωνίας'),

    ('unipi.gr', 'Σχολή Ναυτιλιακών Σπουδών'),
    ('unipi.gr', 'Σχολή Οικονομικών Επιστημών'),
    ('unipi.gr', 'Σχολή Χρηματοοικονομικής'),
    ('unipi.gr', 'Σχολή Στατιστικής'),
    ('unipi.gr', 'Σχολή Πληροφορικής'),

    ('aua.gr', 'Σχολή Γεωπονικών Επιστημών'),
    ('aua.gr', 'Σχολή Επιστήμης Τροφίμων'),
    ('aua.gr', 'Σχολή Περιβάλλοντος'),

    ('hua.gr', 'Σχολή Διαιτολογίας και Διατροφής'),
    ('hua.gr', 'Σχολή Γεωγραφίας'),
    ('hua.gr', 'Σχολή Ψηφιακών Τεχνολογιών'),

    ('asfa.gr', 'Σχολή Εικαστικών Τεχνών'),
    ('asfa.gr', 'Σχολή Ιστορίας της Τέχνης'),

    ('eap.gr', 'Σχολή Ανθρωπιστικών Επιστημών'),
    ('eap.gr', 'Σχολή Κοινωνικών Επιστημών'),
    ('eap.gr', 'Σχολή Θετικών Επιστημών'),
    ('eap.gr', 'Σχολή Εφαρμοσμένων Τεχνών'),

    ('auth.gr', 'Θεολογική Σχολή'),
    ('auth.gr', 'Νομική Σχολή'),
    ('auth.gr', 'Ιατρική Σχολή'),
    ('auth.gr', 'Πολυτεχνική Σχολή'),
    ('auth.gr', 'Φιλοσοφική Σχολή'),
    ('auth.gr', 'Σχολή Επιστημών Υγείας'),

    ('uom.edu.gr', 'Σχολή Οικονομικών Επιστημών'),
    ('uom.edu.gr', 'Σχολή Διοίκησης'),
    ('uom.edu.gr', 'Σχολή Κοινωνικών Επιστημών'),
    ('uom.edu.gr', 'Σχολή Πληροφορικής'),

    ('ihu.gr', 'Σχολή Οικονομικών Επιστημών'),
    ('ihu.gr', 'Σχολή Διοίκησης'),
    ('ihu.gr', 'Σχολή Επιστημών Υγείας'),
    ('ihu.gr', 'Σχολή Ανθρωπιστικών Επιστημών'),
    ('ihu.gr', 'Σχολή Θετικών Επιστημών'),

    ('duth.gr', 'Νομική Σχολή'),
    ('duth.gr', 'Ιατρική Σχολή'),
    ('duth.gr', 'Πολυτεχνική Σχολή'),
    ('duth.gr', 'Σχολή Επιστημών Αγωγής'),

    ('uth.gr', 'Σχολή Γεωπονικών Επιστημών'),
    ('uth.gr', 'Σχολή Επιστημών Υγείας'),
    ('uth.gr', 'Σχολή Θετικών Επιστημών'),
    ('uth.gr', 'Σχολή Ανθρωπιστικών και Κοινωνικών Επιστημών'),

    ('uoi.gr', 'Φιλοσοφική Σχολή'),
    ('uoi.gr', 'Σχολή Επιστημών Υγείας'),
    ('uoi.gr', 'Σχολή Θετικών Επιστημών'),
    ('uoi.gr', 'Σχολή Κοινωνικών Επιστημών'),

    ('uop.gr', 'Σχολή Οικονομίας'),
    ('uop.gr', 'Σχολή Ανθρωπιστικών Επιστημών'),
    ('uop.gr', 'Σχολή Κοινωνικών Επιστημών'),
    ('uop.gr', 'Σχολή Επιστήμης και Τεχνολογίας'),

    ('aegean.gr', 'Σχολή Κοινωνικών Επιστημών'),
    ('aegean.gr', 'Σχολή Περιβάλλοντος'),
    ('aegean.gr', 'Σχολή Θαλάσσιων Σπουδών'),
    ('aegean.gr', 'Σχολή Ανθρωπιστικών Επιστημών'),

    ('uoc.gr', 'Φιλοσοφική Σχολή'),
    ('uoc.gr', 'Σχολή Θετικών Επιστημών'),
    ('uoc.gr', 'Σχολή Επιστημών Υγείας'),
    ('uoc.gr', 'Σχολή Κοινωνικών Επιστημών'),

    ('tuc.gr', 'Σχολή Μηχανικών Παραγωγής'),
    ('tuc.gr', 'Σχολή Μηχανικών Ορυκτών Πόρων'),
    ('tuc.gr', 'Σχολή Περιβάλλοντος'),
    ('tuc.gr', 'Σχολή Ηλεκτρονικών Μηχανικών'),

    ('hmu.gr', 'Σχολή Επιστημών Υγείας'),
    ('hmu.gr', 'Σχολή Μηχανικών'),
    ('hmu.gr', 'Σχολή Διοίκησης'),
    ('hmu.gr', 'Σχολή Γεωπονικών Επιστημών'),

    ('upatras.gr', 'Πολυτεχνική Σχολή'),
    ('upatras.gr', 'Σχολή Θετικών Επιστημών'),
    ('upatras.gr', 'Σχολή Επιστημών Υγείας'),
    ('upatras.gr', 'Σχολή Κοινωνικών και Ανθρωπιστικών Επιστημών'),

    ('uowm.gr', 'Πολυτεχνική Σχολή'),
    ('uowm.gr', 'Σχολή Κοινωνικών και Ανθρωπιστικών Επιστημών'),
    ('uowm.gr', 'Σχολή Οικονομικών Επιστημών'),
    ('uowm.gr', 'Σχολή Καλών Τεχνών'),

    ('ionio.gr', 'Σχολή Μουσικής'),
    ('ionio.gr', 'Σχολή Οπτικοακουστικών Τεχνών'),
    ('ionio.gr', 'Σχολή Ιστορίας'),
    ('ionio.gr', 'Σχολή Μετάφρασης'),
    ('ionio.gr', 'Σχολή Πληροφορικής')
)
insert into public.schools (name, university_id)
select
  s.school_name,
  u.id
from school_seed s
join public.universities u on u.domain = s.university_domain
on conflict (name, university_id) do nothing;

-- 4) Explicit fix from report: UOWM + Kastoria should expose Economics school.
with target_school as (
  select s.id as school_id
  from public.schools s
  join public.universities u on u.id = s.university_id
  where u.domain = 'uowm.gr'
    and s.name = 'Σχολή Οικονομικών Επιστημών'
  order by s.created_at asc
  limit 1
),
target_city as (
  select c.id as city_id
  from public.cities c
  where c.name = 'Καστοριά'
  limit 1
)
insert into public.departments (name, school_id, city_id)
select
  'Τμήμα Οικονομικών Καστοριάς',
  ts.school_id,
  tc.city_id
from target_school ts
cross join target_city tc
on conflict (school_id, name, city_id) do nothing;
