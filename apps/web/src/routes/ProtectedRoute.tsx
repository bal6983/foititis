import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useI18n, type LocalizedMessage } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type GuardState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'needs-confirmation' }
  | { status: 'needs-prestudent-setup' }
  | { status: 'needs-onboarding' }
  | { status: 'ready' }
  | { status: 'error'; message: LocalizedMessage }

export default function ProtectedRoute() {
  const { t } = useI18n()
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
          message: {
            en: `Login error.${details}`,
            el: `Σφάλμα σύνδεσης.${details}`,
          },
        })
        return
      }

      const session = sessionData.session

      if (!session) {
        setGuardState({ status: 'unauthenticated' })
        return
      }

      const metadataIsPreStudent =
        session.user.user_metadata?.is_pre_student === true ||
        session.user.user_metadata?.student_type === 'pre-student'

      let profileRes = await supabase
        .from('profiles')
        .select(
          'display_name, onboarding_completed, is_verified_student, university_email, city_id, university_id, school_id, is_pre_student',
        )
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileRes.error) {
        const joined = `${profileRes.error.message ?? ''} ${profileRes.error.details ?? ''}`.toLowerCase()
        if (joined.includes('does not exist') || joined.includes('schema cache')) {
          profileRes = (await supabase
            .from('profiles')
            .select(
              'display_name, is_verified_student, university_email, city_id, university_id, school_id, is_pre_student',
            )
            .eq('id', session.user.id)
            .maybeSingle()) as typeof profileRes
        }
      }

      if (!isMounted) return

      if (profileRes.error) {
        const details = profileRes.error?.message ? ` (${profileRes.error.message})` : ''
        setGuardState({
          status: 'error',
          message: {
            en: `Unable to load profile.${details}`,
            el: `Δεν ήταν δυνατή η φόρτωση προφίλ.${details}`,
          },
        })
        return
      }

      let resolvedProfile = profileRes.data
        ? ({
            ...profileRes.data,
            onboarding_completed:
              (profileRes.data as { onboarding_completed?: boolean | null })
                .onboarding_completed ?? true,
          } as (typeof profileRes.data & { onboarding_completed: boolean }))
        : null

      if (!resolvedProfile) {
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: session.user.id,
              is_verified_student: false,
              is_pre_student: metadataIsPreStudent,
            },
            { onConflict: 'id', ignoreDuplicates: true },
          )
          .select(
            'display_name, onboarding_completed, is_verified_student, university_email, city_id, university_id, school_id, is_pre_student',
          )
          .maybeSingle()

        if (!isMounted) return

        if (createError || !createdProfile) {
          const details = createError?.message ? ` (${createError.message})` : ''
          setGuardState({
            status: 'error',
            message: {
              en: `Unable to create profile.${details}`,
              el: `Δεν ήταν δυνατή η δημιουργία προφίλ.${details}`,
            },
          })
          return
        }

        resolvedProfile = createdProfile
      }

      if (!resolvedProfile) {
        setGuardState({
          status: 'error',
          message: {
            en: 'Unable to create profile.',
            el: 'Δεν ήταν δυνατή η δημιουργία προφίλ.',
          },
        })
        return
      }

      if (
        resolvedProfile.is_verified_student === true &&
        resolvedProfile.is_pre_student === true
      ) {
        const { data: normalizedProfile } = await supabase
          .from('profiles')
          .update({ is_pre_student: false })
          .eq('id', session.user.id)
          .select(
            'display_name, onboarding_completed, is_verified_student, university_email, city_id, university_id, school_id, is_pre_student',
          )
          .maybeSingle()

        if (!isMounted) return

        if (normalizedProfile) {
          resolvedProfile = normalizedProfile
        }
      }

      if (
        metadataIsPreStudent &&
        resolvedProfile.is_verified_student !== true &&
        resolvedProfile.is_pre_student !== true
      ) {
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({ is_pre_student: true })
          .eq('id', session.user.id)
          .select(
            'display_name, onboarding_completed, is_verified_student, university_email, city_id, university_id, school_id, is_pre_student',
          )
          .maybeSingle()

        if (!isMounted) return

        if (updateError) {
          const details = updateError.message ? ` (${updateError.message})` : ''
          setGuardState({
            status: 'error',
            message: {
              en: `Failed to update pre-student status.${details}`,
              el: `Δεν ήταν δυνατή η ενημέρωση του pre-student.${details}`,
            },
          })
          return
        }

        if (updatedProfile) {
          resolvedProfile = updatedProfile
        }
      }

      const isMissingAcademic =
        !resolvedProfile.city_id ||
        !resolvedProfile.university_id ||
        !resolvedProfile.school_id

      const isPreStudent =
        resolvedProfile.is_verified_student === true
          ? false
          : resolvedProfile.is_pre_student === true ||
            metadataIsPreStudent ||
            (isMissingAcademic &&
              resolvedProfile.onboarding_completed === true &&
              resolvedProfile.is_verified_student === false &&
              resolvedProfile.university_email === null)

      const needsPreStudentSetup = isPreStudent && isMissingAcademic

      if (needsPreStudentSetup) {
        setGuardState({ status: 'needs-prestudent-setup' })
        return
      }

      if (isMissingAcademic && !isPreStudent) {
        setGuardState({ status: 'needs-confirmation' })
        return
      }

      const shouldFinalizeVerification =
        session.user.email_confirmed_at !== null &&
        resolvedProfile.is_verified_student === false &&
        resolvedProfile.university_id !== null

      if (
        shouldFinalizeVerification &&
        !finalizeInFlightRef.current &&
        !finalizeAttemptedRef.current.has(session.user.id)
      ) {
        finalizeInFlightRef.current = true
        finalizeAttemptedRef.current.add(session.user.id)

        try {
          if (!resolvedProfile.university_email && session.user.email) {
            await supabase.rpc('request_university_verification', {
              p_university_email: session.user.email,
            })
          }

          const { error: finalizeError } = await supabase.rpc(
            'finalize_university_verification',
          )

          if (!isMounted) return

          if (!finalizeError) {
            const { data: refreshedProfile, error: refreshedError } =
              await supabase
                .from('profiles')
                .select(
                  'display_name, onboarding_completed, is_verified_student, university_email, city_id, university_id, school_id, is_pre_student',
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

      if (!resolvedProfile) {
        setGuardState({
          status: 'error',
          message: {
            en: 'Unable to load profile.',
            el: 'Δεν ήταν δυνατή η φόρτωση προφίλ.',
          },
        })
        return
      }

      if (!resolvedProfile.onboarding_completed && !isPreStudent) {
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
        <h1 className="text-xl font-semibold">{t({ en: 'Loading', el: 'Φόρτωση' })}</h1>
        <p className="text-sm text-slate-600">
          {t({ en: 'Checking sign-in...', el: 'Έλεγχος σύνδεσης...' })}
        </p>
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

  if (guardState.status === 'needs-prestudent-setup') {
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
        <h1 className="text-xl font-semibold">
          {t({ en: 'Unable to load', el: 'Δεν ήταν δυνατή η φόρτωση' })}
        </h1>
        <p className="text-sm text-slate-600">{t(guardState.message)}</p>
      </section>
    )
  }

  return <Outlet />
}
