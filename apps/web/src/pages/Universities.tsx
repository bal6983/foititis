import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'
import {
  fetchDepartmentsForSchool,
  fetchSchoolsForUniversity,
} from '../lib/universityLookup'

type UniversityRow = {
  id: string
  name: string
  city_id: string | null
}

type SchoolRow = {
  id: string
  name: string
  university_id: string
}

type CityRow = {
  id: string
  name: string
}

type OptionItem = {
  id: string
  name: string
}

type DirectoryStudentRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  school_id: string | null
  department_id: string | null
  university_id: string | null
  city_id: string | null
  study_year: number | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
}

const PAGE_SIZE = 18

export default function Universities() {
  const { t } = useI18n()
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [universities, setUniversities] = useState<UniversityRow[]>([])
  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [cities, setCities] = useState<CityRow[]>([])
  const [students, setStudents] = useState<DirectoryStudentRow[]>([])
  const [selectedUniversityId, setSelectedUniversityId] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [selectedCityId, setSelectedCityId] = useState('')
  const [departments, setDepartments] = useState<OptionItem[]>([])
  const [availableCityIds, setAvailableCityIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const universitiesById = useMemo(
    () => new Map(universities.map((university) => [university.id, university.name])),
    [universities],
  )
  const schoolsById = useMemo(
    () => new Map(schools.map((school) => [school.id, school.name])),
    [schools],
  )
  const departmentsById = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name])),
    [departments],
  )
  const citiesById = useMemo(() => new Map(cities.map((city) => [city.id, city.name])), [cities])

  const selectedUniversityName = selectedUniversityId
    ? (universitiesById.get(selectedUniversityId) ?? '')
    : ''

  const cityOptions = useMemo(() => {
    if (!selectedUniversityId) return cities
    if (availableCityIds.length === 0) {
      const uniCityId = universities.find((university) => university.id === selectedUniversityId)?.city_id
      return uniCityId ? cities.filter((city) => city.id === uniCityId) : cities
    }
    const available = new Set(availableCityIds)
    return cities.filter((city) => available.has(city.id))
  }, [availableCityIds, cities, selectedUniversityId, universities])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const fromRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const toRow = totalCount === 0 ? 0 : Math.min(page * PAGE_SIZE, totalCount)

  const loadLookups = useCallback(async () => {
    setIsBootstrapping(true)
    setErrorMessage('')

    const [universitiesRes, citiesRes] = await Promise.all([
      supabase.from('universities').select('id, name, city_id').order('name', { ascending: true }),
      supabase.from('cities').select('id, name').order('name', { ascending: true }),
    ])

    if (universitiesRes.error || citiesRes.error) {
      const details = universitiesRes.error?.message ?? citiesRes.error?.message
        setErrorMessage(
          t({
            en: `Unable to load directory filters${details ? ` (${details})` : ''}.`,
            el: `Αδυναμία φόρτωσης φίλτρων καταλόγου${details ? ` (${details})` : ''}.`,
          }),
        )
      setUniversities([])
      setCities([])
      setIsBootstrapping(false)
      return
    }

    const universityRows = (universitiesRes.data ?? []) as UniversityRow[]
    const cityRows = (citiesRes.data ?? []) as CityRow[]
    setUniversities(universityRows)
    setCities(cityRows)

    if (
      selectedUniversityId &&
      !universityRows.some((university) => university.id === selectedUniversityId)
    ) {
      setSelectedUniversityId('')
      setSelectedSchoolId('')
      setSelectedCityId('')
      setPage(1)
    }

    setIsBootstrapping(false)
  }, [selectedUniversityId, t])

  useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  useEffect(() => {
    const channel = supabase
      .channel('universities-directory-lookups')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'universities' },
        () => {
          void loadLookups()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadLookups])

  useEffect(() => {
    if (!selectedUniversityId) {
      setSchools([])
      setSelectedSchoolId('')
      setDepartments([])
      setSelectedDepartmentId('')
      setAvailableCityIds([])
      return
    }

    let isMounted = true

    const run = async () => {
      const { data, error } = await fetchSchoolsForUniversity(selectedUniversityId)

      if (!isMounted) return

      if (error) {
        setErrorMessage(
          t({
            en: `Unable to load schools (${error.message}).`,
            el: `Αδυναμία φόρτωσης σχολών (${error.message}).`,
          }),
        )
        setSchools([])
        setSelectedSchoolId('')
        return
      }

      const nextSchools = (data ?? []) as SchoolRow[]
      setSchools(nextSchools)

      const schoolIds = nextSchools.map((school) => school.id)
      const uniCityId = universities.find((university) => university.id === selectedUniversityId)?.city_id
      let nextCityIds: string[] = []

      if (schoolIds.length > 0) {
        const { data: departmentRows, error: departmentsError } = await supabase
          .from('departments')
          .select('city_id')
          .in('school_id', schoolIds)

        if (!departmentsError) {
          nextCityIds = Array.from(
            new Set(
              (departmentRows ?? [])
                .map((row) => row.city_id)
                .filter((value): value is string => typeof value === 'string' && value.length > 0),
            ),
          )
        }
      }

      if (uniCityId) {
        nextCityIds = Array.from(new Set([uniCityId, ...nextCityIds]))
      }

      setAvailableCityIds(nextCityIds)
      if (selectedCityId && nextCityIds.length > 0 && !nextCityIds.includes(selectedCityId)) {
        setSelectedCityId(uniCityId ?? '')
      }

      if (selectedSchoolId && !nextSchools.some((school) => school.id === selectedSchoolId)) {
        setSelectedSchoolId('')
        setSelectedDepartmentId('')
      }
    }

    void run()

    return () => {
      isMounted = false
    }
  }, [selectedCityId, selectedSchoolId, selectedUniversityId, t, universities])

  useEffect(() => {
    if (!selectedSchoolId) {
      setDepartments([])
      setSelectedDepartmentId('')
      return
    }

    let isMounted = true

    const run = async () => {
      const { data, error } = await fetchDepartmentsForSchool(selectedSchoolId, {
        cityId: selectedCityId || null,
      })

      if (!isMounted) return

      if (error) {
        setErrorMessage(
          t({
            en: `Unable to load departments (${error.message}).`,
            el: `Αδυναμία φόρτωσης τμημάτων (${error.message}).`,
          }),
        )
        setDepartments([])
        return
      }

      const nextDepartments = (data ?? []) as OptionItem[]
      setDepartments(nextDepartments)
      if (
        selectedDepartmentId &&
        !nextDepartments.some((department) => department.id === selectedDepartmentId)
      ) {
        setSelectedDepartmentId('')
      }
    }

    void run()

    return () => {
      isMounted = false
    }
  }, [selectedCityId, selectedDepartmentId, selectedSchoolId, t])

  useEffect(() => {
    if (!selectedUniversityId) {
      setStudents([])
      setTotalCount(0)
      setIsLoadingStudents(false)
      return
    }

    let isMounted = true
    setIsLoadingStudents(true)

    const run = async () => {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('public_profiles')
        .select(
          'id, display_name, avatar_url, school_id, department_id, university_id, city_id, study_year, is_verified_student, is_pre_student',
          { count: 'exact' },
        )
        .eq('is_verified_student', true)
        .eq('is_pre_student', false)
        .eq('university_id', selectedUniversityId)

      if (selectedSchoolId) {
        query = query.eq('school_id', selectedSchoolId)
      }

      if (selectedDepartmentId) {
        query = query.eq('department_id', selectedDepartmentId)
      }

      if (selectedCityId) {
        query = query.eq('city_id', selectedCityId)
      }

      const { data, error, count } = await query
        .order('display_name', { ascending: true, nullsFirst: false })
        .range(from, to)

      if (!isMounted) return

      if (error) {
        setErrorMessage(
          t({
            en: `Unable to load students (${error.message}).`,
            el: `Αδυναμία φόρτωσης φοιτητών (${error.message}).`,
          }),
        )
        setStudents([])
        setTotalCount(0)
        setIsLoadingStudents(false)
        return
      }

      setStudents((data ?? []) as DirectoryStudentRow[])
      setTotalCount(count ?? 0)
      setIsLoadingStudents(false)
    }

    void run()

    return () => {
      isMounted = false
    }
  }, [page, selectedCityId, selectedDepartmentId, selectedSchoolId, selectedUniversityId, t])

  useEffect(() => {
    if (page <= totalPages) return
    setPage(totalPages)
  }, [page, totalPages])

  const handleUniversitySelect = (universityId: string) => {
    setSelectedUniversityId(universityId)
    setSelectedSchoolId('')
    setSelectedDepartmentId('')
    setSelectedCityId('')
    setPage(1)
    setErrorMessage('')
  }

  const handleSchoolChange = (schoolId: string) => {
    setSelectedSchoolId(schoolId)
    setSelectedDepartmentId('')
    setPage(1)
  }

  const handleDepartmentChange = (departmentId: string) => {
    setSelectedDepartmentId(departmentId)
    setPage(1)
  }

  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId)
    setPage(1)
  }

  const handleClearFilters = () => {
    setSelectedSchoolId('')
    setSelectedDepartmentId('')
    setSelectedCityId('')
    setPage(1)
  }

  return (
    <section className="space-y-4">
      <header className="social-card space-y-3 p-5">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Universities', el: 'Πανεπιστήμια' })}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({
            en: 'Dynamic student directory by university, school, and city.',
            el: 'Δυναμικός κατάλογος φοιτητών ανά πανεπιστήμιο, σχολή και πόλη.',
          })}
        </p>

        {errorMessage ? (
          <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}
      </header>

      <section className="social-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {t({ en: 'Select university', el: 'Επιλογή πανεπιστημίου' })}
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">
            {t({
              en: `${universities.length} universities`,
              el: `${universities.length} πανεπιστήμια`,
            })}
          </span>
        </div>

        {isBootstrapping ? (
          <p className="text-sm text-[var(--text-secondary)]">
            {t({ en: 'Loading universities...', el: 'Φόρτωση πανεπιστημίων...' })}
          </p>
        ) : universities.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            {t({
              en: 'No universities available yet.',
              el: 'Δεν υπάρχουν διαθέσιμα πανεπιστήμια ακόμα.',
            })}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {universities.map((university) => {
              const isActive = selectedUniversityId === university.id
              return (
                <button
                  key={university.id}
                  type="button"
                  onClick={() => handleUniversitySelect(university.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                    isActive
                      ? 'border-[var(--accent)] bg-[var(--surface-soft)] text-[var(--text-primary)]'
                      : 'border-[var(--border-primary)] bg-[var(--surface-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="truncate">{university.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="social-card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              {t({ en: 'School', el: 'Σχολή' })}
            </label>
            <select
              value={selectedSchoolId}
              onChange={(event) => handleSchoolChange(event.target.value)}
              disabled={!selectedUniversityId}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
            >
              <option value="">
                {t({ en: 'All schools', el: 'Όλες οι σχολές' })}
              </option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              {t({ en: 'Department', el: 'Τμήμα' })}
            </label>
            <select
              value={selectedDepartmentId}
              onChange={(event) => handleDepartmentChange(event.target.value)}
              disabled={!selectedSchoolId}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
            >
              <option value="">
                {t({ en: 'All departments', el: 'Όλα τα τμήματα' })}
              </option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              {t({ en: 'City', el: 'Πόλη' })}
            </label>
            <select
              value={selectedCityId}
              onChange={(event) => handleCityChange(event.target.value)}
              disabled={!selectedUniversityId}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60"
            >
              <option value="">
                {t({ en: 'All cities', el: 'Όλες οι πόλεις' })}
              </option>
              {cityOptions.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            disabled={!selectedUniversityId}
            className="mt-5 rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {t({ en: 'Clear filters', el: 'Καθαρισμός φίλτρων' })}
          </button>
        </div>

        {!selectedUniversityId ? (
          <p className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            {t({
              en: 'Choose a university to view verified students.',
              el: 'Επίλεξε πανεπιστήμιο για να δεις επαληθευμένους φοιτητές.',
            })}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--text-secondary)]">
                {selectedUniversityName}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {t({
                  en: `${fromRow}-${toRow} of ${totalCount}`,
                  el: `${fromRow}-${toRow} από ${totalCount}`,
                })}
              </p>
            </div>

            {isLoadingStudents ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t({ en: 'Loading students...', el: 'Φόρτωση φοιτητών...' })}
              </p>
            ) : students.length === 0 ? (
              <p className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                {t({
                  en: 'No verified students found for the selected filters.',
                  el: 'Δεν βρέθηκαν επαληθευμένοι φοιτητές για τα επιλεγμένα φίλτρα.',
                })}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {students.map((student) => {
                  const name = student.display_name ?? t({ en: 'Student', el: 'Φοιτητής' })
                  const schoolLabel = student.school_id
                    ? (schoolsById.get(student.school_id) ?? t({ en: 'School', el: 'Σχολή' }))
                    : t({ en: 'School not set', el: 'Χωρίς σχολή' })
                  const departmentLabel = student.department_id
                    ? (departmentsById.get(student.department_id) ??
                      t({ en: 'Department', el: 'Τμήμα' }))
                    : t({ en: 'Department not set', el: 'Χωρίς τμήμα' })
                  const cityLabel = student.city_id
                    ? (citiesById.get(student.city_id) ?? t({ en: 'City', el: 'Πόλη' }))
                    : t({ en: 'City not set', el: 'Χωρίς πόλη' })

                  return (
                    <article key={student.id} className="social-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/profile/${student.id}`} className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Avatar name={name} url={student.avatar_url} size="md" showRing />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                {name}
                              </p>
                              <p className="truncate text-xs text-[var(--text-secondary)]">
                                {schoolLabel}
                              </p>
                            </div>
                          </div>
                        </Link>

                        <span className="badge-pill badge-pill--verified">
                          {t({ en: 'Verified', el: 'Επαληθευμένος' })}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                          {student.study_year
                            ? t({
                                en: `Year ${student.study_year}`,
                                el: `Έτος ${student.study_year}`,
                              })
                            : t({ en: 'Year not set', el: 'Χωρίς έτος' })}
                        </span>
                        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                          {cityLabel}
                        </span>
                        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                          {departmentLabel}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                disabled={page <= 1 || isLoadingStudents}
                className="rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                {t({ en: 'Previous', el: 'Προηγούμενη' })}
              </button>
              <span className="text-xs text-[var(--text-secondary)]">
                {t({
                  en: `Page ${page} of ${totalPages}`,
                  el: `Σελίδα ${page} από ${totalPages}`,
                })}
              </span>
              <button
                type="button"
                onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={page >= totalPages || isLoadingStudents}
                className="rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                {t({ en: 'Next', el: 'Επόμενη' })}
              </button>
            </div>
          </>
        )}
      </section>
    </section>
  )
}
