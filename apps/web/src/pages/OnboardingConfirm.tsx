import { FormEvent, useEffect, useMemo, useState } from 'react'
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
  const [cityId, setCityId] = useState<string | null>(null)
  const [universityId, setUniversityId] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [cityName, setCityName] = useState('')
  const [universityName, setUniversityName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [studyYear, setStudyYear] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit = useMemo(
    () =>
      Boolean(cityId && universityId && schoolId) &&
      studyYear.trim() !== '' &&
      !isSubmitting,
    [cityId, universityId, schoolId, studyYear, isSubmitting],
  )

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
        setErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`,
        )
        setIsLoading(false)
        return
      }

      setUserId(userData.user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('city_id, university_id, school_id, study_year')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`,
        )
        setIsLoading(false)
        return
      }

      const resolvedCityId =
        normalizeId(stored?.city_id) ?? profile?.city_id ?? null
      const resolvedUniversityId =
        normalizeId(stored?.university_id) ?? profile?.university_id ?? null
      const resolvedSchoolId =
        normalizeId(stored?.school_id) ?? profile?.school_id ?? null

      setCityId(resolvedCityId)
      setUniversityId(resolvedUniversityId)
      setSchoolId(resolvedSchoolId)
      setStudyYear(profile?.study_year ? String(profile.study_year) : '')

      if (stored?.city_name) {
        setCityName(stored.city_name)
      } else if (resolvedCityId) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('name')
          .eq('id', resolvedCityId)
          .maybeSingle()
        if (isMounted) {
          setCityName(cityData?.name ?? '')
        }
      }

      if (stored?.university_name) {
        setUniversityName(stored.university_name)
      } else if (resolvedUniversityId) {
        const { data: universityData } = await supabase
          .from('universities')
          .select('name')
          .eq('id', resolvedUniversityId)
          .maybeSingle()
        if (isMounted) {
          setUniversityName(universityData?.name ?? '')
        }
      }

      if (stored?.school_name) {
        setSchoolName(stored.school_name)
      } else if (resolvedSchoolId) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name')
          .eq('id', resolvedSchoolId)
          .maybeSingle()
        if (isMounted) {
          setSchoolName(schoolData?.name ?? '')
        }
      }

      if (!isMounted) return

      setIsLoading(false)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (!userId) {
      setErrorMessage('Δεν ήταν δυνατή η φόρτωση του προφίλ.')
      return
    }

    if (!cityId || !universityId || !schoolId) {
      setErrorMessage('Δεν βρέθηκαν στοιχεία από το signup.')
      return
    }

    if (studyYear.trim() === '') {
      setErrorMessage('Επίλεξε το έτος φοίτησης.')
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        city_id: cityId,
        university_id: universityId,
        school_id: schoolId,
        study_year: Number(studyYear),
      })
      .eq('id', userId)

    if (error) {
      const details = error.message ? ` (${error.message})` : ''
      setErrorMessage(
        `Δεν ήταν δυνατή η ενημέρωση του προφίλ.${details}`,
      )
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
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
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
