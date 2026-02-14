-- ============================================================
-- UNIVERSITY SCHOOLS CATALOG + SCHOOL LOOKUP RPC
--
-- Seeds schools per public university and adds a server-side
-- function for city+university aware school lookup.
-- ============================================================

create unique index if not exists idx_schools_university_name_unique
  on public.schools(university_id, name);

with school_seed (university_domain, school_name) as (
  values
    -- EKPA
    ('uoa.gr', 'School of Law'),
    ('uoa.gr', 'School of Economics and Political Sciences'),
    ('uoa.gr', 'School of Health Sciences'),
    ('uoa.gr', 'School of Science'),
    ('uoa.gr', 'School of Philosophy'),
    ('uoa.gr', 'School of Theology'),
    ('uoa.gr', 'School of Education'),
    ('uoa.gr', 'School of Physical Education and Sport Science'),

    -- NTUA
    ('ntua.gr', 'School of Civil Engineering'),
    ('ntua.gr', 'School of Mechanical Engineering'),
    ('ntua.gr', 'School of Electrical and Computer Engineering'),
    ('ntua.gr', 'School of Chemical Engineering'),
    ('ntua.gr', 'School of Architecture'),
    ('ntua.gr', 'School of Rural, Surveying and Geoinformatics Engineering'),
    ('ntua.gr', 'School of Mining and Metallurgical Engineering'),
    ('ntua.gr', 'School of Naval Architecture and Marine Engineering'),
    ('ntua.gr', 'School of Applied Mathematical and Physical Sciences'),

    -- AUTH
    ('auth.gr', 'Faculty of Theology'),
    ('auth.gr', 'Faculty of Philosophy'),
    ('auth.gr', 'Faculty of Sciences'),
    ('auth.gr', 'Faculty of Engineering'),
    ('auth.gr', 'Faculty of Health Sciences'),
    ('auth.gr', 'Faculty of Agriculture, Forestry and Natural Environment'),
    ('auth.gr', 'Faculty of Economics and Political Sciences'),
    ('auth.gr', 'Faculty of Fine Arts'),
    ('auth.gr', 'Faculty of Education'),

    -- University of Patras
    ('upatras.gr', 'School of Engineering'),
    ('upatras.gr', 'School of Natural Sciences'),
    ('upatras.gr', 'School of Health Sciences'),
    ('upatras.gr', 'School of Humanities and Social Sciences'),
    ('upatras.gr', 'School of Economics and Business'),
    ('upatras.gr', 'School of Agricultural Sciences'),

    -- University of Ioannina
    ('uoi.gr', 'School of Philosophy'),
    ('uoi.gr', 'School of Education'),
    ('uoi.gr', 'School of Sciences'),
    ('uoi.gr', 'School of Health Sciences'),
    ('uoi.gr', 'School of Economics and Management'),

    -- DUTH
    ('duth.gr', 'School of Law'),
    ('duth.gr', 'School of Engineering'),
    ('duth.gr', 'School of Health Sciences'),
    ('duth.gr', 'School of Sciences of Agriculture and Forestry'),
    ('duth.gr', 'School of Classical and Humanities Studies'),
    ('duth.gr', 'School of Social, Political and Economic Sciences'),
    ('duth.gr', 'School of Education Sciences'),

    -- University of Crete
    ('uoc.gr', 'School of Philosophy'),
    ('uoc.gr', 'School of Sciences and Engineering'),
    ('uoc.gr', 'School of Health Sciences'),
    ('uoc.gr', 'School of Social Sciences'),
    ('uoc.gr', 'School of Education Sciences'),

    -- Technical University of Crete
    ('tuc.gr', 'School of Production Engineering and Management'),
    ('tuc.gr', 'School of Mineral Resources Engineering'),
    ('tuc.gr', 'School of Electrical and Computer Engineering'),
    ('tuc.gr', 'School of Chemical and Environmental Engineering'),
    ('tuc.gr', 'School of Architecture'),

    -- University of the Aegean
    ('aegean.gr', 'School of Humanities'),
    ('aegean.gr', 'School of Social Sciences'),
    ('aegean.gr', 'School of Sciences'),
    ('aegean.gr', 'School of Engineering'),
    ('aegean.gr', 'School of Environment'),
    ('aegean.gr', 'School of Business'),

    -- University of Thessaly
    ('uth.gr', 'School of Humanities and Social Sciences'),
    ('uth.gr', 'School of Engineering'),
    ('uth.gr', 'School of Health Sciences'),
    ('uth.gr', 'School of Agricultural Sciences'),
    ('uth.gr', 'School of Economic Sciences'),
    ('uth.gr', 'School of Physical Education, Sport Science and Dietetics'),

    -- University of Macedonia
    ('uom.edu.gr', 'School of Economic and Regional Studies'),
    ('uom.edu.gr', 'School of Business Administration'),
    ('uom.edu.gr', 'School of Information Sciences'),
    ('uom.edu.gr', 'School of Social Sciences, Humanities and Arts'),

    -- University of Piraeus
    ('unipi.gr', 'School of Economics, Business and International Studies'),
    ('unipi.gr', 'School of Maritime and Industrial Studies'),
    ('unipi.gr', 'School of Information and Communication Technologies'),

    -- AUEB
    ('aueb.gr', 'School of Business'),
    ('aueb.gr', 'School of Economics'),
    ('aueb.gr', 'School of Information Sciences and Technology'),

    -- Panteion
    ('panteion.gr', 'School of Political Sciences'),
    ('panteion.gr', 'School of Social Sciences'),
    ('panteion.gr', 'School of International Studies, Communication and Culture'),

    -- AUA
    ('aua.gr', 'School of Plant Sciences'),
    ('aua.gr', 'School of Animal Biosciences'),
    ('aua.gr', 'School of Food and Nutrition Sciences'),
    ('aua.gr', 'School of Applied Economics and Social Sciences'),
    ('aua.gr', 'School of Agricultural Engineering and Environmental Sciences'),

    -- Harokopio
    ('hua.gr', 'School of Health Science and Education'),
    ('hua.gr', 'School of Environment, Geography and Applied Economics'),
    ('hua.gr', 'School of Digital Technology'),

    -- Ionian University
    ('ionio.gr', 'School of History and Translation-Interpreting'),
    ('ionio.gr', 'School of Music and Audiovisual Arts'),
    ('ionio.gr', 'School of Information Science and Informatics'),
    ('ionio.gr', 'School of Environment'),
    ('ionio.gr', 'School of Economics Sciences'),

    -- University of the Peloponnese
    ('uop.gr', 'School of Economics and Technology'),
    ('uop.gr', 'School of Humanities and Cultural Studies'),
    ('uop.gr', 'School of Social and Political Sciences'),
    ('uop.gr', 'School of Health Sciences'),
    ('uop.gr', 'School of Agriculture and Food'),
    ('uop.gr', 'School of Engineering'),

    -- University of Western Macedonia
    ('uowm.gr', 'School of Engineering'),
    ('uowm.gr', 'School of Sciences'),
    ('uowm.gr', 'School of Social Sciences and Humanities'),
    ('uowm.gr', 'School of Health Sciences'),
    ('uowm.gr', 'School of Fine Arts'),
    ('uowm.gr', 'School of Agriculture'),

    -- Hellenic Mediterranean University
    ('hmu.gr', 'School of Engineering'),
    ('hmu.gr', 'School of Health Sciences'),
    ('hmu.gr', 'School of Agricultural Sciences'),
    ('hmu.gr', 'School of Management and Economics'),
    ('hmu.gr', 'School of Music and Audiovisual Technologies'),

    -- UniWA
    ('uniwa.gr', 'School of Engineering'),
    ('uniwa.gr', 'School of Health and Care Sciences'),
    ('uniwa.gr', 'School of Administrative, Economics and Social Sciences'),
    ('uniwa.gr', 'School of Applied Arts and Culture'),
    ('uniwa.gr', 'School of Food Sciences'),

    -- IHU
    ('ihu.gr', 'School of Science and Technology'),
    ('ihu.gr', 'School of Economics and Business Administration'),
    ('ihu.gr', 'School of Social Sciences'),
    ('ihu.gr', 'School of Health Sciences'),
    ('ihu.gr', 'School of Agricultural Sciences'),
    ('ihu.gr', 'School of Design Sciences'),
    ('ihu.gr', 'School of Information Sciences'),

    -- HOU
    ('eap.gr', 'School of Humanities'),
    ('eap.gr', 'School of Social Sciences'),
    ('eap.gr', 'School of Science and Technology'),
    ('eap.gr', 'School of Applied Arts'),
    ('eap.gr', 'School of Health Sciences'),

    -- ASFA
    ('asfa.gr', 'School of Fine Arts'),
    ('asfa.gr', 'School of Art Theory and History')
)
insert into public.schools (name, university_id)
select
  s.school_name,
  u.id
from school_seed s
join public.universities u on u.domain = s.university_domain
on conflict (university_id, name) do nothing;

create or replace function public.get_schools_for_university_city(
  p_university_id uuid,
  p_city_id uuid default null
)
returns table (
  id uuid,
  name text,
  university_id uuid
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_has_city_specific boolean;
begin
  if p_city_id is null then
    return query
    select s.id, s.name, s.university_id
    from public.schools s
    where s.university_id = p_university_id
    order by s.name;
    return;
  end if;

  select exists (
    select 1
    from public.departments d
    join public.schools s on s.id = d.school_id
    where s.university_id = p_university_id
      and d.city_id = p_city_id
      and s.name <> 'Κεντρική Σχολή'
  )
  into v_has_city_specific;

  if v_has_city_specific then
    return query
    select distinct s.id, s.name, s.university_id
    from public.departments d
    join public.schools s on s.id = d.school_id
    where s.university_id = p_university_id
      and d.city_id = p_city_id
      and s.name <> 'Κεντρική Σχολή'
    order by s.name;
    return;
  end if;

  return query
  select s.id, s.name, s.university_id
  from public.schools s
  where s.university_id = p_university_id
  order by s.name;
end;
$$;

grant execute on function public.get_schools_for_university_city(uuid, uuid) to authenticated;
grant execute on function public.get_schools_for_university_city(uuid, uuid) to anon;
