import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type OnboardingConfirmStorage = {
  city_id: string | null
  city_name: string
  university_id: string | null
  university_name: string
  school_id: string | null
  school_name: string
}

type OptionItem = {
  id: string
  name: string
}

const onboardingConfirmStorageKey = 'onboardingConfirmData'

const normalizeId = (value?: string | null) =>
  value && value.trim() !== '' ? value : null

const loadStoredData = (): OnboardingConfirmStorage | null => {
  try {
    const raw = sessionStorage.getItem(onboardingConfirmStorageKey)
    if (!raw) return null
    return JSON.parse(raw) as OnboardingConfirmStorage
  } catch {
    return null
  }
}

export default function OnboardingConfirm() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [cityId, setCityId] = useState<string | null>(null)
  const [universityId, setUniversityId] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [cityName, setCityName] = useState('')
  const [universityName, setUniversityName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [studyYear, setStudyYear] = useState('')
  const [cities, setCities] = useState<OptionItem[]>([])
  const [universities, setUniversities] = useState<OptionItem[]>([])
  const [schools, setSchools] = useState<OptionItem[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false)
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false
    if (fullName.trim() === '' || displayName.trim() === '') return false
    if (!cityId || !universityId || !schoolId) return false
    if (isPreStudent) return true
    return studyYear.trim() !== ''
  }, [
    cityId,
    displayName,
    fullName,
    isPreStudent,
    isSubmitting,
    schoolId,
    studyYear,
    universityId,
  ])

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const stored = loadStoredData()
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`)
        setIsLoading(false)
        return
      }

      setUserId(userData.user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
          'full_name, display_name, city_id, university_id, school_id, study_year, is_pre_student, is_verified_student',
        )
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`)
        setIsLoading(false)
        return
      }

      const resolvedCityId = normalizeId(stored?.city_id) ?? profile?.city_id ?? null
      const resolvedUniversityId =
        normalizeId(stored?.university_id) ?? profile?.university_id ?? null
      const resolvedSchoolId =
        normalizeId(stored?.school_id) ?? profile?.school_id ?? null
      const resolvedIsPreStudent =
        Boolean(profile?.is_pre_student) && !Boolean(profile?.is_verified_student)

      setCityId(resolvedCityId)
      setUniversityId(resolvedUniversityId)
      setSchoolId(resolvedSchoolId)
      setStudyYear(profile?.study_year ? String(profile.study_year) : '')
      setFullName(profile?.full_name ?? '')
      setDisplayName(profile?.display_name ?? '')
      setIsPreStudent(resolvedIsPreStudent)

      if (!resolvedIsPreStudent) {
        if (stored?.city_name) {
          setCityName(stored.city_name)
        } else if (resolvedCityId) {
          const { data: cityData } = await supabase
            .from('cities')
            .select('name')
            .eq('id', resolvedCityId)
            .maybeSingle()
          if (isMounted) setCityName(cityData?.name ?? '')
        }

        if (stored?.university_name) {
          setUniversityName(stored.university_name)
        } else if (resolvedUniversityId) {
          const { data: universityData } = await supabase
            .from('universities')
            .select('name')
            .eq('id', resolvedUniversityId)
            .maybeSingle()
          if (isMounted) setUniversityName(universityData?.name ?? '')
        }

        if (stored?.school_name) {
          setSchoolName(stored.school_name)
        } else if (resolvedSchoolId) {
          const { data: schoolData } = await supabase
            .from('schools')
            .select('name')
            .eq('id', resolvedSchoolId)
            .maybeSingle()
          if (isMounted) setSchoolName(schoolData?.name ?? '')
        }
      }

      setIsLoading(false)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadCities = async () => {
      if (!isPreStudent) return

      setIsLoadingCities(true)
      const { data, error } = await supabase
        .from('cities')
        .select('id, name')
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση των πόλεων.${details}`)
        setIsLoadingCities(false)
        return
      }

      setCities((data ?? []) as OptionItem[])
      setIsLoadingCities(false)
    }

    loadCities()

    return () => {
      isMounted = false
    }
  }, [isPreStudent])

  useEffect(() => {
    let isMounted = true

    const loadUniversities = async () => {
      if (!isPreStudent) return
      if (!cityId) {
        setUniversities([])
        return
      }

      setIsLoadingUniversities(true)
      const { data, error } = await supabase
        .from('universities')
        .select('id, name')
        .eq('city_id', cityId)
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση των πανεπιστημίων.${details}`)
        setIsLoadingUniversities(false)
        return
      }

      setUniversities((data ?? []) as OptionItem[])
      setIsLoadingUniversities(false)
    }

    loadUniversities()

    return () => {
      isMounted = false
    }
  }, [cityId, isPreStudent])

  useEffect(() => {
    let isMounted = true

    const loadSchools = async () => {
      if (!isPreStudent) return
      if (!universityId) {
        setSchools([])
        return
      }

      setIsLoadingSchools(true)
      const { data, error } = await supabase
        .from('schools')
        .select('id, name')
        .eq('university_id', universityId)
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση των σχολών.${details}`)
        setIsLoadingSchools(false)
        return
      }

      setSchools((data ?? []) as OptionItem[])
      setIsLoadingSchools(false)
    }

    loadSchools()

    return () => {
      isMounted = false
    }
  }, [isPreStudent, universityId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    const trimmedFullName = fullName.trim()
    const trimmedDisplayName = displayName.trim()

    if (trimmedFullName === '' || trimmedDisplayName === '') {
      setErrorMessage('Συμπλήρωσε ονοματεπώνυμο και όνομα εμφάνισης.')
      return
    }

    if (!userId) {
      setErrorMessage('Δεν ήταν δυνατή η φόρτωση του προφίλ.')
      return
    }

    if (!cityId || !universityId || !schoolId) {
      setErrorMessage('Συμπλήρωσε πόλη, πανεπιστήμιο και σχολή.')
      return
    }

    if (!isPreStudent && studyYear.trim() === '') {
      setErrorMessage('Επίλεξε το έτος φοίτησης.')
      return
    }

    setIsSubmitting(true)

    const payload: {
      full_name: string
      display_name: string
      city_id: string
      university_id: string
      school_id: string
      study_year?: number
    } = {
      full_name: trimmedFullName,
      display_name: trimmedDisplayName,
      city_id: cityId,
      university_id: universityId,
      school_id: schoolId,
    }

    if (!isPreStudent) {
      payload.study_year = Number(studyYear)
    }

    const { error } = await supabase.from('profiles').update(payload).eq('id', userId)

    if (error) {
      const details = error.message ? ` (${error.message})` : ''
      setErrorMessage(`Δεν ήταν δυνατή η ενημέρωση του προφίλ.${details}`)
      setIsSubmitting(false)
      return
    }

    try {
      sessionStorage.removeItem(onboardingConfirmStorageKey)
    } catch {
      // ignore storage errors
    }

    setIsSubmitting(false)
    navigate('/dashboard')
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Επιβεβαίωσε τα στοιχεία σου</h1>
        <p className="text-sm text-slate-600">Φορτώνουμε τα στοιχεία σου...</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Επιβεβαίωσε τα στοιχεία σου</h1>
        {isPreStudent ? (
          <p className="text-sm text-slate-600">
            Επίλεξε πόλη, πανεπιστήμιο και σχολή ενδιαφέροντος. Το έτος φοίτησης
            δεν απαιτείται για pre-student.
          </p>
        ) : null}
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm font-medium">
          Ονοματεπώνυμο
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Π.χ. Νίκος Παπαδόπουλος"
            required
          />
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Όνομα εμφάνισης (header / προφίλ)
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Π.χ. nickos"
            required
          />
        </label>

        {isPreStudent ? (
          <>
            <label className="block space-y-1 text-sm font-medium">
              Πόλη
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                value={cityId ?? ''}
                onChange={(event) => {
                  const value = event.target.value || null
                  setCityId(value)
                  setUniversityId(null)
                  setSchoolId(null)
                }}
                disabled={isLoadingCities}
                required
              >
                <option value="">Επίλεξε πόλη</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm font-medium">
              Πανεπιστήμιο
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                value={universityId ?? ''}
                onChange={(event) => {
                  const value = event.target.value || null
                  setUniversityId(value)
                  setSchoolId(null)
                }}
                disabled={!cityId || isLoadingUniversities}
                required
              >
                <option value="">Επίλεξε πανεπιστήμιο</option>
                {universities.map((university) => (
                  <option key={university.id} value={university.id}>
                    {university.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm font-medium">
              Σχολή
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                value={schoolId ?? ''}
                onChange={(event) => setSchoolId(event.target.value || null)}
                disabled={!universityId || isLoadingSchools}
                required
              >
                <option value="">Επίλεξε σχολή</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="block space-y-1 text-sm font-medium">
              Πόλη
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                type="text"
                value={cityName}
                disabled
              />
            </label>

            <label className="block space-y-1 text-sm font-medium">
              Πανεπιστήμιο
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                type="text"
                value={universityName}
                disabled
              />
            </label>

            <label className="block space-y-1 text-sm font-medium">
              Σχολή
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                type="text"
                value={schoolName}
                disabled
              />
            </label>

            <label className="block space-y-1 text-sm font-medium">
              Έτος φοίτησης
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                value={studyYear}
                onChange={(event) => setStudyYear(event.target.value)}
                required
              >
                <option value="">Επέλεξε έτος</option>
                <option value="1">1ο</option>
                <option value="2">2ο</option>
                <option value="3">3ο</option>
                <option value="4">4ο+</option>
              </select>
            </label>
          </>
        )}

        <button
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={!canSubmit}
        >
          {isSubmitting ? 'Επιβεβαίωση...' : 'Επιβεβαίωση & Συνέχεια'}
        </button>
      </form>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}
