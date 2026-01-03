import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type OptionItem = {
  id: string
  name: string
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

export default function ProfileEdit() {
  const [displayName, setDisplayName] = useState('')
  const [cityId, setCityId] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [cities, setCities] = useState<OptionItem[]>([])
  const [universities, setUniversities] = useState<OptionItem[]>([])
  const [schools, setSchools] = useState<OptionItem[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(true)
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false)
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [citiesErrorMessage, setCitiesErrorMessage] = useState('')
  const [universitiesErrorMessage, setUniversitiesErrorMessage] = useState('')
  const [schoolsErrorMessage, setSchoolsErrorMessage] = useState('')
  const [userId, setUserId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const navigate = useNavigate()
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
          `Δεν ήταν δυνατή η φόρτωση των πόλεων.${details}`,
        )
        setIsLoadingCities(false)
        return
      }

      setCities(uniqueById(data ?? []))
      setIsLoadingCities(false)
    }

    loadCities()

    return () => {
      isMounted = false
    }
  }, [])

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

      const { data, error } = await supabase
        .from('universities')
        .select('id, name')
        .eq('city_id', cityId)
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setUniversitiesErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των πανεπιστημίων.${details}`,
        )
        setIsLoadingUniversities(false)
        return
      }

      setUniversities(uniqueById(data ?? []))
      setIsLoadingUniversities(false)
    }

    loadUniversities()

    return () => {
      isMounted = false
    }
  }, [cityId])

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

      const { data, error } = await supabase
        .from('schools')
        .select('id, name')
        .eq('university_id', universityId)
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setSchoolsErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των σχολών.${details}`,
        )
        setIsLoadingSchools(false)
        return
      }

      setSchools(uniqueById(data ?? []))
      setIsLoadingSchools(false)
    }

    loadSchools()

    return () => {
      isMounted = false
    }
  }, [universityId])

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του χρήστη.${details}`)
        setIsLoading(false)
        return
      }

      setUserId(userData.user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, city_id, university_id, school_id')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError || !profile) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`)
        setIsLoading(false)
        return
      }

      setDisplayName(profile.display_name ?? '')
      setCityId(profile.city_id ?? '')
      setUniversityId(profile.university_id ?? '')
      setSchoolId(profile.school_id ?? '')
      setIsLoading(false)
    }

    loadProfile()

    return () => {
      isMounted = false
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  const handleCityChange = (value: string) => {
    setCityId(value)
    setUniversityId('')
    setSchoolId('')
    setSchools([])
  }

  const handleUniversityChange = (value: string) => {
    setUniversityId(value)
    setSchoolId('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const trimmedDisplayName = displayName.trim()

    if (!trimmedDisplayName) {
      setErrorMessage('Το όνομα εμφάνισης είναι υποχρεωτικό.')
      return
    }

    const hasAcademicSelection =
      cityId.trim() !== '' ||
      universityId.trim() !== '' ||
      schoolId.trim() !== ''

    if (hasAcademicSelection && (!cityId || !universityId || !schoolId)) {
      setErrorMessage(
        'Συμπλήρωσε την πόλη, το πανεπιστήμιο και τη σχολή σου.',
      )
      return
    }

    if (!userId) {
      setErrorMessage('Δεν ήταν δυνατή η αναγνώριση του χρήστη.')
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
        display_name: trimmedDisplayName,
        city_id: cityId || null,
        university_id: universityId || null,
        school_id: schoolId || null,
      })
      .eq('id', userId)

    if (error) {
      const details = error.message ? ` (${error.message})` : ''
      setErrorMessage(`Δεν ήταν δυνατή η ενημέρωση του προφίλ.${details}`)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setSuccessMessage('Το προφίλ ενημερώθηκε επιτυχώς.')
    redirectTimeoutRef.current = window.setTimeout(() => {
      navigate('/profile')
    }, 900)
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Φόρτωση προφίλ...</h1>
        <p className="text-sm text-slate-600">
          Προετοιμάζουμε τη φόρμα επεξεργασίας.
        </p>
      </section>
    )
  }

  const isUniversityDisabled = !cityId || isLoadingUniversities
  const isSchoolDisabled = !universityId || isLoadingSchools

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Επεξεργασία προφίλ</h1>
        <p className="text-sm text-slate-600">
          Ενημέρωσε τα βασικά στοιχεία του προφίλ σου.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm font-medium">
          Όνομα εμφάνισης
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Πόλη σπουδών
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            value={cityId}
            onChange={(event) => handleCityChange(event.target.value)}
            disabled={isLoadingCities}
          >
            <option value="">Επίλεξε πόλη</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          {citiesErrorMessage ? (
            <span className="text-xs text-rose-600">{citiesErrorMessage}</span>
          ) : null}
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Πανεπιστήμιο
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            value={universityId}
            onChange={(event) => handleUniversityChange(event.target.value)}
            disabled={isUniversityDisabled}
          >
            <option value="">Επίλεξε πανεπιστήμιο</option>
            {universities.map((university) => (
              <option key={university.id} value={university.id}>
                {university.name}
              </option>
            ))}
          </select>
          {universitiesErrorMessage ? (
            <span className="text-xs text-rose-600">
              {universitiesErrorMessage}
            </span>
          ) : null}
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Σχολή
          <select
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            value={schoolId}
            onChange={(event) => setSchoolId(event.target.value)}
            disabled={isSchoolDisabled}
          >
            <option value="">Επίλεξε σχολή</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
          {schoolsErrorMessage ? (
            <span className="text-xs text-rose-600">{schoolsErrorMessage}</span>
          ) : null}
        </label>

        <button
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Γίνεται αποθήκευση...' : 'Αποθήκευση αλλαγών'}
        </button>
      </form>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}
    </section>
  )
}
