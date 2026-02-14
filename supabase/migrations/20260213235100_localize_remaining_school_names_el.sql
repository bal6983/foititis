-- ============================================================
-- LOCALIZE REMAINING ENGLISH SCHOOL LABELS
-- ============================================================

create temp table tmp_school_name_map_remaining (
  en_name text primary key,
  el_name text not null
) on commit drop;

insert into tmp_school_name_map_remaining (en_name, el_name)
values
  ('School of Agriculture', 'Σχολή Γεωπονίας'),
  ('School of Agriculture and Food', 'Σχολή Γεωπονίας και Τροφίμων'),
  ('School of Economics', 'Σχολή Οικονομικών Επιστημών'),
  ('School of Economics and Business Administration', 'Σχολή Οικονομικών και Διοίκησης Επιχειρήσεων'),
  ('School of Social Sciences and Humanities', 'Σχολή Κοινωνικών και Ανθρωπιστικών Επιστημών');

create temp table tmp_school_merge_remaining as
select
  src.id as src_id,
  tgt.id as tgt_id
from public.schools src
join tmp_school_name_map_remaining m on m.en_name = src.name
join public.schools tgt
  on tgt.university_id = src.university_id
 and tgt.name = m.el_name
 and tgt.id <> src.id;

update public.profiles p
set school_id = tm.tgt_id
from tmp_school_merge_remaining tm
where p.school_id = tm.src_id;

insert into public.departments (name, school_id, city_id, created_at)
select
  d.name,
  tm.tgt_id,
  d.city_id,
  d.created_at
from public.departments d
join tmp_school_merge_remaining tm on tm.src_id = d.school_id
on conflict (school_id, name, city_id) do nothing;

delete from public.departments d
using tmp_school_merge_remaining tm
where d.school_id = tm.src_id;

delete from public.schools s
using tmp_school_merge_remaining tm
where s.id = tm.src_id;

update public.schools s
set name = m.el_name
from tmp_school_name_map_remaining m
where s.name = m.en_name;
