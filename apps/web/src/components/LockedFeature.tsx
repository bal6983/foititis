import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n, type LocalizedMessage } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type LockStatus = 'loading' | 'verified' | 'unverified' | 'error'

type LockedFeatureProps = {
  title: string
}

export default function LockedFeature({ title }: LockedFeatureProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<LockStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<LocalizedMessage | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadVerificationStatus = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage({
          en: `You need to sign in to continue.${details}`,
          el: `Πρέπει να συνδεθείς για να συνεχίσεις.${details}`,
        })
        setStatus('error')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_verified_student')
        .eq('id', userData.user.id)
        .single()

      if (!isMounted) return

      if (profileError || !profile) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setErrorMessage({
          en: `Profile not found.${details}`,
          el: `Δεν βρέθηκε προφίλ.${details}`,
        })
        setStatus('error')
        return
      }

      setStatus(profile.is_verified_student ? 'verified' : 'unverified')
    }

    loadVerificationStatus()

    return () => {
      isMounted = false
    }
  }, [])

  if (status === 'loading') {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-600">
          {t({ en: 'Checking status...', el: 'Έλεγχος κατάστασης...' })}
        </p>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-rose-600">{errorMessage ? t(errorMessage) : null}</p>
      </section>
    )
  }

  if (status === 'unverified') {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">
            {t({
              en: 'Available only to verified students',
              el: 'Διαθέσιμο μόνο για επιβεβαιωμένους φοιτητές',
            })}
          </p>
          <Link
            className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            to="/verification"
          >
            {t({
              en: 'Go to student verification',
              el: 'Μετάβαση στην επαλήθευση φοιτητή',
            })}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-slate-600">
        {t({ en: 'Temporary placeholder.', el: 'Προσωρινό περιεχόμενο.' })}
      </p>
    </section>
  )
}
