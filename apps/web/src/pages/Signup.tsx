import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type OptionItem = {
  id: string
  name: string
}

type UniversityOption = OptionItem & {
  email_domains?: string[] | null
}

type OnboardingConfirmStorage = {
  city_id: string | null
  city_name: string
  university_id: string | null
  university_name: string
  school_id: string | null
  school_name: string
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

const onboardingConfirmStorageKey = 'onboardingConfirmData'

const normalizeDomain = (domain: string) =>
  domain.trim().toLowerCase().replace(/^@/, '')

const extractEmailDomain = (value: string) => {
  const atIndex = value.lastIndexOf('@')
  if (atIndex === -1) return ''
  return normalizeDomain(value.slice(atIndex + 1))
}

const persistOnboardingConfirmData = (data: OnboardingConfirmStorage) => {
  try {
    sessionStorage.setItem(onboardingConfirmStorageKey, JSON.stringify(data))
  } catch {
    // ignore storage errors
  }
}

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [studentType, setStudentType] = useState('')
  const [preStudentAcknowledged, setPreStudentAcknowledged] = useState(false)
  const [cityId, setCityId] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [cities, setCities] = useState<OptionItem[]>([])
  const [universities, setUniversities] = useState<UniversityOption[]>([])
  const [schools, setSchools] = useState<OptionItem[]>([])
  const [isLoadingCities, setIsLoadingCities] = useState(true)
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false)
  const [isLoadingSchools, setIsLoadingSchools] = useState(false)
  const [citiesErrorMessage, setCitiesErrorMessage] = useState('')
  const [universitiesErrorMessage, setUniversitiesErrorMessage] = useState('')
  const [schoolsErrorMessage, setSchoolsErrorMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showEmailConfirmationMessage, setShowEmailConfirmationMessage] =
    useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

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
        .select('id, name, email_domains')
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

  const handleStudentTypeChange = (value: string) => {
    setStudentType(value)
    setPreStudentAcknowledged(false)
    if (value !== 'student') {
      setCityId('')
      setUniversityId('')
      setSchoolId('')
      setUniversities([])
      setSchools([])
    }
  }

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
    setShowEmailConfirmationMessage(false)
    if (isStudentEmailDomainMismatch) {
      return
    }
    setIsSubmitting(true)

    if (!studentType) {
      setErrorMessage('Επίλεξε αν είσαι φοιτητής ή pre-student.')
      setIsSubmitting(false)
      return
    }

    if (studentType === 'student' && (!cityId || !universityId || !schoolId)) {
      setErrorMessage(
        'Συμπλήρωσε την πόλη, το πανεπιστήμιο και τη σχολή σου.',
      )
      setIsSubmitting(false)
      return
    }

    if (studentType === 'pre-student' && !preStudentAcknowledged) {
      setErrorMessage('Πρέπει να επιβεβαιώσεις ότι διάβασες το μήνυμα.')
      setIsSubmitting(false)
      return
    }

    const selectedCity = cities.find((city) => city.id === cityId)
    const selectedUniversity = universities.find(
      (university) => university.id === universityId,
    )
    const selectedSchool = schools.find((school) => school.id === schoolId)

    persistOnboardingConfirmData({
      city_id: cityId || null,
      city_name: selectedCity?.name ?? '',
      university_id: universityId || null,
      university_name: selectedUniversity?.name ?? '',
      school_id: schoolId || null,
      school_name: selectedSchool?.name ?? '',
    })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          is_pre_student: studentType === 'pre-student',
          student_type: studentType,
        },
      },
    })

    if (error || !data.user) {
      const details = error?.message ? ` (${error.message})` : ''
      setErrorMessage(`Δεν ήταν δυνατή η δημιουργία λογαριασμού.${details}`)
      setIsSubmitting(false)
      return
    }

    if (!data.session) {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (signInError || !signInData.session) {
        const rawMessage = signInError?.message ?? ''
        const normalizedMessage = rawMessage.toLowerCase()
        const isEmailNotConfirmed =
          normalizedMessage.includes('email not confirmed') ||
          normalizedMessage.includes('not confirmed')

        if (isEmailNotConfirmed) {
          setShowEmailConfirmationMessage(true)
          setIsSubmitting(false)
          return
        }

        const details = signInError?.message
          ? ` (${signInError.message})`
          : ''
        setErrorMessage(`Δεν ήταν δυνατή η σύνδεση.${details}`)
        setIsSubmitting(false)
        return
      }
    }

    const profileEmail = data.user.email ?? email
    const profilePayload: {
      id: string
      email: string
      is_verified_student: boolean
      onboarding_completed: boolean
      is_pre_student: boolean
      city_id?: string | null
      university_id?: string | null
      school_id?: string | null
    } = {
      id: data.user.id,
      email: profileEmail,
      is_verified_student: false,
      onboarding_completed: true,
      is_pre_student: studentType === 'pre-student',
    }

    if (studentType === 'student') {
      profilePayload.city_id = cityId
      profilePayload.university_id = universityId
      profilePayload.school_id = schoolId
    } else {
      profilePayload.city_id = null
      profilePayload.university_id = null
      profilePayload.school_id = null
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })

    if (profileError) {
      const details = profileError.message ? ` (${profileError.message})` : ''
      setErrorMessage(
        `Δεν ήταν δυνατή η αποθήκευση του προφίλ.${details}`,
      )
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    navigate('/dashboard')
  }

  const isStudent = studentType === 'student'
  const selectedUniversity = universities.find(
    (university) => university.id === universityId,
  )
  const selectedUniversityDomains = (selectedUniversity?.email_domains ?? [])
    .map(normalizeDomain)
    .filter(Boolean)
  const emailDomain = extractEmailDomain(email)
  const isStudentEmailDomainMismatch =
    isStudent &&
    universityId &&
    emailDomain.length > 0 &&
    !selectedUniversityDomains.includes(emailDomain)
  const isUniversityDisabled = !isStudent || !cityId || isLoadingUniversities
  const isSchoolDisabled = !isStudent || !universityId || isLoadingSchools
  const isSubmitDisabled = isSubmitting || isStudentEmailDomainMismatch
  const emailField = (
    <label className="block space-y-1 text-sm font-medium">
      Email
      <input
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        type="email"
        autoComplete="email"
        placeholder="you@uni.gr"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      {isStudent ? (
        <span className="text-xs text-slate-500">
          Χρησιμοποίησε το πανεπιστημιακό σου email (π.χ. @auth.gr)
        </span>
      ) : null}
      {isStudentEmailDomainMismatch ? (
        <span className="text-xs text-rose-600">
          Για φοιτητές απαιτείται το πανεπιστημιακό email.
        </span>
      ) : null}
    </label>
  )
  const passwordField = (
    <label className="block space-y-1 text-sm font-medium">
      Κωδικός
      <input
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        type="password"
        autoComplete="new-password"
        placeholder="Τουλάχιστον 8 χαρακτήρες"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
      />
    </label>
  )

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Δημιουργία λογαριασμού</h1>
        <p className="text-sm text-slate-600">
          Συμπλήρωσε email και κωδικό και πες μας την ιδιότητά σου.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {!isStudent ? emailField : null}
        {!isStudent ? passwordField : null}

        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium">
            Είσαι φοιτητής ή pre-student;
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="student-type"
              value="student"
              checked={studentType === 'student'}
              onChange={(event) => handleStudentTypeChange(event.target.value)}
            />
            Φοιτητής
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="student-type"
              value="pre-student"
              checked={studentType === 'pre-student'}
              onChange={(event) => handleStudentTypeChange(event.target.value)}
            />
            Pre-student
          </label>
        </fieldset>

        {isStudent ? (
          <div className="space-y-4">
            <label className="block space-y-1 text-sm font-medium">
              Πόλη σπουδών
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                value={cityId}
                onChange={(event) => handleCityChange(event.target.value)}
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
              {citiesErrorMessage ? (
                <span className="text-xs text-rose-600">
                  {citiesErrorMessage}
                </span>
              ) : null}
            </label>

            <label className="block space-y-1 text-sm font-medium">
              Πανεπιστήμιο
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                value={universityId}
                onChange={(event) => handleUniversityChange(event.target.value)}
                disabled={isUniversityDisabled}
                required
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
                required
              >
                <option value="">Επίλεξε σχολή</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              {schoolsErrorMessage ? (
                <span className="text-xs text-rose-600">
                  {schoolsErrorMessage}
                </span>
              ) : null}
            </label>
          </div>
        ) : null}

        {studentType === 'pre-student' ? (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <p>
              Pre-student profiles stay active for 4 months unless you verify with a university email.
              After 4 months, the profile is removed automatically.
            </p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={preStudentAcknowledged}
                onChange={(event) =>
                  setPreStudentAcknowledged(event.target.checked)
                }
              />
              <span>Έχω διαβάσει το παραπάνω μήνυμα.</span>
            </label>
          </div>
        ) : null}

        {isStudent ? emailField : null}
        {isStudent ? passwordField : null}

        <button
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitDisabled}
        >
          {isSubmitting ? 'Γίνεται εγγραφή...' : 'Δημιουργία λογαριασμού'}
        </button>
      </form>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
      {showEmailConfirmationMessage ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-semibold">Έλεγξε το email σου 📬</p>
          <p>
            Σου στείλαμε ένα email επιβεβαίωσης για να ενεργοποιήσεις τον
            λογαριασμό σου. Άνοιξε το email και πάτησε τον σύνδεσμο
            επιβεβαίωσης για να συνεχίσεις.
          </p>
          <p className="text-xs text-slate-500">
            Αν δεν το βλέπεις, έλεγξε και τον φάκελο ανεπιθύμητης αλληλογραφίας
            (spam).
          </p>
        </div>
      ) : null}

      <p className="text-sm text-slate-600">
        Έχεις ήδη λογαριασμό;{' '}
        <Link className="font-semibold text-slate-900" to="/login">
          Σύνδεση
        </Link>
        .
      </p>
    </section>
  )
}

