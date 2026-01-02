import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type GuardState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'needs-onboarding' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

export default function ProtectedRoute() {
  const [guardState, setGuardState] = useState<GuardState>({
    status: 'loading',
  })

  useEffect(() => {
    let isMounted = true

    const checkAccess = async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (!isMounted) return

      if (sessionError) {
        const details = sessionError.message ? ` (${sessionError.message})` : ''
        setGuardState({
          status: 'error',
          message: `Σφάλμα σύνδεσης.${details}`,
        })
        return
      }

      const session = sessionData.session

      if (!session) {
        setGuardState({ status: 'unauthenticated' })
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', session.user.id)
        .single()

      if (!isMounted) return

      if (profileError || !profile) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setGuardState({
          status: 'error',
          message: `Δεν βρέθηκε προφίλ.${details}`,
        })
        return
      }

      if (!profile.onboarding_completed) {
        setGuardState({ status: 'needs-onboarding' })
        return
      }

      setGuardState({ status: 'ready' })
    }

    checkAccess()

    return () => {
      isMounted = false
    }
  }, [])

  if (guardState.status === 'loading') {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Φόρτωση</h1>
        <p className="text-sm text-slate-600">
          Έλεγχος σύνδεσης...
        </p>
      </section>
    )
  }

  if (guardState.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (guardState.status === 'needs-onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  if (guardState.status === 'error') {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Δεν ήταν δυνατή η φόρτωση</h1>
        <p className="text-sm text-slate-600">{guardState.message}</p>
      </section>
    )
  }

  return <Outlet />
}
