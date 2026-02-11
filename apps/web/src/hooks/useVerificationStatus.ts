import { useEffect, useState } from 'react'
import { type LocalizedMessage } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

export type VerificationStatus = 'loading' | 'verified' | 'unverified' | 'error'

export type VerificationResult = {
  status: VerificationStatus
  errorMessage: LocalizedMessage | null
}

export default function useVerificationStatus(): VerificationResult {
  const [status, setStatus] = useState<VerificationStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<LocalizedMessage | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadStatus = async () => {
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

    loadStatus()

    return () => {
      isMounted = false
    }
  }, [])

  return { status, errorMessage }
}
