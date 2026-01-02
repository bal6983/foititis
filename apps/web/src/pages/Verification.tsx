import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type VerificationState = 'idle' | 'pending' | 'approved' | 'rejected'

export default function Verification() {
  const [status, setStatus] = useState<VerificationState>('idle')
  const [userId, setUserId] = useState<string | null>(null)
  const [hasStatusField, setHasStatusField] = useState(false)
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
        .select('*')
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

  const handleSubmit = async () => {
    setErrorMessage('')

    if (!userId) {
      setErrorMessage('Πρέπει να συνδεθείς για να συνεχίσεις.')
      return
    }

    setIsSubmitting(true)

    if (hasStatusField) {
      const { error } = await supabase
        .from('profiles')
        .update({ verification_status: 'pending' })
        .eq('id', userId)

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η υποβολή.${details}`)
        setIsSubmitting(false)
        return
      }
    }

    setIsSubmitting(false)
    setStatus('pending')
  }

  const shouldShowCta = status === 'idle' || status === 'rejected'

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

  if (errorMessage) {
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
            �Η αίτησή σου δεν εγκρίθηκε με τα υπάρχοντα στοιχεία.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Μπορείς να υποβάλεις νέα αίτηση με ενημερωμένα στοιχεία.
          </p>
        </div>
      ) : null}

      {shouldShowCta ? (
        <button
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? 'Υποβολή σε εξέλιξη...'
            : 'Υποβολή αίτησης επαλήθευσης'}
        </button>
      ) : null}
    </section>
  )
}
