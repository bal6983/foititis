import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type ViewMode = 'recommended' | 'all'

type CurrentProfile = {
  id: string
  university_id: string | null
  study_year: number | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
}

type PeerProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  university_id: string | null
  study_year: number | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
  followers_count: number | null
  last_seen_at: string | null
}

type UniversityRow = {
  id: string
  name: string
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

export default function Students() {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('recommended')
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUniversityId, setCurrentUniversityId] = useState<string | null>(null)
  const [currentStudyYear, setCurrentStudyYear] = useState<number | null>(null)
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [supportsFollowSystem, setSupportsFollowSystem] = useState(true)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [universitiesMap, setUniversitiesMap] = useState<Map<string, string>>(new Map())
  const [peers, setPeers] = useState<PeerProfileRow[]>([])

  const loadStudents = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      const details = authError?.message ? ` (${authError.message})` : ''
      setErrorMessage(t({ en: `Unable to load students${details}.`, el: `Αδυναμια φορτωσης φοιτητων${details}.` }))
      setIsLoading(false)
      return
    }

    const userId = authData.user.id
    setCurrentUserId(userId)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, university_id, study_year, is_verified_student, is_pre_student')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profileData) {
      const details = profileError?.message ? ` (${profileError.message})` : ''
      setErrorMessage(t({ en: `Unable to load profile${details}.`, el: `Αδυναμια φορτωσης προφιλ${details}.` }))
      setIsLoading(false)
      return
    }

    const currentProfile = profileData as CurrentProfile
    const verified = currentProfile.is_verified_student === true
    const preStudent = currentProfile.is_pre_student === true && !verified

    setCurrentUniversityId(currentProfile.university_id)
    setCurrentStudyYear(currentProfile.study_year)
    setIsVerifiedStudent(verified)
    setIsPreStudent(preStudent)

    const peersWithSocial = await supabase
      .from('public_profiles')
      .select(
        'id, display_name, avatar_url, university_id, study_year, is_verified_student, is_pre_student, followers_count, last_seen_at',
      )
      .neq('id', userId)
      .limit(240)

    let peerRows: PeerProfileRow[] = []
    if (peersWithSocial.error && hasMissingSchemaError(peersWithSocial.error, 'followers_count')) {
      const peersLegacy = await supabase
        .from('public_profiles')
        .select(
          'id, display_name, avatar_url, university_id, study_year, is_verified_student, is_pre_student',
        )
        .neq('id', userId)
        .limit(240)

      peerRows = ((peersLegacy.data ?? []) as PeerProfileRow[]).map((peer) => ({
        ...peer,
        followers_count: 0,
        last_seen_at: null,
      }))
    } else if (peersWithSocial.error) {
      const details = peersWithSocial.error.message ? ` (${peersWithSocial.error.message})` : ''
      setErrorMessage(t({ en: `Unable to load students${details}.`, el: `Αδυναμια φορτωσης φοιτητων${details}.` }))
      setIsLoading(false)
      return
    } else {
      peerRows = (peersWithSocial.data ?? []) as PeerProfileRow[]
    }

    const universityIds = Array.from(
      new Set(peerRows.map((peer) => peer.university_id).filter((id): id is string => Boolean(id))),
    )
    if (universityIds.length > 0) {
      const { data: universityRows } = await supabase
        .from('universities')
        .select('id, name')
        .in('id', universityIds)

      setUniversitiesMap(new Map(((universityRows ?? []) as UniversityRow[]).map((row) => [row.id, row.name])))
    } else {
      setUniversitiesMap(new Map())
    }

    const followsRes = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', userId)

    if (hasMissingSchemaError(followsRes.error, 'follows')) {
      setSupportsFollowSystem(false)
      setFollowedIds(new Set())
    } else {
      setSupportsFollowSystem(true)
      setFollowedIds(new Set((followsRes.data ?? []).map((item) => item.followed_id)))
    }

    setPeers(peerRows)
    setIsLoading(false)
  }, [t])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadStudents()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadStudents])

  const visiblePeers = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    let rows = [...peers]

    if (viewMode === 'recommended') {
      const sameUniversity = rows.filter(
        (peer) => currentUniversityId !== null && peer.university_id === currentUniversityId,
      )
      const sameYear = rows.filter(
        (peer) =>
          currentStudyYear !== null &&
          peer.study_year !== null &&
          peer.study_year === currentStudyYear &&
          peer.university_id !== currentUniversityId,
      )
      const rest = rows.filter(
        (peer) =>
          !(currentUniversityId !== null && peer.university_id === currentUniversityId) &&
          !(
            currentStudyYear !== null &&
            peer.study_year !== null &&
            peer.study_year === currentStudyYear
          ),
      )

      rows = [...sameUniversity, ...sameYear, ...rest]
    }

    rows = rows.sort((a, b) => {
      const aVerified = a.is_verified_student === true && a.is_pre_student !== true
      const bVerified = b.is_verified_student === true && b.is_pre_student !== true
      if (aVerified !== bVerified) return aVerified ? -1 : 1

      const aUni = currentUniversityId !== null && a.university_id === currentUniversityId
      const bUni = currentUniversityId !== null && b.university_id === currentUniversityId
      if (aUni !== bUni) return aUni ? -1 : 1
      const aYear = currentStudyYear !== null && a.study_year === currentStudyYear
      const bYear = currentStudyYear !== null && b.study_year === currentStudyYear
      if (aYear !== bYear) return aYear ? -1 : 1
      return (b.followers_count ?? 0) - (a.followers_count ?? 0)
    })

    if (!normalized) return rows.slice(0, 80)

    return rows
      .filter((peer) => {
        const name = (peer.display_name ?? '').toLowerCase()
        const universityName = peer.university_id
          ? (universitiesMap.get(peer.university_id) ?? '').toLowerCase()
          : ''
        return name.includes(normalized) || universityName.includes(normalized)
      })
      .slice(0, 80)
  }, [currentStudyYear, currentUniversityId, peers, search, universitiesMap, viewMode])

  const handleToggleFollow = async (targetId: string) => {
    if (
      !currentUserId ||
      !isVerifiedStudent ||
      isPreStudent ||
      !supportsFollowSystem ||
      targetId === currentUserId
    ) {
      return
    }

    const isFollowing = followedIds.has(targetId)
    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('followed_id', targetId)
      if (!error) {
        setFollowedIds((previous) => {
          const next = new Set(previous)
          next.delete(targetId)
          return next
        })
      }
      return
    }

    const { error } = await supabase.from('follows').insert({
      follower_id: currentUserId,
      followed_id: targetId,
    })
    if (!error) {
      setFollowedIds((previous) => new Set(previous).add(targetId))
    }
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Students', el: 'Φοιτητες' })}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({ en: 'Loading student recommendations...', el: 'Φορτωση προτασεων φοιτητων...' })}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="social-card space-y-3 p-5">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Students', el: 'Φοιτητες' })}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({
            en: 'Find and follow students from your university and year.',
            el: 'Βρες και ακολουθησε φοιτητες απο το πανεπιστημιο και το ετος σου.',
          })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              viewMode === 'recommended'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                : 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
            }`}
            onClick={() => setViewMode('recommended')}
          >
            {t({ en: 'Recommended', el: 'Προτεινομενοι' })}
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              viewMode === 'all'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                : 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
            }`}
            onClick={() => setViewMode('all')}
          >
            {t({ en: 'All students', el: 'Ολοι οι φοιτητες' })}
          </button>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t({ en: 'Search by name or university', el: 'Αναζητηση ονοματος ή πανεπιστημιου' })}
            className="min-w-[220px] rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-4 py-1.5 text-xs text-[var(--text-primary)]"
          />
        </div>
        {!supportsFollowSystem ? (
          <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t({
              en: 'Follow system is disabled until social migrations are applied.',
              el: 'Το follow συστημα ειναι απενεργοποιημενο μεχρι να εφαρμοστουν τα social migrations.',
            })}
          </p>
        ) : null}
        {isPreStudent ? (
          <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t({
              en: 'Pre-student accounts can browse students but cannot follow yet.',
              el: 'Οι pre-student λογαριασμοι βλεπουν φοιτητες αλλα δεν μπορουν ακομα να κανουν follow.',
            })}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}
      </header>

      {visiblePeers.length === 0 ? (
        <section className="social-card p-5 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t({ en: 'No students found for this filter.', el: 'Δεν βρεθηκαν φοιτητες για αυτο το filter.' })}
          </p>
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePeers.map((peer) => {
            const peerName = peer.display_name ?? t({ en: 'Student', el: 'Φοιτητης' })
            const isFollowing = followedIds.has(peer.id)
            const canFollow =
              isVerifiedStudent && !isPreStudent && supportsFollowSystem && peer.is_verified_student === true

            return (
              <article key={peer.id} className="social-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/profile/${peer.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Avatar name={peerName} url={peer.avatar_url} size="md" online={peer.last_seen_at !== null} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{peerName}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {peer.university_id
                            ? universitiesMap.get(peer.university_id) ?? t({ en: 'University', el: 'Πανεπιστημιο' })
                            : t({ en: 'University', el: 'Πανεπιστημιο' })}
                        </p>
                      </div>
                    </div>
                  </Link>
                  {canFollow ? (
                    <button
                      type="button"
                      onClick={() => handleToggleFollow(peer.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isFollowing
                          ? 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                      }`}
                    >
                      {isFollowing
                        ? t({ en: 'Following', el: 'Ακολουθεις' })
                        : t({ en: 'Follow', el: 'Ακολουθησε' })}
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-200">
                      {t({ en: 'Locked', el: 'Κλειδωμενο' })}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                    {peer.study_year
                      ? t({ en: `Year ${peer.study_year}`, el: `Ετος ${peer.study_year}` })
                      : t({ en: 'Campus', el: 'Campus' })}
                  </span>
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                    {t({ en: `${peer.followers_count ?? 0} followers`, el: `${peer.followers_count ?? 0} followers` })}
                  </span>
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                    {peer.is_verified_student === true && peer.is_pre_student !== true
                      ? t({ en: 'Verified', el: 'Επαληθευμενος' })
                      : t({ en: 'Pre-student', el: 'Pre-student' })}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
