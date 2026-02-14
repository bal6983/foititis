import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  fetchDepartmentsForSchool,
  fetchSchoolsForUniversity,
  fetchUniversitiesForCity,
} from '../lib/universityLookup'

type VerificationState = 'idle' | 'pending' | 'approved' | 'rejected'

type OptionItem = {
  id: string
  name: string
}

export default function Verification() {
  const [status, setStatus] = useState<VerificationState>('idle')
  const [userId, setUserId] = useState<string | null>(null)
  const [hasStatusField, setHasStatusField] = useState(false)
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [cityId, setCityId] = useState<string | null>(null)
  const [universityId, setUniversityId] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [universityEmail, setUniversityEmail] = useState('')
  const [cities, setCities] = useState<OptionItem[]>([])
  const [universities, setUniversities] = useState<OptionItem[]>([])
  const [schools, setSchools] = useState<OptionItem[]>([])
  const [departments, setDepartments] = useState<OptionItem[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false)
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(`Πρέπει να συνδεθείς για να συνεχίσεις.${details}`)
        setIsLoading(false)
        return
      }

      setUserId(userData.user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
          'is_verified_student, is_pre_student, verification_status, city_id, university_id, school_id, department_id, university_email',
        )
        .eq('id', userData.user.id)
        .single()

      if (!isMounted) return

      if (profileError || !profile) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setErrorMessage(`Δεν βρέθηκε προφίλ.${details}`)
        setIsLoading(false)
        return
      }

      const hasVerificationStatusField = Object.prototype.hasOwnProperty.call(
        profile,
        'verification_status',
      )
      const rawStatus = hasVerificationStatusField
        ? (profile as Record<string, unknown>).verification_status
        : null
      const normalizedStatus =
        typeof rawStatus === 'string' ? rawStatus.toLowerCase() : null

      setHasStatusField(hasVerificationStatusField)
      setCityId(profile.city_id ?? null)
      setUniversityId(profile.university_id ?? null)
      setSchoolId(profile.school_id ?? null)
      setDepartmentId(profile.department_id ?? null)
      setUniversityEmail(profile.university_email ?? '')
      setIsPreStudent(
        Boolean(profile.is_pre_student) && !Boolean(profile.is_verified_student),
      )

      if (profile.is_verified_student) {
        setStatus('approved')
      } else if (normalizedStatus === 'pending') {
        setStatus('pending')
      } else if (normalizedStatus === 'rejected') {
        setStatus('rejected')
      } else {
        setStatus('idle')
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
      const { data, error } = await fetchUniversitiesForCity(cityId)

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
      const { data, error } = await fetchSchoolsForUniversity(universityId, {
        cityId: cityId ?? null,
      })

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
  }, [cityId, isPreStudent, universityId])

  useEffect(() => {
    let isMounted = true

    const loadDepartments = async () => {
      if (!isPreStudent) return
      if (!schoolId) {
        setDepartments([])
        return
      }

      setIsLoadingDepartments(true)
      const { data, error } = await fetchDepartmentsForSchool(schoolId, {
        cityId: cityId ?? null,
      })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(`Αδυναμία φόρτωσης τμημάτων.${details}`)
        setIsLoadingDepartments(false)
        return
      }

      setDepartments((data ?? []) as OptionItem[])
      setIsLoadingDepartments(false)
    }

    loadDepartments()

    return () => {
      isMounted = false
    }
  }, [cityId, isPreStudent, schoolId])

  const shouldShowCta = status === 'idle' || status === 'rejected'

  const canSubmit = useMemo(() => {
    if (!shouldShowCta || isSubmitting) return false
    if (universityEmail.trim() === '') return false
    if (!isPreStudent) return true
    return Boolean(cityId && universityId && schoolId && departmentId)
  }, [
    cityId,
    departmentId,
    isPreStudent,
    isSubmitting,
    schoolId,
    shouldShowCta,
    universityEmail,
    universityId,
  ])

  const handleSubmit = async () => {
    setErrorMessage('')

    if (!userId) {
      setErrorMessage('Πρέπει να συνδεθείς για να συνεχίσεις.')
      return
    }

    if (universityEmail.trim() === '') {
      setErrorMessage('Συμπλήρωσε πανεπιστημιακό email.')
      return
    }

    if (isPreStudent && (!cityId || !universityId || !schoolId || !departmentId)) {
      setErrorMessage(
        'Ως pre-student πρέπει να επιλέξεις τελική πόλη, πανεπιστήμιο και σχολή.',
      )
      return
    }

    setIsSubmitting(true)

    if (isPreStudent) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          city_id: cityId,
          university_id: universityId,
          school_id: schoolId,
          department_id: departmentId,
        })
        .eq('id', userId)

      if (profileUpdateError) {
        const details = profileUpdateError.message
          ? ` (${profileUpdateError.message})`
          : ''
        setErrorMessage(`Δεν ήταν δυνατή η ενημέρωση τελικής σχολής.${details}`)
        setIsSubmitting(false)
        return
      }
    }

    const { error: verificationRequestError } = await supabase.rpc(
      'request_university_verification',
      { p_university_email: universityEmail.trim() },
    )

    if (verificationRequestError) {
      const details = verificationRequestError.message
        ? ` (${verificationRequestError.message})`
        : ''
      setErrorMessage(`Δεν ήταν δυνατή η υποβολή.${details}`)
      setIsSubmitting(false)
      return
    }

    if (hasStatusField) {
      await supabase
        .from('profiles')
        .update({ verification_status: 'pending' })
        .eq('id', userId)
    }

    setIsSubmitting(false)
    setStatus('pending')
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Επαλήθευση φοιτητή</h1>
        <p className="text-sm text-slate-600">
          Φόρτωση στοιχείων επαλήθευσης...
        </p>
      </section>
    )
  }

  if (errorMessage && !shouldShowCta) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Επαλήθευση φοιτητή</h1>
        <p className="text-sm text-rose-600">{errorMessage}</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Επαλήθευση φοιτητή</h1>
        <p className="text-sm text-slate-600">
          Η επαλήθευση ξεκλειδώνει τη δυνατότητα δημοσίευσης αγγελιών. Η
          διαδικασία μπορεί να πάρει λίγο χρόνο.
        </p>
      </header>

      {status === 'pending' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">
            Η αίτησή σου βρίσκεται σε εξέταση.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Θα ειδοποιηθείς μόλις ολοκληρωθεί ο έλεγχος.
          </p>
        </div>
      ) : null}

      {status === 'approved' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">
            Επαληθεύτηκες ως φοιτητής.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Μπορείς πλέον να δημοσιεύεις αγγελίες στο Marketplace.
          </p>
        </div>
      ) : null}

      {status === 'rejected' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">
            Η αίτησή σου δεν εγκρίθηκε με τα υπάρχοντα στοιχεία.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Μπορείς να υποβάλεις νέα αίτηση με ενημερωμένα στοιχεία.
          </p>
        </div>
      ) : null}

      {shouldShowCta ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          {isPreStudent ? (
            <>
              <p className="text-sm text-slate-600">
                Επέλεξε την τελική σχολή σου πριν την επαλήθευση email.
              </p>

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
                    setDepartmentId(null)
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
                    setDepartmentId(null)
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
                  onChange={(event) => {
                    setSchoolId(event.target.value || null)
                    setDepartmentId(null)
                  }}
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
              <label className="block space-y-1 text-sm font-medium">
                Τμήμα
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  value={departmentId ?? ''}
                  onChange={(event) => setDepartmentId(event.target.value || null)}
                  disabled={!schoolId || isLoadingDepartments}
                  required
                >
                  <option value="">Επίλεξε τμήμα</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className="block space-y-1 text-sm font-medium">
            Πανεπιστημιακό email
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="email"
              value={universityEmail}
              onChange={(event) => setUniversityEmail(event.target.value)}
              placeholder="you@university.gr"
              required
            />
          </label>

          <button
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting
              ? 'Υποβολή σε εξέλιξη...'
              : 'Υποβολή αίτησης επαλήθευσης'}
          </button>

          {errorMessage ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
