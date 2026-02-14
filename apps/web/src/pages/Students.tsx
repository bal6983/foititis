import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { useI18n } from '../lib/i18n'
import {
  recommendationScore,
  sortByRecommendation,
  type RecommendationContext,
} from '../lib/peerRecommendations'
import { supabase } from '../lib/supabaseClient'
import {
  fetchDepartmentsForSchool,
  fetchSchoolsForUniversity,
  fetchUniversitiesForCity,
} from '../lib/universityLookup'

type ViewMode = 'recommended' | 'all'

type CurrentProfile = {
  id: string
  city_id: string | null
  university_id: string | null
  school_id: string | null
  department_id: string | null
  study_year: number | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
}

type PeerProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  city_id: string | null
  university_id: string | null
  school_id: string | null
  department_id: string | null
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

type LookupOption = {
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

  const [isInitializing, setIsInitializing] = useState(true)
  const [isLoadingPeers, setIsLoadingPeers] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('recommended')

  const [currentUserId, setCurrentUserId] = useState('')
  const [currentCityId, setCurrentCityId] = useState<string | null>(null)
  const [currentUniversityId, setCurrentUniversityId] = useState<string | null>(null)
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null)
  const [currentDepartmentId, setCurrentDepartmentId] = useState<string | null>(null)
  const [currentStudyYear, setCurrentStudyYear] = useState<number | null>(null)
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [isPreStudent, setIsPreStudent] = useState(false)

  const [supportsFollowSystem, setSupportsFollowSystem] = useState(true)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  const [peers, setPeers] = useState<PeerProfileRow[]>([])
  const [universitiesMap, setUniversitiesMap] = useState<Map<string, string>>(new Map())

  const [filterCityId, setFilterCityId] = useState('')
  const [filterUniversityId, setFilterUniversityId] = useState('')
  const [filterSchoolId, setFilterSchoolId] = useState('')
  const [filterDepartmentId, setFilterDepartmentId] = useState('')

  const [cities, setCities] = useState<LookupOption[]>([])
  const [universities, setUniversities] = useState<LookupOption[]>([])
  const [schools, setSchools] = useState<LookupOption[]>([])
  const [departments, setDepartments] = useState<LookupOption[]>([])

  const loadInitialContext = useCallback(async () => {
    setIsInitializing(true)
    setErrorMessage('')

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      const details = authError?.message ? ` (${authError.message})` : ''
      setErrorMessage(
        t({
          en: `Unable to load students${details}.`,
          el: `Δεν ήταν δυνατή η φόρτωση φοιτητών${details}.`,
        }),
      )
      setIsInitializing(false)
      return
    }

    const userId = authData.user.id
    setCurrentUserId(userId)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, city_id, university_id, school_id, department_id, study_year, is_verified_student, is_pre_student')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profileData) {
      const details = profileError?.message ? ` (${profileError.message})` : ''
      setErrorMessage(
        t({
          en: `Unable to load profile${details}.`,
          el: `Δεν ήταν δυνατή η φόρτωση προφίλ${details}.`,
        }),
      )
      setIsInitializing(false)
      return
    }

    const currentProfile = profileData as CurrentProfile
    const verified = currentProfile.is_verified_student === true
    const preStudent = currentProfile.is_pre_student === true && !verified

    setCurrentCityId(currentProfile.city_id)
    setCurrentUniversityId(currentProfile.university_id)
    setCurrentSchoolId(currentProfile.school_id)
    setCurrentDepartmentId(currentProfile.department_id)
    setCurrentStudyYear(currentProfile.study_year)
    setIsVerifiedStudent(verified)
    setIsPreStudent(preStudent)

    const followsRes = await supabase.from('follows').select('followed_id').eq('follower_id', userId)
    if (hasMissingSchemaError(followsRes.error, 'follows')) {
      setSupportsFollowSystem(false)
      setFollowedIds(new Set())
    } else {
      setSupportsFollowSystem(true)
      setFollowedIds(new Set((followsRes.data ?? []).map((item) => item.followed_id)))
    }

    setIsInitializing(false)
  }, [t])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadInitialContext()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadInitialContext])

  useEffect(() => {
    let mounted = true

    const loadCities = async () => {
      const { data, error } = await supabase.from('cities').select('id, name').order('name')
      if (!mounted || error) return
      setCities((data ?? []) as LookupOption[])
    }

    void loadCities()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadUniversities = async () => {
      if (!filterCityId) {
        const { data, error } = await supabase.from('universities').select('id, name').order('name')
        if (!mounted || error) return
        setUniversities((data ?? []) as LookupOption[])
        return
      }

      const { data, error } = await fetchUniversitiesForCity(filterCityId)
      if (!mounted || error) return
      setUniversities((data ?? []) as LookupOption[])
    }

    void loadUniversities()
    return () => {
      mounted = false
    }
  }, [filterCityId])

  useEffect(() => {
    let mounted = true

    const loadSchools = async () => {
      if (!filterUniversityId) {
        setSchools([])
        setFilterSchoolId('')
        setDepartments([])
        setFilterDepartmentId('')
        return
      }

      const { data, error } = await fetchSchoolsForUniversity(filterUniversityId, {
        cityId: filterCityId || null,
      })
      if (!mounted || error) return
      setSchools((data ?? []) as LookupOption[])
    }

    void loadSchools()
    return () => {
      mounted = false
    }
  }, [filterCityId, filterUniversityId])

  useEffect(() => {
    let mounted = true

    const loadDepartments = async () => {
      if (!filterSchoolId) {
        setDepartments([])
        setFilterDepartmentId('')
        return
      }

      const { data, error } = await fetchDepartmentsForSchool(filterSchoolId, {
        cityId: filterCityId || null,
      })
      if (!mounted || error) return
      setDepartments((data ?? []) as LookupOption[])
    }

    void loadDepartments()
    return () => {
      mounted = false
    }
  }, [filterCityId, filterSchoolId])

  const loadPeers = useCallback(async () => {
    if (!currentUserId) return

    setIsLoadingPeers(true)
    setErrorMessage('')

    let withSocialQuery = supabase
      .from('public_profiles')
      .select(
        'id, display_name, avatar_url, city_id, university_id, school_id, department_id, study_year, is_verified_student, is_pre_student, followers_count, last_seen_at',
      )
      .neq('id', currentUserId)
      .limit(240)

    if (filterCityId) withSocialQuery = withSocialQuery.eq('city_id', filterCityId)
    if (filterUniversityId) withSocialQuery = withSocialQuery.eq('university_id', filterUniversityId)
    if (filterSchoolId) withSocialQuery = withSocialQuery.eq('school_id', filterSchoolId)
    if (filterDepartmentId) withSocialQuery = withSocialQuery.eq('department_id', filterDepartmentId)

    const peersWithSocial = await withSocialQuery

    let peerRows: PeerProfileRow[] = []
    if (peersWithSocial.error && hasMissingSchemaError(peersWithSocial.error, 'followers_count')) {
      let peersLegacyQuery = supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url, university_id, study_year, is_verified_student, is_pre_student')
        .neq('id', currentUserId)
        .limit(240)

      if (filterUniversityId) peersLegacyQuery = peersLegacyQuery.eq('university_id', filterUniversityId)

      const peersLegacy = await peersLegacyQuery
      peerRows = ((peersLegacy.data ?? []) as PeerProfileRow[]).map((peer) => ({
        ...peer,
        city_id: null,
        school_id: null,
        department_id: null,
        followers_count: 0,
        last_seen_at: null,
      }))
    } else if (peersWithSocial.error) {
      const details = peersWithSocial.error.message ? ` (${peersWithSocial.error.message})` : ''
      setErrorMessage(
        t({
          en: `Unable to load students${details}.`,
          el: `Δεν ήταν δυνατή η φόρτωση φοιτητών${details}.`,
        }),
      )
      setPeers([])
      setUniversitiesMap(new Map())
      setIsLoadingPeers(false)
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

    setPeers(peerRows)
    setIsLoadingPeers(false)
  }, [currentUserId, filterCityId, filterDepartmentId, filterSchoolId, filterUniversityId, t])

  useEffect(() => {
    void loadPeers()
  }, [loadPeers])

  const visiblePeers = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    let rows = [...peers]

    const recommendationContext: RecommendationContext = {
      cityId: currentCityId,
      universityId: currentUniversityId,
      schoolId: currentSchoolId,
      departmentId: currentDepartmentId,
      studyYear: currentStudyYear,
    }

    if (viewMode === 'recommended') {
      const rankedRows = sortByRecommendation(rows, recommendationContext)
      const closeRows = rankedRows.filter((peer) => recommendationScore(peer, recommendationContext) > 0)
      rows = closeRows.length > 0 ? closeRows : rankedRows
    } else {
      rows = [...rows].sort((a, b) => {
        const aVerified = a.is_verified_student === true && a.is_pre_student !== true
        const bVerified = b.is_verified_student === true && b.is_pre_student !== true
        if (aVerified !== bVerified) return aVerified ? -1 : 1
        return (b.followers_count ?? 0) - (a.followers_count ?? 0)
      })
    }

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
  }, [
    currentCityId,
    currentDepartmentId,
    currentSchoolId,
    currentStudyYear,
    currentUniversityId,
    peers,
    search,
    universitiesMap,
    viewMode,
  ])

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

  const clearFilters = () => {
    setFilterCityId('')
    setFilterUniversityId('')
    setFilterSchoolId('')
    setFilterDepartmentId('')
  }

  const fieldClass =
    'rounded-lg border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-primary)]'

  if (isInitializing) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Students', el: 'Φοιτητές' })}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({ en: 'Loading student recommendations...', el: 'Φόρτωση προτάσεων φοιτητών...' })}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="social-card space-y-3 p-5">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Students', el: 'Φοιτητές' })}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({
            en: 'Find and follow students from your university and year.',
            el: 'Βρες και ακολούθησε φοιτητές από το πανεπιστήμιο και το έτος σου.',
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
            {t({ en: 'Recommended', el: 'Προτεινόμενοι' })}
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
            {t({ en: 'All students', el: 'Όλοι οι φοιτητές' })}
          </button>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t({ en: 'Search by name or university', el: 'Αναζήτηση ονόματος ή πανεπιστημίου' })}
            className="min-w-[220px] rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-4 py-1.5 text-xs text-[var(--text-primary)]"
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <select
            className={fieldClass}
            value={filterCityId}
            onChange={(event) => setFilterCityId(event.target.value)}
          >
            <option value="">{t({ en: 'All cities', el: 'Όλες οι πόλεις' })}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>

          <select
            className={fieldClass}
            value={filterUniversityId}
            onChange={(event) => {
              setFilterUniversityId(event.target.value)
              setFilterSchoolId('')
              setFilterDepartmentId('')
            }}
          >
            <option value="">{t({ en: 'All universities', el: 'Όλα τα πανεπιστήμια' })}</option>
            {universities.map((university) => (
              <option key={university.id} value={university.id}>
                {university.name}
              </option>
            ))}
          </select>

          <select
            className={fieldClass}
            value={filterSchoolId}
            onChange={(event) => {
              setFilterSchoolId(event.target.value)
              setFilterDepartmentId('')
            }}
            disabled={!filterUniversityId}
          >
            <option value="">{t({ en: 'All schools', el: 'Όλες οι σχολές' })}</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>

          <select
            className={fieldClass}
            value={filterDepartmentId}
            onChange={(event) => setFilterDepartmentId(event.target.value)}
            disabled={!filterSchoolId}
          >
            <option value="">{t({ en: 'All departments', el: 'Όλα τα τμήματα' })}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {t({ en: 'Clear filters', el: 'Καθαρισμός φίλτρων' })}
          </button>
        </div>

        {!supportsFollowSystem ? (
          <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t({
              en: 'Follow system is disabled until social migrations are applied.',
              el: 'Το follow σύστημα είναι απενεργοποιημένο μέχρι να εφαρμοστούν τα social migrations.',
            })}
          </p>
        ) : null}

        {isPreStudent ? (
          <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t({
              en: 'Pre-student accounts can browse students but cannot follow yet.',
              el: 'Οι pre-student λογαριασμοί βλέπουν φοιτητές αλλά δεν μπορούν ακόμα να κάνουν follow.',
            })}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}
      </header>

      {isLoadingPeers ? (
        <section className="social-card p-5 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t({ en: 'Loading students...', el: 'Φόρτωση φοιτητών...' })}
          </p>
        </section>
      ) : visiblePeers.length === 0 ? (
        <section className="social-card p-5 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t({ en: 'No students found for this filter.', el: 'Δεν βρέθηκαν φοιτητές για αυτό το φίλτρο.' })}
          </p>
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePeers.map((peer) => {
            const peerName = peer.display_name ?? t({ en: 'Student', el: 'Φοιτητής' })
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
                            ? universitiesMap.get(peer.university_id) ?? t({ en: 'University', el: 'Πανεπιστήμιο' })
                            : t({ en: 'University', el: 'Πανεπιστήμιο' })}
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
                        ? t({ en: 'Following', el: 'Ακολουθείς' })
                        : t({ en: 'Follow', el: 'Ακολούθησε' })}
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-200">
                      {t({ en: 'Locked', el: 'Κλειδωμένο' })}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                    {peer.study_year
                      ? t({ en: `Year ${peer.study_year}`, el: `Έτος ${peer.study_year}` })
                      : t({ en: 'Campus', el: 'Campus' })}
                  </span>
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                    {t({ en: `${peer.followers_count ?? 0} followers`, el: `${peer.followers_count ?? 0} followers` })}
                  </span>
                  <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5">
                    {peer.is_verified_student === true && peer.is_pre_student !== true
                      ? t({ en: 'Verified', el: 'Επαληθευμένος' })
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
