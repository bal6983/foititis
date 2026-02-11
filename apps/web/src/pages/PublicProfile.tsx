import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n, type LocalizedMessage } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type PublicProfileRecord = {
  id: string
  display_name: string | null
  school_id: string | null
  university_id: string | null
  city_id: string | null
  study_year: number | null
  is_verified_student: boolean | null
}

const getConversationIdFromRpc = (data: unknown) => {
  if (typeof data === 'string') {
    return data
  }
  if (Array.isArray(data)) {
    return data[0]?.conversation_id ?? ''
  }
  if (data && typeof data === 'object' && 'conversation_id' in data) {
    const typedData = data as { conversation_id?: string }
    return typedData.conversation_id ?? ''
  }
  return ''
}

export default function PublicProfile() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PublicProfileRecord | null>(null)
  const [universityName, setUniversityName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [cityName, setCityName] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [conversationError, setConversationError] = useState<LocalizedMessage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<LocalizedMessage | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadCurrentUser = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        setCurrentUserId('')
        return
      }

      setCurrentUserId(userData.user.id)
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      if (!id) {
        setErrorMessage({
          en: 'Profile not found.',
          el: 'Το προφίλ δεν βρέθηκε.',
        })
        setIsLoading(false)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('public_profiles')
        .select(
          'id, display_name, school_id, university_id, city_id, study_year, is_verified_student',
        )
        .eq('id', id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError.message ? ` (${profileError.message})` : ''
        setErrorMessage({
          en: `Unable to load profile.${details}`,
          el: `Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`,
        })
        setIsLoading(false)
        return
      }

      if (!profileData) {
        setErrorMessage({
          en: 'Profile not found.',
          el: 'Το προφίλ δεν βρέθηκε.',
        })
        setIsLoading(false)
        return
      }

      const typedProfile = profileData as PublicProfileRecord
      setProfile(typedProfile)

      if (typedProfile.university_id) {
        const { data: universityData } = await supabase
          .from('universities')
          .select('name')
          .eq('id', typedProfile.university_id)
          .maybeSingle()

        if (!isMounted) return

        setUniversityName(universityData?.name ?? '')
      } else {
        setUniversityName('')
      }

      if (typedProfile.school_id) {
        const { data: schoolData } = await supabase
          .from('schools')
          .select('name')
          .eq('id', typedProfile.school_id)
          .maybeSingle()

        if (!isMounted) return

        setSchoolName(schoolData?.name ?? '')
      } else {
        setSchoolName('')
      }

      if (typedProfile.city_id) {
        const { data: cityData } = await supabase
          .from('cities')
          .select('name')
          .eq('id', typedProfile.city_id)
          .maybeSingle()

        if (!isMounted) return

        setCityName(cityData?.name ?? '')
      } else {
        setCityName('')
      }

      if (!isMounted) return

      setIsLoading(false)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [id])

  const handleSendMessage = async () => {
    if (!profile || !currentUserId || currentUserId === profile.id) {
      return
    }

    setIsConversationLoading(true)
    setConversationError(null)

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_or_create_conversation',
      {
        user_a: currentUserId,
        user_b: profile.id,
      },
    )

    if (rpcError) {
      setConversationError({
        en: 'Unable to start conversation.',
        el: 'Δεν ήταν δυνατή η έναρξη συνομιλίας.',
      })
      setIsConversationLoading(false)
      return
    }

    const conversationId = getConversationIdFromRpc(rpcData)

    if (!conversationId) {
      setConversationError({
        en: 'Conversation not found.',
        el: 'Δεν βρέθηκε συνομιλία.',
      })
      setIsConversationLoading(false)
      return
    }

    navigate(`/chat/${conversationId}`)
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t({ en: 'Profile', el: 'Προφίλ' })}</h1>
        <p className="text-sm text-slate-600">
          {t({ en: 'Loading profile...', el: 'Φορτώνουμε το προφίλ...' })}
        </p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t({ en: 'Profile', el: 'Προφίλ' })}</h1>
        <p className="text-sm text-rose-600">{t(errorMessage)}</p>
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t({ en: 'Profile', el: 'Προφίλ' })}</h1>
        <p className="text-sm text-slate-600">
          {t({ en: 'Profile not found.', el: 'Το προφίλ δεν βρέθηκε.' })}
        </p>
      </section>
    )
  }

  const displayName = profile.display_name?.trim() || t({ en: 'User', el: 'Χρήστης' })
  const canMessage = currentUserId && currentUserId !== profile.id

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {displayName}
          </h1>
          {profile.is_verified_student ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              {t({ en: 'Verified Student', el: 'Επαληθευμένος φοιτητής' })}
            </span>
          ) : null}
        </div>
        <div className="mt-4 space-y-1 text-sm text-slate-600">
          <p>
            {t({ en: 'University', el: 'Πανεπιστήμιο' })}: {universityName || t({ en: '—', el: '—' })}
          </p>
          <p>
            {t({ en: 'School', el: 'Σχολή' })}: {schoolName || t({ en: '—', el: '—' })}
          </p>
          <p>
            {t({ en: 'City', el: 'Πόλη' })}: {cityName || t({ en: '—', el: '—' })}
          </p>
          {profile.study_year ? (
            <p>
              {t({ en: 'Study year', el: 'Έτος φοίτησης' })}: {profile.study_year}
            </p>
          ) : null}
        </div>
        {canMessage ? (
          <button
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleSendMessage}
            disabled={isConversationLoading}
          >
            {isConversationLoading
              ? t({ en: 'Opening...', el: 'Ανοίγουμε...' })
              : t({ en: 'Send message', el: 'Στείλε μήνυμα' })}
          </button>
        ) : null}
        {conversationError ? (
          <p className="mt-3 text-sm text-rose-600">{t(conversationError)}</p>
        ) : null}
      </header>
    </section>
  )
}
