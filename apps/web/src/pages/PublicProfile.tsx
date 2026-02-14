import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type PublicProfileRecord = {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  school_id: string | null
  university_id: string | null
  city_id: string | null
  study_year: number | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
  followers_count: number | null
  following_count: number | null
}

type FollowerPreview = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type PostgrestErrorLike = {
  message?: string | null
  details?: string | null
  hint?: string | null
}

const hasMissingSchemaError = (error: PostgrestErrorLike | null | undefined, token?: string) => {
  if (!error) return false
  const joined = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  if (token && !joined.includes(token.toLowerCase())) return false
  return (
    joined.includes('does not exist') ||
    joined.includes('could not find the table') ||
    joined.includes('schema cache')
  )
}

const getConversationIdFromRpc = (data: unknown) => {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return (data[0] as { conversation_id?: string } | undefined)?.conversation_id ?? ''
  if (data && typeof data === 'object' && 'conversation_id' in data) {
    return (data as { conversation_id?: string }).conversation_id ?? ''
  }
  return ''
}

export default function PublicProfile() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<PublicProfileRecord | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserVerified, setCurrentUserVerified] = useState(false)
  const [currentUserPreStudent, setCurrentUserPreStudent] = useState(false)
  const [universityName, setUniversityName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [cityName, setCityName] = useState('')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followers, setFollowers] = useState<FollowerPreview[]>([])
  const [supportsFollowSystem, setSupportsFollowSystem] = useState(true)

  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [followLoading, setFollowLoading] = useState(false)
  const [conversationLoading, setConversationLoading] = useState(false)
  const [conversationError, setConversationError] = useState('')
  const [isAvatarZoomOpen, setIsAvatarZoomOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadPage = async () => {
      setIsLoading(true)
      setErrorMessage('')

      if (!id) {
        setErrorMessage(t({ en: 'Profile not found.', el: 'Το προφιλ δεν βρεθηκε.' }))
        setIsLoading(false)
        return
      }

      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id ?? ''
      if (isMounted) {
        setCurrentUserId(userId)
      }

      if (userId) {
        const { data: me } = await supabase
          .from('profiles')
          .select('is_verified_student, is_pre_student')
          .eq('id', userId)
          .maybeSingle()

        if (isMounted) {
          const verified = Boolean(me?.is_verified_student)
          setCurrentUserVerified(verified)
          setCurrentUserPreStudent(Boolean(me?.is_pre_student) && !verified)
        }
      }

      const profileWithSocialRes = await supabase
        .from('public_profiles')
        .select(
          'id, display_name, avatar_url, bio, school_id, university_id, city_id, study_year, is_verified_student, is_pre_student, followers_count, following_count',
        )
        .eq('id', id)
        .maybeSingle()

      let profileData = profileWithSocialRes.data as PublicProfileRecord | null
      let profileError = profileWithSocialRes.error

      if (profileWithSocialRes.error && hasMissingSchemaError(profileWithSocialRes.error)) {
        const profileLegacyRes = await supabase
          .from('public_profiles')
          .select(
            'id, display_name, avatar_url, school_id, university_id, city_id, study_year, is_verified_student, is_pre_student',
          )
          .eq('id', id)
          .maybeSingle()

        profileData = profileLegacyRes.data
          ? ({
              ...(profileLegacyRes.data as Omit<PublicProfileRecord, 'followers_count' | 'following_count'>),
              followers_count: 0,
              following_count: 0,
              bio: null,
              avatar_url: null,
            } as PublicProfileRecord)
          : null
        profileError = profileLegacyRes.error
      }

      if (!isMounted) return

      if (profileError || !profileData) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setErrorMessage(`Unable to load profile${details}.`)
        setIsLoading(false)
        return
      }

      const typedProfile = profileData as PublicProfileRecord
      setProfile(typedProfile)

      const [universityRes, schoolRes, cityRes] = await Promise.all([
        typedProfile.university_id
          ? supabase.from('universities').select('name').eq('id', typedProfile.university_id).maybeSingle()
          : Promise.resolve({ data: null as { name?: string } | null }),
        typedProfile.school_id
          ? supabase.from('schools').select('name').eq('id', typedProfile.school_id).maybeSingle()
          : Promise.resolve({ data: null as { name?: string } | null }),
        typedProfile.city_id
          ? supabase.from('cities').select('name').eq('id', typedProfile.city_id).maybeSingle()
          : Promise.resolve({ data: null as { name?: string } | null }),
      ])

      if (!isMounted) return

      setUniversityName(universityRes.data?.name ?? '')
      setSchoolName(schoolRes.data?.name ?? '')
      setCityName(cityRes.data?.name ?? '')

      if (userId && userId !== id) {
        const followRowRes = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', userId)
          .eq('followed_id', id)
          .maybeSingle()

        if (isMounted) {
          if (hasMissingSchemaError(followRowRes.error, 'follows')) {
            setSupportsFollowSystem(false)
            setIsFollowing(false)
          } else {
            setSupportsFollowSystem(true)
            setIsFollowing(Boolean(followRowRes.data))
          }
        }
      } else {
        setIsFollowing(false)
      }

      if (userId && currentUserVerified && typedProfile.is_verified_student && supportsFollowSystem) {
        const followerRowsRes = await supabase
          .from('follows')
          .select('follower_id')
          .eq('followed_id', id)
          .limit(20)

        if (hasMissingSchemaError(followerRowsRes.error, 'follows')) {
          setSupportsFollowSystem(false)
          setFollowers([])
          setIsLoading(false)
          return
        }

        const followerIds = (followerRowsRes.data ?? []).map((row) => row.follower_id)

        if (followerIds.length > 0) {
          const { data: followerProfiles } = await supabase
            .from('public_profiles')
            .select('id, display_name, avatar_url')
            .in('id', followerIds)

          if (isMounted) {
            setFollowers((followerProfiles ?? []) as FollowerPreview[])
          }
        } else {
          setFollowers([])
        }
      } else {
        setFollowers([])
      }

      setIsLoading(false)
    }

    loadPage()

    return () => {
      isMounted = false
    }
  }, [id, currentUserVerified, supportsFollowSystem, t])

  const handleToggleFollow = async () => {
    if (!profile || !currentUserId || currentUserId === profile.id) return
    if (!currentUserVerified || currentUserPreStudent || !supportsFollowSystem || !profile.is_verified_student) return

    setFollowLoading(true)

    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('followed_id', profile.id)

      if (!error) {
        setIsFollowing(false)
        setProfile((previous) =>
          previous
            ? {
                ...previous,
                followers_count: Math.max(0, (previous.followers_count ?? 1) - 1),
              }
            : previous,
        )
      }
      setFollowLoading(false)
      return
    }

    const { error } = await supabase.from('follows').insert({
      follower_id: currentUserId,
      followed_id: profile.id,
    })

    if (!error) {
      setIsFollowing(true)
      setProfile((previous) =>
        previous
          ? {
              ...previous,
              followers_count: (previous.followers_count ?? 0) + 1,
            }
          : previous,
      )
    }

    setFollowLoading(false)
  }

  const handleSendMessage = async () => {
    if (!profile || !currentUserId || currentUserId === profile.id) return

    setConversationLoading(true)
    setConversationError('')

    let conversationId = ''
    const primaryRpc = await supabase.rpc('get_or_create_conversation', {
      user_a: currentUserId,
      user_b: profile.id,
    })

    if (primaryRpc.error) {
      const fallbackRpc = await supabase.rpc('start_conversation', {
        other_user_id: profile.id,
      })
      if (fallbackRpc.error) {
        setConversationError(t({ en: 'Unable to start conversation.', el: 'Αδυναμία εκκίνησης συνομιλίας.' }))
        setConversationLoading(false)
        return
      }
      conversationId = getConversationIdFromRpc(fallbackRpc.data)
    } else {
      conversationId = getConversationIdFromRpc(primaryRpc.data)
    }

    if (!conversationId) {
      setConversationError(t({ en: 'Conversation not found.', el: 'Η συνομιλία δεν βρέθηκε.' }))
      setConversationLoading(false)
      return
    }

    navigate(`/chats?c=${conversationId}`)
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t({ en: 'Profile', el: 'Προφιλ' })}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t({ en: 'Loading profile...', el: 'Φορτωση προφιλ...' })}</p>
      </section>
    )
  }

  if (errorMessage || !profile) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">{t({ en: 'Profile', el: 'Προφιλ' })}</h1>
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage || t({ en: 'Profile not found.', el: 'Το προφιλ δεν βρεθηκε.' })}</p>
      </section>
    )
  }

  const displayName = profile.display_name?.trim() || t({ en: 'Student', el: 'Φοιτητης' })
  const canMessage = currentUserId && currentUserId !== profile.id
  const canFollow =
    canMessage &&
    currentUserVerified &&
    !currentUserPreStudent &&
    supportsFollowSystem &&
    Boolean(profile.is_verified_student)

  return (
    <section className="space-y-4">
      <header className="social-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!profile.avatar_url) return
                setIsAvatarZoomOpen(true)
              }}
              className="rounded-full"
            >
              <Avatar name={displayName} url={profile.avatar_url} size="lg" showRing />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{displayName}</h1>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {profile.is_verified_student
                  ? t({ en: 'Verified student', el: 'Επαληθευμενος φοιτητης' })
                  : t({ en: 'Pre-student', el: 'Προ-φοιτητης' })}
              </p>
              {profile.bio ? (
                <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">{profile.bio}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canMessage ? (
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={conversationLoading}
                className="rounded-xl border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
              >
                {conversationLoading
                  ? t({ en: 'Opening...', el: 'Ανοιγμα...' })
                  : t({ en: 'Message', el: 'Μηνυμα' })}
              </button>
            ) : null}

            {canFollow ? (
              <button
                type="button"
                onClick={handleToggleFollow}
                disabled={followLoading}
                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                  isFollowing
                    ? 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                }`}
              >
                {followLoading
                  ? '...'
                  : isFollowing
                    ? t({ en: 'Following', el: 'Ακολουθεις' })
                    : t({ en: 'Follow', el: 'Ακολουθησε' })}
              </button>
            ) : canMessage ? (
              <span className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                {supportsFollowSystem
                  ? t({ en: 'Follow locked for this account', el: 'Το follow ειναι κλειδωμενο για αυτον τον λογαριασμο' })
                  : t({ en: 'Follow requires social migration', el: 'Το follow απαιτει social migration' })}
              </span>
            ) : null}
          </div>
        </div>

        {conversationError ? (
          <p className="mt-3 text-sm text-rose-300">{conversationError}</p>
        ) : null}

        <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
          <p>{`${t({ en: 'University', el: 'Πανεπιστημιο' })}: ${universityName || '-'}`}</p>
          <p>{`${t({ en: 'School', el: 'Σχολη' })}: ${schoolName || '-'}`}</p>
          <p>{`${t({ en: 'City', el: 'Πολη' })}: ${cityName || '-'}`}</p>
          <p>{`${t({ en: 'Study year', el: 'Ετος σπουδων' })}: ${profile.study_year ?? '-'}`}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">{t({ en: 'Followers', el: 'Ακολουθοι' })}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{profile.followers_count ?? 0}</p>
          </div>
          <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">{t({ en: 'Following', el: 'Ακολουθεις' })}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{profile.following_count ?? 0}</p>
          </div>
        </div>
      </header>

      {currentUserVerified ? (
        <section className="social-card p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t({ en: 'Followers list', el: 'Λιστα ακολουθων' })}</h2>
          {followers.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{t({ en: 'No followers yet.', el: 'Δεν υπαρχουν ακολουθοι ακομα.' })}</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {followers.map((follower) => (
                <Link
                  key={follower.id}
                  to={`/profile/${follower.id}`}
                  className="flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2"
                >
                  <Avatar name={follower.display_name || t({ en: 'Student', el: 'Φοιτητης' })} url={follower.avatar_url} size="sm" />
                  <span className="truncate text-sm text-[var(--text-primary)]">{follower.display_name || t({ en: 'Student', el: 'Φοιτητης' })}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {isAvatarZoomOpen ? (
        <button
          type="button"
          onClick={() => setIsAvatarZoomOpen(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4"
        >
          <img
            src={profile.avatar_url ?? ''}
            alt={displayName}
            className="max-h-[86vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          />
        </button>
      ) : null}
    </section>
  )
}
