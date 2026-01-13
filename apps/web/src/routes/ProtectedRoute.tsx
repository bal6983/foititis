import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type GuardState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'needs-confirmation' }
  | { status: 'needs-onboarding' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

export default function ProtectedRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const [guardState, setGuardState] = useState<GuardState>({
    status: 'loading',
  })
  const finalizeAttemptedRef = useRef(new Set<string>())
  const finalizeInFlightRef = useRef(false)

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
        .select(
          'onboarding_completed, is_verified_student, university_email, city_id, university_id, school_id',
        )
        .eq('id', session.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setGuardState({
          status: 'error',
          message: `Δεν ήταν δυνατή η φόρτωση προφίλ.${details}`,
        })
        return
      }

      let resolvedProfile = profile

      if (!resolvedProfile) {
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            is_verified_student: false,
          })
          .select(
            'onboarding_completed, is_verified_student, university_email, city_id, university_id, school_id',
          )
          .maybeSingle()

        if (!isMounted) return

        if (createError || !createdProfile) {
          const details = createError?.message
            ? ` (${createError.message})`
            : ''
          setGuardState({
            status: 'error',
            message: `Н?Н?Н? Н?О?НёН? Н?О?Н?НёО?Н? Н· О?О?О?О?О?О?Н· О?О?НЁО?Н?Н?.${details}`,
          })
          return
        }

        resolvedProfile = createdProfile
      }

      if (!resolvedProfile) {
        setGuardState({
          status: 'error',
          message: `Н?Н?Н? Н?О?НёН? Н?О?Н?НёО?Н? Н· О?О?О?О?О?О?Н· О?О?НЁО?Н?Н?.`,
        })
        return
      }

      const isMissingAcademic =
        !resolvedProfile.city_id ||
        !resolvedProfile.university_id ||
        !resolvedProfile.school_id

      if (isMissingAcademic) {
        setGuardState({ status: 'needs-confirmation' })
        return
      }

      const shouldFinalizeVerification =
        session.user.email_confirmed_at !== null &&
        resolvedProfile.university_email !== null &&
        resolvedProfile.is_verified_student === false

      if (
        shouldFinalizeVerification &&
        !finalizeInFlightRef.current &&
        !finalizeAttemptedRef.current.has(session.user.id)
      ) {
        finalizeInFlightRef.current = true
        finalizeAttemptedRef.current.add(session.user.id)

        try {
          const { error: finalizeError } = await supabase.rpc(
            'finalize_university_verification',
          )

          if (!isMounted) return

          if (!finalizeError) {
            const { data: refreshedProfile, error: refreshedError } =
              await supabase
                .from('profiles')
                .select(
                  'onboarding_completed, is_verified_student, university_email',
                )
                .eq('id', session.user.id)
                .maybeSingle()

            if (!isMounted) return

            if (!refreshedError && refreshedProfile) {
              resolvedProfile = refreshedProfile

              if (refreshedProfile.is_verified_student === true) {
                if (location.pathname !== '/dashboard') {
                  navigate('/dashboard', { replace: true })
                  return
                }
              }
            }
          }
        } finally {
          finalizeInFlightRef.current = false
        }
      }

      if (!resolvedProfile.onboarding_completed) {
        setGuardState({ status: 'needs-onboarding' })
        return
      }

      setGuardState({ status: 'ready' })
    }

    checkAccess()

    return () => {
      isMounted = false
    }
  }, [location.pathname, navigate])

  if (guardState.status === 'loading') {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Φόρτωση</h1>
        <p className="text-sm text-slate-600">Έλεγχος σύνδεσης...</p>
      </section>
    )
  }

  if (guardState.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (guardState.status === 'needs-confirmation') {
    if (location.pathname === '/onboarding-confirm') {
      return <Outlet />
    }
    return <Navigate to="/onboarding-confirm" replace />
  }

  if (guardState.status === 'needs-onboarding') {
    if (location.pathname === '/onboarding') {
      return <Outlet />
    }
    return <Navigate to="/onboarding" replace />
  }

  if (guardState.status === 'ready' && location.pathname === '/onboarding-confirm') {
    return <Navigate to="/dashboard" replace />
  }

  if (guardState.status === 'ready' && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />
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
