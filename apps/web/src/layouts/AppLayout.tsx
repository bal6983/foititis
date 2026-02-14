import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import LanguageToggle from '../components/ui/LanguageToggle'
import ThemeToggle from '../components/ui/ThemeToggle'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'
import {
  isVerifiedCampusMember,
  recommendationScore,
  sortByRecommendation,
  type RecommendationContext,
} from '../lib/peerRecommendations'

type ProfileRow = {
  id: string
  display_name: string | null
  full_name: string | null
  avatar_url: string | null
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

type NotificationRow = {
  id: string
  actor_id: string | null
  notification_type: string
  related_listing_id: string | null
  related_post_id: string | null
  content: string | null
  read: boolean
  created_at: string
}

type ActivityPostPreview = {
  id: string
  author_id: string
  post_type: string
  content: string | null
}

type NotificationView = NotificationRow & {
  actorName: string
  actorAvatar: string | null
}

type PostgrestErrorLike = {
  message?: string | null
  details?: string | null
  hint?: string | null
}

type PeerFilters = {
  cityId?: string | null
  universityId?: string | null
  schoolId?: string | null
  departmentId?: string | null
}

const ONLINE_WINDOW_MINUTES = 10

const formatRelativeTime = (value: string) => {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))

  if (diffMinutes < 60) return `${diffMinutes}m`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
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

const applyPeerFilters = (query: any, filters: PeerFilters) => {
  let nextQuery = query
  if (filters.universityId) nextQuery = nextQuery.eq('university_id', filters.universityId)
  if (filters.schoolId) nextQuery = nextQuery.eq('school_id', filters.schoolId)
  if (filters.departmentId) nextQuery = nextQuery.eq('department_id', filters.departmentId)
  if (filters.cityId) nextQuery = nextQuery.eq('city_id', filters.cityId)
  return nextQuery
}

export default function AppLayout() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [universityName, setUniversityName] = useState('')
  const [studyYear, setStudyYear] = useState<number | null>(null)
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [activeNowCount, setActiveNowCount] = useState(0)
  const [activeNowOpen, setActiveNowOpen] = useState(false)
  const [activeFollowingPeers, setActiveFollowingPeers] = useState<PeerProfileRow[]>([])
  const [trendingLines, setTrendingLines] = useState<string[]>([])
  const [followSuggestions, setFollowSuggestions] = useState<PeerProfileRow[]>([])
  const [allRankedPeers, setAllRankedPeers] = useState<PeerProfileRow[]>([])
  const [suggestionFilter, setSuggestionFilter] = useState<'recommended' | 'university' | 'department'>('recommended')
  const [currentCityId, setCurrentCityId] = useState<string | null>(null)
  const [currentDepartmentId, setCurrentDepartmentId] = useState<string | null>(null)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [supportsFollowSystem, setSupportsFollowSystem] = useState(true)
  const [notifications, setNotifications] = useState<NotificationView[]>([])
  const [savedItemsCount, setSavedItemsCount] = useState(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [isBellPopping, setIsBellPopping] = useState(false)
  const [shellError, setShellError] = useState('')
  const [notificationPanelPosition, setNotificationPanelPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const shellRefreshTimeoutRef = useRef<number | null>(null)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  )

  const leftNavItems = useMemo(
    () => [
      { to: '/dashboard', label: t({ en: 'Feed', el: 'Ροη' }) },
      { to: '/universities', label: t({ en: 'Universities', el: 'Πανεπιστήμια' }) },
      { to: '/marketplace', label: t({ en: 'Marketplace', el: 'Αγορα' }) },
      {
        to: '/chats',
        label: t({ en: 'Messages', el: 'Μηνυματα' }),
        count: unreadMessagesCount,
      },
      { to: '/events', label: t({ en: 'Events', el: 'Εκδηλωσεις' }) },
      { to: '/notes', label: t({ en: 'Notes', el: 'Σημειωσεις' }) },
      {
        to: '/saved',
        label: t({ en: 'Saved', el: 'Αποθηκευμενα' }),
        count: savedItemsCount,
      },
      { to: '/profile', label: t({ en: 'Profile', el: 'Προφιλ' }) },
    ],
    [savedItemsCount, t, unreadMessagesCount],
  )

  const statusText = isVerifiedStudent
    ? t({ en: 'Verified student', el: 'Επαληθευμενος φοιτητης' })
    : isPreStudent
      ? t({ en: 'Pre-student', el: 'Προ-φοιτητης' })
      : t({ en: 'Student', el: 'Φοιτητης' })

  const filteredSuggestions = useMemo(() => {
    if (suggestionFilter === 'recommended') return followSuggestions
    const pool = allRankedPeers.filter((peer) => {
      if (suggestionFilter === 'department' && currentDepartmentId) {
        return peer.department_id === currentDepartmentId
      }
      if (suggestionFilter === 'university' && currentCityId) {
        return peer.city_id === currentCityId
      }
      return true
    })
    return pool.slice(0, 5)
  }, [allRankedPeers, currentCityId, currentDepartmentId, followSuggestions, suggestionFilter])

  const getNotificationMessage = useCallback(
    (notification: NotificationView) => {
      const actor = notification.actorName || t({ en: 'Someone', el: 'Κάποιος' })
      switch (notification.notification_type) {
        case 'followed':
          return t({
            en: `${actor} followed you`,
            el: `Ο/Η ${actor} σε ακολούθησε`,
          })
        case 'reaction':
          return t({
            en: `${actor} liked your activity`,
            el: `Ο/Η ${actor} εκανε like στη δραστηριοτητα σου`,
          })
        case 'comment':
          return t({
            en: `${actor} commented on your activity`,
            el: `Ο/Η ${actor} σχολιασε τη δραστηριοτητα σου`,
          })
        case 'listing_viewed':
          return (
            notification.content ??
            t({
              en: 'Your listing got new views',
              el: 'Η αγγελια σου ειχε νεες προβολες',
            })
          )
        case 'message':
          return t({ en: `${actor} sent you a message`, el: `Ο/Η ${actor} σου εστειλε μηνυμα` })
        case 'new_listing':
          return t({ en: 'New listing in your area', el: 'Νεα αγγελια στην περιοχη σου' })
        default:
          return (
            notification.content ??
            t({ en: 'New activity on campus', el: 'Νεα δραστηριοτητα στο campus' })
          )
      }
    },
    [t],
  )

  const getNotificationHref = (notification: NotificationView) => {
    if (notification.notification_type === 'followed' && notification.actor_id) {
      return `/profile/${notification.actor_id}`
    }
    if (notification.related_listing_id) {
      return `/marketplace/${notification.related_listing_id}`
    }
    if (notification.notification_type === 'message') {
      return '/chats'
    }
    if (notification.related_post_id) {
      return '/dashboard'
    }
    return '/dashboard'
  }

  const markAllNotificationsRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids)

    if (!error) {
      setNotifications((previous) =>
        previous.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item)),
      )
    }
  }, [])

  const loadShell = useCallback(async (options?: { silent?: boolean }) => {
    const isSilentRefresh = options?.silent === true
    if (!isSilentRefresh) {
      setIsLoading(true)
      setShellError('')
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      const details = userError?.message ? ` (${userError.message})` : ''
      if (!isSilentRefresh) {
        setShellError(
          t({ en: `Unable to load workspace${details}.`, el: `Unable to load workspace${details}.` }),
        )
        setIsLoading(false)
      }
      return
    }

    const userId = userData.user.id
    const email = userData.user.email ?? ''
    setCurrentUserId(userId)

    let profileResponse = await supabase
      .from('profiles')
      .select(
        'id, display_name, full_name, avatar_url, city_id, university_id, school_id, department_id, study_year, is_verified_student, is_pre_student',
      )
      .eq('id', userId)
      .maybeSingle()

    if (profileResponse.error && hasMissingSchemaError(profileResponse.error)) {
      profileResponse = (await supabase
        .from('profiles')
        .select(
          'id, display_name, avatar_url, city_id, university_id, school_id, study_year, is_verified_student, is_pre_student',
        )
        .eq('id', userId)
        .maybeSingle()) as typeof profileResponse
    }

    if (profileResponse.error || !profileResponse.data) {
      const details = profileResponse.error?.message ? ` (${profileResponse.error.message})` : ''
      if (!isSilentRefresh) {
        setShellError(
          t({ en: `Unable to load profile${details}.`, el: `Unable to load profile${details}.` }),
        )
        setIsLoading(false)
      }
      return
    }

    const typedProfile = {
      ...(profileResponse.data as Partial<ProfileRow>),
      full_name: (profileResponse.data as Partial<ProfileRow>).full_name ?? null,
      department_id: (profileResponse.data as Partial<ProfileRow>).department_id ?? null,
    } as ProfileRow
    const resolvedVerified = typedProfile.is_verified_student === true
    const resolvedPreStudent = typedProfile.is_pre_student === true && !resolvedVerified

    setDisplayName(typedProfile.display_name || typedProfile.full_name || email)
    setAvatarUrl(typedProfile.avatar_url ?? null)
    setStudyYear(typedProfile.study_year ?? null)
    setIsVerifiedStudent(resolvedVerified)
    setIsPreStudent(resolvedPreStudent)
    setCurrentCityId(typedProfile.city_id ?? null)
    setCurrentDepartmentId(typedProfile.department_id ?? null)

    if (typedProfile.university_id) {
      const { data: universityData } = await supabase
        .from('universities')
        .select('name')
        .eq('id', typedProfile.university_id)
        .maybeSingle()

      setUniversityName(
        universityData?.name ?? t({ en: 'Your University', el: 'Το πανεπιστημιο σου' }),
      )
    } else {
      setUniversityName(t({ en: 'Your Campus', el: 'Το campus σου' }))
    }

    const notificationsResponse = await supabase
      .from('notifications')
      .select(
        'id, actor_id, notification_type, related_listing_id, related_post_id, content, read, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(12)

    const notificationsData = hasMissingSchemaError(notificationsResponse.error, 'notifications')
      ? []
      : notificationsResponse.data ?? []

    const [savedItemsCountResponse, unreadMessagesCountResponse] = await Promise.all([
      supabase
        .from('saved_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('notification_type', 'message')
        .eq('read', false),
    ])

    if (hasMissingSchemaError(savedItemsCountResponse.error, 'saved_items')) {
      setSavedItemsCount(0)
    } else {
      setSavedItemsCount(savedItemsCountResponse.count ?? 0)
    }

    if (hasMissingSchemaError(unreadMessagesCountResponse.error, 'notifications')) {
      setUnreadMessagesCount(0)
    } else {
      setUnreadMessagesCount(unreadMessagesCountResponse.count ?? 0)
    }

    const loadPeerRows = async (limit: number, filters: PeerFilters) => {
      let withSocialQuery = supabase
        .from('public_profiles')
        .select(
          'id, display_name, avatar_url, city_id, university_id, school_id, department_id, study_year, is_verified_student, is_pre_student, followers_count, last_seen_at',
        )
        .neq('id', userId)
        .limit(limit)

      withSocialQuery = applyPeerFilters(withSocialQuery, filters)
      const peersWithSocial = await withSocialQuery

      if (peersWithSocial.error && hasMissingSchemaError(peersWithSocial.error)) {
        let legacyQuery = supabase
          .from('public_profiles')
          .select(
            'id, display_name, avatar_url, university_id, study_year, is_verified_student, is_pre_student',
          )
          .neq('id', userId)
          .limit(limit)

        legacyQuery = applyPeerFilters(legacyQuery, filters)
        const peersLegacy = await legacyQuery

        return ((peersLegacy.data ?? []) as PeerProfileRow[]).map((peer) => ({
          ...peer,
          city_id: null,
          school_id: null,
          department_id: null,
          followers_count: 0,
          last_seen_at: null,
        }))
      }

      return (peersWithSocial.data ?? []) as PeerProfileRow[]
    }

    const suggestionFilters: PeerFilters = {
      cityId: null,
      universityId: null,
      schoolId: null,
      departmentId: null,
    }

    let peerRows = await loadPeerRows(80, suggestionFilters)
    if (peerRows.length < 8) {
      const globalPeers = await loadPeerRows(120, {})
      const merged = new Map<string, PeerProfileRow>()
      for (const peer of [...peerRows, ...globalPeers]) {
        if (peer.id === userId) continue
        if (!merged.has(peer.id)) merged.set(peer.id, peer)
      }
      peerRows = Array.from(merged.values())
    }

    const now = Date.now()
    const onlineThreshold = ONLINE_WINDOW_MINUTES * 60 * 1000
    const onlinePeers = peerRows.filter((peer) => {
      if (!peer.last_seen_at) return false
      const seenAt = new Date(peer.last_seen_at).getTime()
      return !Number.isNaN(seenAt) && now - seenAt <= onlineThreshold
    })

    const followsResponse = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', userId)

    let nextFollowingIds = new Set<string>()
    if (hasMissingSchemaError(followsResponse.error, 'follows')) {
      setSupportsFollowSystem(false)
      setFollowingIds(new Set())
    } else {
      setSupportsFollowSystem(true)
      nextFollowingIds = new Set((followsResponse.data ?? []).map((item) => item.followed_id))
      setFollowingIds(nextFollowingIds)
    }

    const nextActiveFollowingPeers = onlinePeers.filter((peer) => nextFollowingIds.has(peer.id))
    setActiveFollowingPeers(nextActiveFollowingPeers)
    setActiveNowCount(nextActiveFollowingPeers.length)

    const recommendationContext: RecommendationContext = {
      cityId: typedProfile.city_id ?? null,
      universityId: typedProfile.university_id ?? null,
      schoolId: typedProfile.school_id ?? null,
      departmentId: typedProfile.department_id ?? null,
      studyYear: typedProfile.study_year ?? null,
    }

    const rankedPeers = sortByRecommendation(peerRows, recommendationContext)
    const recommendationOnly = rankedPeers.filter(
      (peer) => recommendationScore(peer, recommendationContext) > 0,
    )
    const candidatePeers = recommendationOnly.length > 0
      ? recommendationOnly
      : rankedPeers

    const verifiedCandidates = candidatePeers.filter(isVerifiedCampusMember)
    const suggestions = verifiedCandidates.slice(0, 5)

    setAllRankedPeers(verifiedCandidates)
    setFollowSuggestions(suggestions)

    const peerMap = new Map(peerRows.map((peer) => [peer.id, peer]))
    const peerIds = peerRows.map((peer) => peer.id).slice(0, 50)
    let nextTrendingLines: string[] = []

    if (peerIds.length > 0) {
      const { data: activityPosts, error: activityPostsError } = await supabase
        .from('activity_posts')
        .select('id, author_id, post_type, content')
        .in('author_id', peerIds)
        .order('created_at', { ascending: false })
        .limit(8)

      if (!hasMissingSchemaError(activityPostsError, 'activity_posts')) {
        nextTrendingLines = ((activityPosts ?? []) as ActivityPostPreview[])
          .map((post) => {
            const authorName =
              peerMap.get(post.author_id)?.display_name ||
              t({ en: 'A student', el: 'Ενας φοιτητης' })
            const suffix = post.content ? `: ${post.content}` : ''
            const postLabel =
              post.post_type === 'listing_created'
                ? t({ en: 'listed something new', el: 'ανεβασε νεα αγγελια' })
                : post.post_type === 'wanted_created'
                  ? t({ en: 'requested an item', el: 'ανεβασε ζητηση' })
                  : post.post_type === 'badge_earned'
                    ? t({ en: 'earned a new badge', el: 'κερδισε νεο badge' })
                    : t({ en: 'shared an update', el: 'μοιραστηκε νεο update' })
            return `${authorName} ${postLabel}${suffix}`
          })
          .slice(0, 3)
      }
    }

    if (nextTrendingLines.length === 0) {
      nextTrendingLines = [
        t({
          en: 'New listings and requests this week',
          el: 'Νεες αγγελιες και ζητησεις αυτη την εβδομαδα',
        }),
        t({
          en: 'Students are active in chats right now',
          el: 'Οι φοιτητες ειναι ενεργοι στα μηνυματα τωρα',
        }),
        t({ en: 'Campus activity is picking up', el: 'Η κινηση στο campus ανεβαινει' }),
      ]
    }
    setTrendingLines(nextTrendingLines)

    const typedNotifications = (notificationsData ?? []) as NotificationRow[]
    const actorIds = Array.from(
      new Set(
        typedNotifications
          .map((notification) => notification.actor_id)
          .filter((value): value is string => Boolean(value)),
      ),
    )

    let actorMap = new Map<string, { display_name: string | null; avatar_url: string | null }>()
    if (actorIds.length > 0) {
      const { data: actorProfiles } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', actorIds)

      actorMap = new Map(
        (actorProfiles ?? []).map((actor) => [
          actor.id,
          {
            display_name: actor.display_name ?? null,
            avatar_url: actor.avatar_url ?? null,
          },
        ]),
      )
    }

    const nextNotifications: NotificationView[] = typedNotifications.map((notification) => ({
      ...notification,
      actorName:
        (notification.actor_id
          ? actorMap.get(notification.actor_id)?.display_name
          : null) ?? t({ en: 'Campus', el: 'Campus' }),
      actorAvatar: notification.actor_id
        ? (actorMap.get(notification.actor_id)?.avatar_url ?? null)
        : null,
    }))

    setNotifications(nextNotifications)
    if (!isSilentRefresh) {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadShell()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadShell])

  const scheduleShellRefresh = useCallback(() => {
    if (shellRefreshTimeoutRef.current !== null) return
    shellRefreshTimeoutRef.current = window.setTimeout(() => {
      shellRefreshTimeoutRef.current = null
      void loadShell({ silent: true })
    }, 250)
  }, [loadShell])

  useEffect(
    () => () => {
      if (shellRefreshTimeoutRef.current !== null) {
        window.clearTimeout(shellRefreshTimeoutRef.current)
        shellRefreshTimeoutRef.current = null
      }
    },
    [],
  )

  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel(`notifications:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUserId}`,
        },
        scheduleShellRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        scheduleShellRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${currentUserId}`,
        },
        scheduleShellRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_items',
          filter: `user_id=eq.${currentUserId}`,
        },
        scheduleShellRefresh,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, scheduleShellRefresh])

  useEffect(() => {
    if (!currentUserId) return

    const intervalId = window.setInterval(scheduleShellRefresh, 8000)
    const handleFocus = () => scheduleShellRefresh()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleShellRefresh()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [currentUserId, scheduleShellRefresh])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleToggleNotifications = async (currentTarget?: HTMLElement) => {
    const nextValue = !notificationsOpen
    setNotificationsOpen(nextValue)
    setIsBellPopping(true)
    window.setTimeout(() => setIsBellPopping(false), 200)

    if (nextValue) {
      const panelWidth = Math.min(360, window.innerWidth * 0.88)
      const fallbackLeft = Math.max(12, window.innerWidth - panelWidth - 14)
      const anchorRect = currentTarget?.getBoundingClientRect()
      const left = anchorRect
        ? Math.min(
            Math.max(12, anchorRect.right - panelWidth),
            Math.max(12, window.innerWidth - panelWidth - 12),
          )
        : fallbackLeft
      const top = anchorRect ? Math.max(12, anchorRect.bottom + 10) : 70
      setNotificationPanelPosition({ left, top })

      const unreadIds = notifications
        .filter((notification) => !notification.read)
        .map((notification) => notification.id)
      await markAllNotificationsRead(unreadIds)
      return
    }

    setNotificationPanelPosition(null)
  }

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

    const isFollowing = followingIds.has(targetId)
    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('followed_id', targetId)

      if (!error) {
        setFollowingIds((previous) => {
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
      setFollowingIds((previous) => new Set(previous).add(targetId))
    }
  }

  const notificationDropdown = (
    <div
      className="notification-dropdown fixed z-[140] w-[360px] max-w-[88vw] rounded-2xl border border-[var(--border-primary)] bg-[color:var(--surface-elevated)]/98 p-3 shadow-[0_26px_52px_rgba(5,10,24,0.45)] ring-1 ring-white/10"
      style={{
        left: notificationPanelPosition?.left ?? Math.max(12, window.innerWidth - 360 - 14),
        top: notificationPanelPosition?.top ?? 70,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {t({ en: 'Notifications', el: 'Ειδοποιησεις' })}
        </p>
        <button
          type="button"
          className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={() => setNotificationsOpen(false)}
        >
          {t({ en: 'Close', el: 'Κλεισιμο' })}
        </button>
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-4 text-center text-xs text-[var(--text-secondary)]">
          {t({ en: 'No notifications yet', el: 'Δεν υπαρχουν ειδοποιησεις ακομα' })}
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link
                to={getNotificationHref(notification)}
                className={`block rounded-xl px-2 py-2 transition ${
                  notification.read ? 'bg-transparent' : 'bg-blue-500/10'
                } hover:bg-[var(--surface-soft)]`}
                onClick={() => setNotificationsOpen(false)}
              >
                <div className="flex items-start gap-2">
                  <Avatar
                    name={notification.actorName}
                    url={notification.actorAvatar}
                    size="sm"
                    showRing={!notification.read}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)]">
                      {getNotificationMessage(notification)}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {formatRelativeTime(notification.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="min-h-screen p-5 text-[var(--text-primary)]">
        <section className="social-card p-5">
          <h1 className="text-lg font-semibold">
            {t({ en: 'Loading social campus...', el: 'Φορτωση social campus...' })}
          </h1>
        </section>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <span className="ambient-orb left-[-10%] top-[10%] h-52 w-52 bg-cyan-400/40" />
        <span className="ambient-orb right-[-6%] top-[26%] h-72 w-72 bg-blue-500/35 [animation-delay:1.5s]" />
        <span className="ambient-orb bottom-[-8%] left-[32%] h-64 w-64 bg-pink-400/35 [animation-delay:0.8s]" />
      </div>

      <div className="mx-auto w-full max-w-[1720px] px-3 py-3 md:px-5 md:py-5">
        <header className="mb-4 flex items-center justify-between gap-3 md:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {universityName}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{statusText}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={(event) => {
                  void handleToggleNotifications(event.currentTarget)
                }}
                className={`relative rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] ${
                  isBellPopping ? 'scale-95' : ''
                }`}
              >
                {t({ en: 'Alerts', el: 'Ειδοποιησεις' })}
                {unreadCount > 0 ? (
                  <span className="notification-bubble animate-[pulse-soft_2s_ease-in-out_infinite]">
                    {Math.min(unreadCount, 9)}
                  </span>
                ) : null}
              </button>
            </div>
            <LanguageToggle showLabel={false} />
            <ThemeToggle />
          </div>
        </header>

        {shellError ? (
          <p className="mb-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {shellError}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[250px_minmax(0,1fr)_310px]">
          <aside className="hidden md:block">
            <div className="sticky top-4 space-y-4">
              <section className="social-card p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{universityName}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{statusText}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LanguageToggle showLabel={false} />
                    <ThemeToggle />
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-3 rounded-2xl bg-[var(--surface-soft)] p-3">
                  <Avatar name={displayName} url={avatarUrl} size="md" showRing />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {displayName}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {studyYear
                        ? t({
                            en: `Year ${studyYear}`,
                            el: `Ετος ${studyYear}`,
                          })
                        : t({ en: 'Campus member', el: 'Μέλος campus' })}
                    </p>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      {t({ en: 'Active now', el: 'Ενεργοί τώρα' })}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
                      {activeNowCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      {t({ en: 'Alerts', el: 'Ειδοποιησεις' })}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
                      {unreadCount}
                    </p>
                  </div>
                </div>

                <nav className="space-y-1.5">
                  {leftNavItems.map((item) => (
                    <NavLink
                      key={`${item.to}-${item.label}`}
                      to={item.to}
                      className={({ isActive }) =>
                        `nav-pill text-sm font-medium transition ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-500/90 via-sky-400/85 to-cyan-300/85 text-slate-950 shadow-[0_10px_24px_rgba(56,189,248,0.35)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]'
                        }`
                      }
                    >
                      <span className="nav-pill-dot" />
                      <span className="truncate">{item.label}</span>
                      {item.to === '/saved' && item.count && item.count > 0 ? (
                        <span className="ml-auto text-xs font-semibold text-[var(--text-secondary)]">
                          ({Math.min(item.count, 999)})
                        </span>
                      ) : null}
                      {item.to === '/chats' && item.count && item.count > 0 ? (
                        <span className="nav-badge">{Math.min(item.count, 99)}</span>
                      ) : null}
                    </NavLink>
                  ))}
                </nav>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-4 w-full rounded-xl border border-[var(--border-primary)] px-3 py-2 text-left text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {t({ en: 'Sign out', el: 'Αποσυνδεση' })}
                </button>
              </section>
            </div>
          </aside>

          <main className="min-w-0">
            <Outlet />
          </main>

          <aside className="hidden md:block">
            <div className="sticky top-4 space-y-4">
              <section className="social-card p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {t({
                      en: 'Trending in your university',
                      el: 'Τι παιζει στο πανεπιστημιο σου',
                    })}
                  </h3>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(event) => {
                        void handleToggleNotifications(event.currentTarget)
                      }}
                      className={`relative rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] ${
                        isBellPopping ? 'scale-95' : ''
                      }`}
                    >
                      {t({ en: 'Alerts', el: 'Ειδοποιησεις' })}
                      {unreadCount > 0 ? (
                        <span className="notification-bubble animate-[pulse-soft_2s_ease-in-out_infinite]">
                          {Math.min(unreadCount, 9)}
                        </span>
                      ) : null}
                    </button>
                  </div>
                </div>
                <ul className="space-y-2">
                  {trendingLines.map((line, index) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]"
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="social-card p-4">
                <button
                  type="button"
                  onClick={() => setActiveNowOpen((previous) => !previous)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {t({ en: 'Active now', el: 'Ενεργοί τώρα' })}
                    </h3>
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                      {activeNowOpen
                        ? t({ en: 'Hide', el: 'Απόκρυψη' })
                        : t({ en: 'View', el: 'Προβολή' })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-[pulse-soft_1.8s_ease-in-out_infinite]" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {activeNowCount}{' '}
                      <span className="font-normal text-[var(--text-secondary)]">
                        {t({ en: 'students online', el: 'φοιτητές online' })}
                      </span>
                    </p>
                  </div>
                </button>

                {activeNowOpen ? (
                  <div className="mt-3">
                    {activeFollowingPeers.length === 0 ? (
                      <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {t({
                          en: 'No followed students are online right now.',
                          el: 'Κανένας από όσους ακολουθείς δεν είναι online τώρα.',
                        })}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {activeFollowingPeers.map((peer) => {
                          const peerName = peer.display_name ?? t({ en: 'Student', el: 'Φοιτητής' })
                          return (
                            <li key={peer.id}>
                              <Link
                                to={`/profile/${peer.id}`}
                                className="flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-2.5 py-2"
                              >
                                <Avatar
                                  name={peerName}
                                  url={peer.avatar_url}
                                  size="sm"
                                  online={true}
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                    {peerName}
                                  </p>
                                  <p className="text-[11px] text-[var(--text-secondary)]">
                                    {peer.study_year
                                      ? t({
                                          en: `Year ${peer.study_year}`,
                                          el: `Έτος ${peer.study_year}`,
                                        })
                                      : t({ en: 'Campus', el: 'Campus' })}
                                  </p>
                                </div>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                      {t({
                        en: 'Only students you follow are shown here.',
                        el: 'Εδώ εμφανίζονται μόνο φοιτητές που ακολουθείς.',
                      })}
                    </p>
                  </div>
                ) : null}
              </section>

              <section className="social-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {t({
                      en: 'Suggested follows',
                      el: 'Προτεινομενοι φοιτητες',
                    })}
                  </h3>
                  <Link
                    to="/students"
                    className="text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {t({ en: 'View all', el: 'Δες ολους' })}
                  </Link>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {([
                    { key: 'recommended' as const, label: t({ en: 'For you', el: 'Για σένα' }) },
                    { key: 'university' as const, label: t({ en: 'Same city', el: 'Ίδια πόλη' }) },
                    { key: 'department' as const, label: t({ en: 'Same dept', el: 'Ίδιο τμήμα' }) },
                  ]).map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setSuggestionFilter(chip.key)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
                        suggestionFilter === chip.key
                          ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                          : 'border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {filteredSuggestions.length === 0 ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {t({
                        en: 'No suggestions for this filter.',
                        el: 'Δεν υπάρχουν προτάσεις για αυτό το φίλτρο.',
                      })}
                    </p>
                    <Link
                      to="/students"
                      className="inline-flex rounded-full border border-[var(--border-primary)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {t({ en: 'Open students page', el: 'Ανοιξε σελιδα φοιτητων' })}
                    </Link>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {filteredSuggestions.map((suggestion) => {
                      const suggestionName =
                        suggestion.display_name ??
                        t({ en: 'Student', el: 'Φοιτητης' })
                      const isFollowing = followingIds.has(suggestion.id)
                      return (
                        <li
                          key={suggestion.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-soft)] px-2 py-2"
                        >
                          <Link to={`/profile/${suggestion.id}`} className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Avatar
                                name={suggestionName}
                                url={suggestion.avatar_url}
                                size="sm"
                                online={suggestion.last_seen_at !== null}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                  {suggestionName}
                                </p>
                                <p className="text-[11px] text-[var(--text-secondary)]">
                                  {suggestion.study_year
                                    ? t({
                                        en: `Year ${suggestion.study_year}`,
                                        el: `Ετος ${suggestion.study_year}`,
                                      })
                                    : t({ en: 'Campus', el: 'Campus' })}
                                </p>
                              </div>
                            </div>
                          </Link>

                          {isVerifiedStudent &&
                          !isPreStudent &&
                          supportsFollowSystem &&
                          suggestion.is_verified_student === true &&
                          suggestion.is_pre_student !== true ? (
                            <button
                              type="button"
                              onClick={() => handleToggleFollow(suggestion.id)}
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
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section className="social-card p-4">
                <h3 className="text-sm font-semibold">
                  {t({ en: 'Notifications preview', el: 'Προεπισκοπηση ειδοποιησεων' })}
                </h3>
                {notifications.length === 0 ? (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    {t({ en: 'No alerts yet.', el: 'Δεν υπαρχουν ειδοποιησεις ακομα.' })}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {notifications.slice(0, 4).map((notification) => (
                      <li
                        key={notification.id}
                        className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"
                      >
                        <p className="text-xs text-[var(--text-primary)]">
                          {getNotificationMessage(notification)}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </aside>
        </div>
      </div>

      {notificationsOpen ? (
        <>
          <button
            type="button"
            className="notification-backdrop fixed inset-0 z-[130]"
            onClick={() => {
              setNotificationsOpen(false)
              setNotificationPanelPosition(null)
            }}
            aria-label={t({ en: 'Close notifications', el: 'Close notifications' })}
          />
          {notificationDropdown}
        </>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-primary)] bg-[color:var(--bg-secondary)]/90 backdrop-blur md:hidden">
        <nav className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `text-xs font-semibold ${isActive ? 'text-cyan-200' : 'text-[var(--text-secondary)]'}`
            }
          >
            {t({ en: 'Feed', el: 'Ροη' })}
          </NavLink>
          <NavLink
            to="/universities"
            className={({ isActive }) =>
              `text-xs font-semibold ${isActive ? 'text-cyan-200' : 'text-[var(--text-secondary)]'}`
            }
          >
            {t({ en: 'Universities', el: 'Πανεπιστήμια' })}
          </NavLink>
          <NavLink
            to="/marketplace"
            className={({ isActive }) =>
              `text-xs font-semibold ${isActive ? 'text-cyan-200' : 'text-[var(--text-secondary)]'}`
            }
          >
            {t({ en: 'Market', el: 'Αγορα' })}
          </NavLink>
          <NavLink
            to="/chats"
            className={({ isActive }) =>
              `relative text-xs font-semibold ${isActive ? 'text-cyan-200' : 'text-[var(--text-secondary)]'}`
            }
          >
            {t({ en: 'Messages', el: 'Μηνυματα' })}
            {unreadMessagesCount > 0 ? (
              <span className="notification-bubble animate-[pulse-soft_2s_ease-in-out_infinite]">
                {Math.min(unreadMessagesCount, 9)}
              </span>
            ) : null}
          </NavLink>
          <button
            type="button"
            onClick={(event) => {
              void handleToggleNotifications(event.currentTarget)
            }}
            className="relative text-xs font-semibold text-[var(--text-secondary)]"
          >
            {t({ en: 'Alerts', el: 'Ειδοποιησεις' })}
            {unreadCount > 0 ? (
              <span className="notification-bubble animate-[pulse-soft_2s_ease-in-out_infinite]">
                {Math.min(unreadCount, 9)}
              </span>
            ) : null}
          </button>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `text-xs font-semibold ${isActive ? 'text-cyan-200' : 'text-[var(--text-secondary)]'}`
            }
          >
            {t({ en: 'Profile', el: 'Προφιλ' })}
          </NavLink>
        </nav>
      </div>
    </div>
  )
}

