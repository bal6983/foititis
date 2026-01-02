import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Onboarding() {
  const [displayName, setDisplayName] = useState('')
  const [university, setUniversity] = useState('')
  const [school, setSchool] = useState('')
  const [department, setDepartment] = useState('')
  const [studyYear, setStudyYear] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        setErrorMessage('Πρέπει να συνδεθείς για να συνεχίσεις.')
        setIsLoading(false)
        return
      }

      setUserId(userData.user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(
          'display_name, university, school, department, study_year, onboarding_completed',
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

      if (profile.onboarding_completed) {
        navigate('/app', { replace: true })
        return
      }

      setDisplayName(profile.display_name ?? '')
      setUniversity(profile.university ?? '')
      setSchool(profile.school ?? '')
      setDepartment(profile.department ?? '')
      setStudyYear(profile.study_year ? String(profile.study_year) : '')
      setIsLoading(false)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (!userId) {
      setErrorMessage('Πρέπει να συνδεθείς για να συνεχίσεις.')
      return
    }

    const trimmedStudyYear = studyYear.trim()
    const parsedStudyYear =
      trimmedStudyYear === '' ? null : Number(trimmedStudyYear)

    if (parsedStudyYear !== null && Number.isNaN(parsedStudyYear)) {
      setErrorMessage('Το έτος σπουδών πρέπει να είναι αριθμός.')
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        university,
        school,
        department,
        study_year: parsedStudyYear,
        onboarding_completed: true,
      })
      .eq('id', userId)

    if (error) {
      const details = error.message ? ` (${error.message})` : ''
      setErrorMessage(`Δεν ήταν δυνατή η αποθήκευση.${details}`)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    navigate('/app')
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Ολοκλήρωση προφίλ</h1>
        <p className="text-sm text-slate-600">
          Φόρτωση του προφίλ σου...
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Ολοκλήρωσε το προφίλ σου</h1>
        <p className="text-sm text-slate-600">
          Πες μας λίγα για τις σπουδές σου για να ολοκληρώσεις την έναρξη
          (onboarding).
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm font-medium">
          Εμφανιζόμενο όνομα
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Πανεπιστήμιο
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="text"
            value={university}
            onChange={(event) => setUniversity(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Σχολή
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="text"
            value={school}
            onChange={(event) => setSchool(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Τμήμα
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="text"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Έτος σπουδών (προαιρετικό)
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="number"
            min={1}
            max={12}
            value={studyYear}
            onChange={(event) => setStudyYear(event.target.value)}
          />
        </label>

        <button
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Αποθήκευση...' : 'Ολοκλήρωση'}
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
