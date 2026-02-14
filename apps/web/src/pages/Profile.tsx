import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  university_id: string | null
  school_id: string | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
  followers_count: number | null
  following_count: number | null
}

type BadgeItem = {
  id: string
  title: string
  description: string
  requirement: string
  progress: number
  unlocked: boolean
  lockedForPreStudent: boolean
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

const computeStreak = (dates: string[]) => {
  const dateSet = new Set(
    dates
      .map((value) => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return null
        date.setHours(0, 0, 0, 0)
        return date.getTime()
      })
      .filter((value): value is number => value !== null),
  )

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (dateSet.has(cursor.getTime())) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

const clampProgress = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export default function Profile() {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [userId, setUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarLoadError, setAvatarLoadError] = useState(false)
  const [avatarUploadMessage, setAvatarUploadMessage] = useState('')
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

  const [universityName, setUniversityName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const [listingsCount, setListingsCount] = useState(0)
  const [wantedCount, setWantedCount] = useState(0)
  const [commentsCount, setCommentsCount] = useState(0)
  const [streakDays, setStreakDays] = useState(0)

  const [verificationEmail, setVerificationEmail] = useState('')
  const [isVerificationLoading, setIsVerificationLoading] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')

  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        const details = authError?.message ? ` (${authError.message})` : ''
        setErrorMessage(`Unable to load profile${details}.`)
        setIsLoading(false)
        return
      }

      const currentUserId = authData.user.id
      const currentEmail = authData.user.email ?? ''

      const profileWithSocialRes = await supabase
        .from('profiles')
        .select(
          'id, display_name, avatar_url, university_id, school_id, is_verified_student, is_pre_student, followers_count, following_count',
        )
        .eq('id', currentUserId)
        .maybeSingle()

      let profileData = profileWithSocialRes.data as ProfileRow | null
      let profileError = profileWithSocialRes.error

      if (profileWithSocialRes.error && hasMissingSchemaError(profileWithSocialRes.error)) {
        const profileLegacyRes = await supabase
          .from('profiles')
          .select(
            'id, display_name, avatar_url, university_id, school_id, is_verified_student, is_pre_student',
          )
          .eq('id', currentUserId)
          .maybeSingle()

        profileData = profileLegacyRes.data
          ? ({
              ...(profileLegacyRes.data as Omit<ProfileRow, 'followers_count' | 'following_count'>),
              followers_count: 0,
              following_count: 0,
            } as ProfileRow)
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

      const profile = profileData as ProfileRow
      const verified = Boolean(profile.is_verified_student)
      const preStudent = Boolean(profile.is_pre_student) && !verified

      setUserId(currentUserId)
      setEmail(currentEmail)
      setDisplayName(profile.display_name || currentEmail)
      setAvatarUrl(profile.avatar_url ?? '')
      setAvatarLoadError(false)
      setIsVerifiedStudent(verified)
      setIsPreStudent(preStudent)
      setFollowersCount(profile.followers_count ?? 0)
      setFollowingCount(profile.following_count ?? 0)

      const [universityRes, schoolRes, sellCountRes, wantCountRes, commentCountRes, activityRes] =
        await Promise.all([
          profile.university_id
            ? supabase.from('universities').select('name').eq('id', profile.university_id).maybeSingle()
            : Promise.resolve({ data: null as { name?: string } | null }),
          profile.school_id
            ? supabase.from('schools').select('name').eq('id', profile.school_id).maybeSingle()
            : Promise.resolve({ data: null as { name?: string } | null }),
          supabase
            .from('listings')
            .select('id', { head: true, count: 'exact' })
            .eq('seller_id', currentUserId),
          supabase
            .from('wanted_listings')
            .select('id', { head: true, count: 'exact' })
            .eq('user_id', currentUserId),
          supabase
            .from('feed_comments')
            .select('id', { head: true, count: 'exact' })
            .eq('author_id', currentUserId),
          supabase
            .from('activity_posts')
            .select('created_at')
            .eq('author_id', currentUserId)
            .gte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()),
        ])

      if (!isMounted) return

      setUniversityName(universityRes.data?.name ?? '')
      setSchoolName(schoolRes.data?.name ?? '')
      setListingsCount(sellCountRes.count ?? 0)
      setWantedCount(wantCountRes.count ?? 0)
      setCommentsCount(commentCountRes.count ?? 0)
      setStreakDays(computeStreak((activityRes.data ?? []).map((row) => row.created_at)))

      setIsLoading(false)
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const totalXp = useMemo(() => {
    const base = 120
    const value =
      base +
      listingsCount * 60 +
      wantedCount * 40 +
      commentsCount * 20 +
      streakDays * 30 +
      (isVerifiedStudent ? 250 : 0)
    return value
  }, [commentsCount, isVerifiedStudent, listingsCount, streakDays, wantedCount])

  const badges = useMemo<BadgeItem[]>(() => {
    const interactions = listingsCount + wantedCount + commentsCount

    const raw = [
      {
        id: 'streak-7',
        title: 'Consistency Streak',
        description: 'Active for 7 days in a row.',
        requirement: `${Math.min(streakDays, 7)}/7 days`,
        progress: clampProgress((streakDays / 7) * 100),
      },
      {
        id: 'listings-3',
        title: 'Marketplace Starter',
        description: 'Upload 3 listings.',
        requirement: `${Math.min(listingsCount, 3)}/3 listings`,
        progress: clampProgress((listingsCount / 3) * 100),
      },
      {
        id: 'helper-5',
        title: 'Student Helper',
        description: 'Help 5 students via comments/notes.',
        requirement: `${Math.min(commentsCount, 5)}/5 helpful actions`,
        progress: clampProgress((commentsCount / 5) * 100),
      },
      {
        id: 'interactions-10',
        title: 'Campus Connector',
        description: 'Complete 10 marketplace interactions.',
        requirement: `${Math.min(interactions, 10)}/10 interactions`,
        progress: clampProgress((interactions / 10) * 100),
      },
    ]

    return raw.map((badge) => {
      const lockedForPreStudent = !isVerifiedStudent && badge.id !== 'streak-7'
      const effectiveProgress = lockedForPreStudent ? Math.min(45, badge.progress) : badge.progress
      return {
        ...badge,
        progress: effectiveProgress,
        unlocked: effectiveProgress >= 100,
        lockedForPreStudent,
      }
    })
  }, [commentsCount, isVerifiedStudent, listingsCount, streakDays, wantedCount])

  const handleAvatarSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !userId) return

    if (!file.type.startsWith('image/')) {
      setAvatarUploadMessage('Please upload an image file.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarUploadMessage('Max file size is 2 MB.')
      return
    }

    setAvatarUploadMessage('')
    setPendingAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
  }

  const handleAvatarConfirm = async () => {
    if (!pendingAvatarFile || !userId) return

    setIsAvatarUploading(true)
    setAvatarUploadMessage('')

    const filePath = `avatars/${userId}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, pendingAvatarFile, { upsert: true, contentType: pendingAvatarFile.type })

    if (uploadError) {
      setAvatarUploadMessage('Avatar upload failed.')
      setIsAvatarUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    if (updateError) {
      setAvatarUploadMessage('Profile update failed.')
      setIsAvatarUploading(false)
      return
    }

    setAvatarUrl(publicUrl)
    setAvatarLoadError(false)
    setAvatarUploadMessage('Avatar updated.')
    setIsAvatarUploading(false)
    handleAvatarCancel()
  }

  const handleAvatarCancel = () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl)
    setPendingAvatarFile(null)
    setAvatarPreviewUrl(null)
  }

  const handleVerificationRequest = async () => {
    setVerificationMessage('')
    setIsVerificationLoading(true)

    const { error } = await supabase.rpc('request_university_verification', {
      p_university_email: verificationEmail,
    })

    if (error) {
      setVerificationMessage(error.message)
      setIsVerificationLoading(false)
      return
    }

    setVerificationMessage('Verification email sent. Check your inbox.')
    setIsVerificationLoading(false)
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t({ en: 'Profile', el: 'Προφιλ' })}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t({ en: 'Loading profile...', el: 'Φορτωση προφιλ...' })}</p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t({ en: 'Profile', el: 'Προφιλ' })}</h1>
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errorMessage}</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="social-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={displayName || email} url={avatarLoadError ? null : avatarUrl} size="lg" showRing />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{displayName || email}</h1>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {isVerifiedStudent
                  ? t({ en: 'Verified student', el: 'Επαληθευμενος φοιτητης' })
                  : t({ en: 'Pre-student', el: 'Προ-φοιτητης' })}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {[universityName, schoolName].filter(Boolean).join(' / ') ||
                  t({ en: 'Campus member', el: 'Μελος campus' })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!avatarPreviewUrl && (
              <label className="cursor-pointer rounded-xl border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-blue-400/50">
                {t({ en: 'Change avatar', el: 'Αλλαγη avatar' })}
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarSelect} disabled={isAvatarUploading} />
              </label>
            )}
            <Link to="/profile/edit" className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950">
              {t({ en: 'Edit profile', el: 'Επεξεργασια προφιλ' })}
            </Link>
          </div>
        </div>

        {avatarPreviewUrl && (
          <div className="mt-3 flex items-center gap-3">
            <img src={avatarPreviewUrl} alt="Preview" className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-400/40" />
            <div className="flex gap-2">
              <button
                onClick={handleAvatarConfirm}
                disabled={isAvatarUploading}
                className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
              >
                {isAvatarUploading ? t({ en: 'Uploading...', el: 'Ανεβασμα...' }) : t({ en: 'Upload', el: 'Ανεβασμα' })}
              </button>
              <button
                onClick={handleAvatarCancel}
                disabled={isAvatarUploading}
                className="rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-50"
              >
                {t({ en: 'Cancel', el: 'Ακυρωση' })}
              </button>
            </div>
          </div>
        )}

        {avatarUploadMessage ? <p className="mt-3 text-xs text-[var(--text-secondary)]">{avatarUploadMessage}</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"><p className="text-[11px] text-[var(--text-secondary)]">{t({ en: 'Followers', el: 'Ακολουθοι' })}</p><p className="text-lg font-semibold text-[var(--text-primary)]">{followersCount}</p></div>
          <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"><p className="text-[11px] text-[var(--text-secondary)]">{t({ en: 'Following', el: 'Ακολουθεις' })}</p><p className="text-lg font-semibold text-[var(--text-primary)]">{followingCount}</p></div>
          <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"><p className="text-[11px] text-[var(--text-secondary)]">{t({ en: 'Listings', el: 'Αγγελιες' })}</p><p className="text-lg font-semibold text-[var(--text-primary)]">{listingsCount}</p></div>
          <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"><p className="text-[11px] text-[var(--text-secondary)]">{t({ en: 'Requests', el: 'Ζητησεις' })}</p><p className="text-lg font-semibold text-[var(--text-primary)]">{wantedCount}</p></div>
        </div>
      </header>

      <section className="social-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t({ en: 'Streak and XP', el: 'Streak και XP' })}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {t({ en: 'XP is visible only on your profile.', el: 'Το XP φαινεται μονο στο προφιλ σου.' })}
            </p>
          </div>
          <span className="rounded-full border border-orange-300/40 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-100">{t({ en: `Streak: ${streakDays} day${streakDays === 1 ? '' : 's'}`, el: `Streak: ${streakDays} μερες` })}</span>
        </div>

        <div className="mt-3 rounded-xl bg-[var(--surface-soft)] px-3 py-3">
          <p className="text-xs text-[var(--text-secondary)]">{t({ en: 'Profile XP', el: 'XP προφιλ' })}</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{totalXp}</p>
        </div>
      </section>

      <section className="social-card p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t({ en: 'Badges', el: 'Badges' })}</h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{t({ en: 'Tap a badge to view requirements and progress.', el: 'Πατησε σε ενα badge για περιγραφη και προοδο.' })}</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {badges.map((badge) => (
            <button
              key={badge.id}
              type="button"
              onClick={() => setSelectedBadge(badge)}
              className={`rounded-xl border px-3 py-3 text-left ${badge.unlocked ? 'border-emerald-300/40 bg-emerald-500/10' : 'border-[var(--border-primary)] bg-[var(--surface-soft)]'}`}
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">{badge.title}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{badge.unlocked ? t({ en: 'Unlocked', el: 'Ξεκλειδωμενο' }) : t({ en: `Progress ${badge.progress}%`, el: `Προοδος ${badge.progress}%` })}</p>
            </button>
          ))}
        </div>
      </section>

      {!isVerifiedStudent ? (
        <section className="social-card p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t({ en: 'Verify student status', el: 'Επαληθευση φοιτητικης ιδιοτητας' })}</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{t({ en: 'Pre-students can browse and chat, but selling/following unlocks after verification.', el: 'Οι pre-students μπορουν να κανουν browse/chat, αλλα selling/following ξεκλειδωνει μετα το verification.' })}</p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={verificationEmail}
              onChange={(event) => setVerificationEmail(event.target.value)}
              placeholder={t({ en: 'University email', el: 'Πανεπιστημιακο email' })}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={handleVerificationRequest}
              disabled={isVerificationLoading || !verificationEmail.trim()}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
            >
              {isVerificationLoading
                ? t({ en: 'Sending...', el: 'Αποστολη...' })
                : t({ en: 'Send verification', el: 'Στειλε verification' })}
            </button>
          </div>

          {verificationMessage ? <p className="mt-2 text-xs text-[var(--text-secondary)]">{verificationMessage}</p> : null}
          {isPreStudent ? <p className="mt-2 text-xs text-amber-100">{t({ en: 'Limited badge progression is active until verification.', el: 'Η περιορισμενη προοδος badges ειναι ενεργη μεχρι το verification.' })}</p> : null}
        </section>
      ) : null}

      {selectedBadge ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" onClick={() => setSelectedBadge(null)}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-elevated)] p-5" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{selectedBadge.title}</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{selectedBadge.description}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">{selectedBadge.requirement}</p>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${selectedBadge.progress}%` }} />
            </div>

            {selectedBadge.lockedForPreStudent ? (
              <p className="mt-2 text-xs text-amber-100">{t({ en: 'Unlock full progress by verifying your student status.', el: 'Κανε verification για να ξεκλειδωσεις πληρη προοδο.' })}</p>
            ) : null}

            <button
              type="button"
              onClick={() => setSelectedBadge(null)}
              className="mt-4 rounded-xl border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
            >
              {t({ en: 'Close', el: 'Κλεισιμο' })}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
