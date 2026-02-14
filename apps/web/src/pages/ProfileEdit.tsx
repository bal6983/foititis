import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'
import {
  fetchDepartmentsForSchool,
  fetchSchoolsForUniversity,
  fetchUniversitiesForCity,
} from '../lib/universityLookup'

type OptionItem = {
  id: string
  name: string
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

export default function ProfileEdit() {
  const { t } = useI18n()
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [cityId, setCityId] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [cities, setCities] = useState<OptionItem[]>([])
  const [universities, setUniversities] = useState<OptionItem[]>([])
  const [schools, setSchools] = useState<OptionItem[]>([])
  const [departments, setDepartments] = useState<OptionItem[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(true)
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false)
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)
  const [citiesErrorMessage, setCitiesErrorMessage] = useState('')
  const [universitiesErrorMessage, setUniversitiesErrorMessage] = useState('')
  const [schoolsErrorMessage, setSchoolsErrorMessage] = useState('')
  const [departmentsErrorMessage, setDepartmentsErrorMessage] = useState('')
  const [userId, setUserId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPreStudentSetup = searchParams.get('setup') === 'prestudent'
  const redirectTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadCities = async () => {
      setIsLoadingCities(true)
      setCitiesErrorMessage('')

      const { data, error } = await supabase
        .from('cities')
        .select('id, name')
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setCitiesErrorMessage(
          t({
            en: `Unable to load cities.${details}`,
            el: `Δεν ήταν δυνατή η φόρτωση των πόλεων.${details}`,
          }),
        )
        setIsLoadingCities(false)
        return
      }

      setCities(uniqueById(data ?? []))
      setIsLoadingCities(false)
    }

    void loadCities()

    return () => {
      isMounted = false
    }
  }, [t])

  useEffect(() => {
    let isMounted = true

    if (!cityId) {
      setUniversities([])
      setIsLoadingUniversities(false)
      return
    }

    const loadUniversities = async () => {
      setIsLoadingUniversities(true)
      setUniversitiesErrorMessage('')

      const { data, error } = await fetchUniversitiesForCity(cityId)

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setUniversitiesErrorMessage(
          t({
            en: `Unable to load universities.${details}`,
            el: `Δεν ήταν δυνατή η φόρτωση των πανεπιστημίων.${details}`,
          }),
        )
        setIsLoadingUniversities(false)
        return
      }

      setUniversities(uniqueById((data ?? []) as OptionItem[]))
      setIsLoadingUniversities(false)
    }

    void loadUniversities()

    return () => {
      isMounted = false
    }
  }, [cityId, t])

  useEffect(() => {
    let isMounted = true

    if (!universityId) {
      setSchools([])
      setIsLoadingSchools(false)
      return
    }

    const loadSchools = async () => {
      setIsLoadingSchools(true)
      setSchoolsErrorMessage('')

      const { data, error } = await fetchSchoolsForUniversity(universityId, {
        cityId: cityId || null,
      })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setSchoolsErrorMessage(
          t({
            en: `Unable to load schools.${details}`,
            el: `Δεν ήταν δυνατή η φόρτωση των σχολών.${details}`,
          }),
        )
        setIsLoadingSchools(false)
        return
      }

      setSchools(uniqueById(data ?? []))
      setIsLoadingSchools(false)
    }

    void loadSchools()

    return () => {
      isMounted = false
    }
  }, [cityId, universityId, t])

  useEffect(() => {
    let isMounted = true

    if (!schoolId) {
      setDepartments([])
      setIsLoadingDepartments(false)
      return
    }

    const loadDepartments = async () => {
      setIsLoadingDepartments(true)
      setDepartmentsErrorMessage('')

      const { data, error } = await fetchDepartmentsForSchool(schoolId, {
        cityId: cityId || null,
      })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setDepartmentsErrorMessage(
          t({
            en: `Unable to load departments.${details}`,
            el: `Αδυναμία φόρτωσης τμημάτων.${details}`,
          }),
        )
        setIsLoadingDepartments(false)
        return
      }

      setDepartments(uniqueById((data ?? []) as OptionItem[]))
      setIsLoadingDepartments(false)
    }

    void loadDepartments()

    return () => {
      isMounted = false
    }
  }, [cityId, schoolId, t])

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(
          t({
            en: `Unable to load current user.${details}`,
            el: `Δεν ήταν δυνατή η φόρτωση του χρήστη.${details}`,
          }),
        )
        setIsLoading(false)
        return
      }

      setUserId(userData.user.id)

      let profileRes = await supabase
        .from('profiles')
        .select(
          'full_name, display_name, bio, city_id, university_id, school_id, department_id, is_verified_student',
        )
        .eq('id', userData.user.id)
        .maybeSingle()

      if (profileRes.error) {
        const joined = `${profileRes.error.message ?? ''} ${profileRes.error.details ?? ''}`.toLowerCase()
        if (joined.includes('bio') && joined.includes('does not exist')) {
          profileRes = (await supabase
            .from('profiles')
            .select(
              'full_name, display_name, city_id, university_id, school_id, department_id, is_verified_student',
            )
            .eq('id', userData.user.id)
            .maybeSingle()) as typeof profileRes
        }
      }

      if (!isMounted) return

      if (profileRes.error || !profileRes.data) {
        const details = profileRes.error?.message ? ` (${profileRes.error.message})` : ''
        setErrorMessage(
          t({
            en: `Unable to load profile.${details}`,
            el: `Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`,
          }),
        )
        setIsLoading(false)
        return
      }

      const profile = profileRes.data as {
        full_name: string | null
        display_name: string | null
        bio?: string | null
        city_id: string | null
        university_id: string | null
        school_id: string | null
        department_id: string | null
        is_verified_student: boolean | null
      }

      setFullName(profile.full_name ?? '')
      setDisplayName(profile.display_name ?? '')
      setBio(profile.bio ?? '')
      setCityId(profile.city_id ?? '')
      setUniversityId(profile.university_id ?? '')
      setSchoolId(profile.school_id ?? '')
      setDepartmentId(profile.department_id ?? '')
      setIsVerifiedStudent(profile.is_verified_student === true)
      setIsLoading(false)
    }

    void loadProfile()

    return () => {
      isMounted = false
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [t])

  const handleCityChange = (value: string) => {
    setCityId(value)
    setUniversityId('')
    setSchoolId('')
    setDepartmentId('')
    setSchools([])
    setDepartments([])
  }

  const handleUniversityChange = (value: string) => {
    setUniversityId(value)
    setSchoolId('')
    setDepartmentId('')
    setDepartments([])
  }

  const handleSchoolChange = (value: string) => {
    setSchoolId(value)
    setDepartmentId('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const trimmedFullName = fullName.trim()
    const trimmedDisplayName = displayName.trim()

    if (!trimmedFullName) {
      setErrorMessage(t({ en: 'Full name is required.', el: 'Το ονοματεπώνυμο είναι υποχρεωτικό.' }))
      return
    }

    if (!trimmedDisplayName) {
      setErrorMessage(t({ en: 'Display name is required.', el: 'Το όνομα εμφάνισης είναι υποχρεωτικό.' }))
      return
    }

    const hasAcademicSelection =
      cityId.trim() !== '' ||
      universityId.trim() !== '' ||
      schoolId.trim() !== '' ||
      departmentId.trim() !== ''

    if (
      (isPreStudentSetup || hasAcademicSelection) &&
      (!cityId || !universityId || !schoolId || !departmentId)
    ) {
      setErrorMessage(
        t({
          en: 'Fill in city, university, school and department.',
          el: 'Συμπλήρωσε πόλη, πανεπιστήμιο, σχολή και τμήμα.',
        }),
      )
      return
    }

    if (!userId) {
      setErrorMessage(
        t({
          en: 'Unable to identify current user.',
          el: 'Δεν ήταν δυνατή η αναγνώριση του χρήστη.',
        }),
      )
      return
    }

    setIsSubmitting(true)
    if (redirectTimeoutRef.current !== null) {
      window.clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: trimmedFullName,
        display_name: trimmedDisplayName,
        bio: bio.trim() || null,
        city_id: cityId || null,
        university_id: universityId || null,
        school_id: schoolId || null,
        department_id: departmentId || null,
      })
      .eq('id', userId)

    if (error) {
      const details = error.message ? ` (${error.message})` : ''
      setErrorMessage(
        t({
          en: `Unable to update profile.${details}`,
          el: `Δεν ήταν δυνατή η ενημέρωση του προφίλ.${details}`,
        }),
      )
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setSuccessMessage(t({ en: 'Profile updated successfully.', el: 'Το προφίλ ενημερώθηκε επιτυχώς.' }))
    redirectTimeoutRef.current = window.setTimeout(() => {
      navigate(isPreStudentSetup ? '/dashboard' : '/profile')
    }, 900)
  }

  if (isLoading) {
    return (
      <section className="space-y-2 text-[var(--text-primary)]">
        <h1 className="text-xl font-semibold">{t({ en: 'Loading profile...', el: 'Φόρτωση προφίλ...' })}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({
            en: 'Preparing profile edit form.',
            el: 'Προετοιμάζουμε τη φόρμα επεξεργασίας.',
          })}
        </p>
      </section>
    )
  }

  const isCoreLocked = isVerifiedStudent
  const isUniversityDisabled = isCoreLocked || !cityId || isLoadingUniversities
  const isSchoolDisabled = isCoreLocked || !universityId || isLoadingSchools
  const isDepartmentDisabled = isCoreLocked || !schoolId || isLoadingDepartments

  const fieldClass =
    'mt-1 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-blue-400/60 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed'

  return (
    <section className="space-y-6 text-[var(--text-primary)]">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t({ en: 'Edit profile', el: 'Επεξεργασία προφίλ' })}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({
            en: 'Update your basic profile information.',
            el: 'Ενημέρωσε τα βασικά στοιχεία του προφίλ σου.',
          })}
        </p>
      </header>

      {isCoreLocked ? (
        <p className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {t({
            en: 'Verified profile details are locked. To change them, submit a change request.',
            el: 'Τα στοιχεία επαληθευμένου προφίλ είναι κλειδωμένα. Για αλλαγές απαιτείται αίτημα.',
          })}
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          {t({ en: 'Full name', el: 'Ονοματεπώνυμο' })}
          <input
            className={fieldClass}
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            disabled={isCoreLocked}
          />
        </label>

        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          {t({ en: 'Display name', el: 'Όνομα εμφάνισης' })}
          <input
            className={fieldClass}
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            disabled={isCoreLocked}
          />
        </label>

        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          {t({ en: 'Bio (optional)', el: 'Σύντομο bio (προαιρετικό)' })}
          <textarea
            className={`${fieldClass} min-h-[88px] resize-y`}
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 280))}
            placeholder={t({
              en: 'Write a short line about you...',
              el: 'Γράψε μια μικρή περιγραφή για εσένα...',
            })}
          />
          <span className="text-xs text-[var(--text-secondary)]">{bio.length}/280</span>
        </label>

        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          {t({ en: 'Study city', el: 'Πόλη σπουδών' })}
          <select
            className={fieldClass}
            value={cityId}
            onChange={(event) => handleCityChange(event.target.value)}
            disabled={isLoadingCities || isCoreLocked}
            required={isPreStudentSetup}
          >
            <option value="">{t({ en: 'Select city', el: 'Επίλεξε πόλη' })}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          {citiesErrorMessage ? <span className="text-xs text-rose-300">{citiesErrorMessage}</span> : null}
        </label>

        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          {t({ en: 'University', el: 'Πανεπιστήμιο' })}
          <select
            className={fieldClass}
            value={universityId}
            onChange={(event) => handleUniversityChange(event.target.value)}
            disabled={isUniversityDisabled}
            required={isPreStudentSetup}
          >
            <option value="">{t({ en: 'Select university', el: 'Επίλεξε πανεπιστήμιο' })}</option>
            {universities.map((university) => (
              <option key={university.id} value={university.id}>
                {university.name}
              </option>
            ))}
          </select>
          {universitiesErrorMessage ? <span className="text-xs text-rose-300">{universitiesErrorMessage}</span> : null}
        </label>

        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          {t({ en: 'School', el: 'Σχολή' })}
          <select
            className={fieldClass}
            value={schoolId}
            onChange={(event) => handleSchoolChange(event.target.value)}
            disabled={isSchoolDisabled}
            required={isPreStudentSetup}
          >
            <option value="">{t({ en: 'Select school', el: 'Επίλεξε σχολή' })}</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
          {schoolsErrorMessage ? <span className="text-xs text-rose-300">{schoolsErrorMessage}</span> : null}
        </label>

        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          {t({ en: 'Department', el: 'Τμήμα' })}
          <select
            className={fieldClass}
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            disabled={isDepartmentDisabled}
            required={isPreStudentSetup}
          >
            <option value="">{t({ en: 'Select department', el: 'Επίλεξε τμήμα' })}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          {departmentsErrorMessage ? <span className="text-xs text-rose-300">{departmentsErrorMessage}</span> : null}
        </label>

        <button
          className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? t({ en: 'Saving...', el: 'Γίνεται αποθήκευση...' })
            : t({ en: 'Save changes', el: 'Αποθήκευση αλλαγών' })}
        </button>
      </form>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {successMessage}
        </p>
      ) : null}
    </section>
  )
}
