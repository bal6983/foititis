import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type CurrentProfileRow = {
  id: string
  display_name: string | null
  full_name: string | null
  avatar_url: string | null
  university_id: string | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
}

type ActivityPostRow = {
  id: string
  author_id: string
  content: string | null
  post_type: string
  related_listing_id: string | null
  related_wanted_listing_id: string | null
  reactions_count: number
  comments_count: number
  created_at: string
}

type PublicProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  university_id: string | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
}

type UniversityRow = {
  id: string
  name: string
}

type ListingRow = {
  id: string
  title: string
}

type WantedRow = {
  id: string
  title: string
}

type FeedCommentRow = {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
}

type FeedCommentView = FeedCommentRow & {
  authorName: string
  authorAvatar: string | null
}

type FeedPostView = {
  id: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  authorUniversityId: string | null
  authorUniversityName: string
  authorIsVerified: boolean
  createdAt: string
  actionText: string
  detailText: string
  actionLabel: string
  actionHref: string
  reactionsCount: number
  commentsCount: number
  hasReacted: boolean
  canFollowAuthor: boolean
  isAuthorFollowed: boolean
}

type FeedFilter = 'all' | 'following' | 'university'

type PostgrestErrorLike = {
  message?: string | null
  details?: string | null
  hint?: string | null
}

const compactTimeAgo = (value: string) => {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const diffMs = Date.now() - then
  const minutes = Math.max(1, Math.floor(diffMs / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const getDayStartIso = () => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
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

export default function Dashboard() {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const [currentUniversityId, setCurrentUniversityId] = useState<string | null>(null)
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [filter, setFilter] = useState<FeedFilter>('all')
  const [insightLine, setInsightLine] = useState('')
  const [posts, setPosts] = useState<FeedPostView[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [supportsFeedInteractions, setSupportsFeedInteractions] = useState(true)
  const [supportsFollowSystem, setSupportsFollowSystem] = useState(true)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, FeedCommentView[]>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})

  const loadFeed = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      const details = authError?.message ? ` (${authError.message})` : ''
      setErrorMessage(
        t({ en: `Unable to load feed${details}.`, el: `Unable to load feed${details}.` }),
      )
      setIsLoading(false)
      return
    }

    const userId = authData.user.id
    const userEmail = authData.user.email ?? ''
    setCurrentUserId(userId)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, display_name, full_name, avatar_url, university_id, is_verified_student, is_pre_student',
      )
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profileData) {
      const details = profileError?.message ? ` (${profileError.message})` : ''
      setErrorMessage(
        t({ en: `Unable to load profile${details}.`, el: `Unable to load profile${details}.` }),
      )
      setIsLoading(false)
      return
    }

    const currentProfile = profileData as CurrentProfileRow
    const verified = currentProfile.is_verified_student === true
    const preStudent = currentProfile.is_pre_student === true && !verified
    setIsVerifiedStudent(verified)
    setIsPreStudent(preStudent)
    setCurrentUniversityId(currentProfile.university_id)
    setCurrentUserName(currentProfile.display_name || currentProfile.full_name || userEmail)
    setCurrentUserAvatar(currentProfile.avatar_url ?? null)

    const { data: postData, error: postsError } = await supabase
      .from('activity_posts')
      .select(
        'id, author_id, content, post_type, related_listing_id, related_wanted_listing_id, reactions_count, comments_count, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(40)

    let postRows: ActivityPostRow[] = []
    let feedInteractionsAvailable = true

    if (postsError && !hasMissingSchemaError(postsError, 'activity_posts')) {
      const details = postsError.message ? ` (${postsError.message})` : ''
      setErrorMessage(
        t({ en: `Unable to load activity${details}.`, el: `Unable to load activity${details}.` }),
      )
      setIsLoading(false)
      return
    }

    if (postsError && hasMissingSchemaError(postsError, 'activity_posts')) {
      feedInteractionsAvailable = false

      const [{ data: listingsData }, { data: wantedData }] = await Promise.all([
        supabase
          .from('listings')
          .select('id, seller_id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(24),
        supabase
          .from('wanted_listings')
          .select('id, user_id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(24),
      ])

      const listingRows = (listingsData ?? []) as Array<{
        id: string
        seller_id: string
        title: string | null
        created_at: string
      }>
      const wantedRows = (wantedData ?? []) as Array<{
        id: string
        user_id: string
        title: string | null
        created_at: string
      }>

      postRows = [
        ...listingRows.map((listing) => ({
          id: `fallback-listing-${listing.id}`,
          author_id: listing.seller_id,
          content: listing.title,
          post_type: 'listing_created',
          related_listing_id: listing.id,
          related_wanted_listing_id: null,
          reactions_count: 0,
          comments_count: 0,
          created_at: listing.created_at,
        })),
        ...wantedRows.map((wanted) => ({
          id: `fallback-wanted-${wanted.id}`,
          author_id: wanted.user_id,
          content: wanted.title,
          post_type: 'wanted_created',
          related_listing_id: null,
          related_wanted_listing_id: wanted.id,
          reactions_count: 0,
          comments_count: 0,
          created_at: wanted.created_at,
        })),
      ]
        .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
        .slice(0, 40)
    } else {
      postRows = (postData ?? []) as ActivityPostRow[]
    }
    if (postRows.length === 0) {
      setPosts([])
      setCommentsByPost({})
      setSupportsFeedInteractions(feedInteractionsAvailable)
      setInsightLine(
        t({ en: 'Your campus feed is warming up.', el: 'Η ροη του campus ξεκιναει να γεμιζει.' }),
      )
      setIsLoading(false)
      return
    }

    const authorIds = Array.from(new Set(postRows.map((post) => post.author_id)))
    const listingIds = Array.from(
      new Set(postRows.map((post) => post.related_listing_id).filter((id): id is string => Boolean(id))),
    )
    const wantedIds = Array.from(
      new Set(
        postRows
          .map((post) => post.related_wanted_listing_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
    const postIds = postRows.map((post) => post.id)

    const [
      authorProfilesResponse,
      listingsResponse,
      wantedResponse,
      reactionsResponse,
      commentsResponse,
      followsResponse,
    ] = await Promise.all([
      supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url, university_id, is_verified_student, is_pre_student')
        .in('id', authorIds),
      listingIds.length > 0
        ? supabase.from('listings').select('id, title').in('id', listingIds)
        : Promise.resolve({ data: [] as ListingRow[], error: null }),
      wantedIds.length > 0
        ? supabase.from('wanted_listings').select('id, title').in('id', wantedIds)
        : Promise.resolve({ data: [] as WantedRow[], error: null }),
      feedInteractionsAvailable && postIds.length > 0
        ? supabase
            .from('feed_reactions')
            .select('post_id')
            .eq('user_id', userId)
            .eq('reaction_type', 'like')
            .in('post_id', postIds)
        : Promise.resolve({ data: [] as Array<{ post_id: string }>, error: null }),
      feedInteractionsAvailable && postIds.length > 0
        ? supabase
            .from('feed_comments')
            .select('id, post_id, author_id, content, created_at')
            .in('post_id', postIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [] as FeedCommentRow[], error: null }),
      supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', userId)
        .in('followed_id', authorIds),
    ])

    const authorProfiles = (authorProfilesResponse.data ?? []) as PublicProfileRow[]
    const authorMap = new Map(authorProfiles.map((profile) => [profile.id, profile]))

    const universityIds = Array.from(
      new Set(
        authorProfiles
          .map((profile) => profile.university_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )

    let universityMap = new Map<string, string>()
    if (universityIds.length > 0) {
      const { data: universityData } = await supabase
        .from('universities')
        .select('id, name')
        .in('id', universityIds)

      universityMap = new Map(((universityData ?? []) as UniversityRow[]).map((row) => [row.id, row.name]))
    }

    const listingMap = new Map(((listingsResponse.data ?? []) as ListingRow[]).map((row) => [row.id, row.title]))
    const wantedMap = new Map(((wantedResponse.data ?? []) as WantedRow[]).map((row) => [row.id, row.title]))
    const reactedSet = new Set((reactionsResponse.data ?? []).map((row) => row.post_id))
    const followingSet = new Set((followsResponse.data ?? []).map((row) => row.followed_id))
    setFollowingIds(followingSet)

    const interactionsMissingTables =
      hasMissingSchemaError(reactionsResponse.error, 'feed_reactions') ||
      hasMissingSchemaError(commentsResponse.error, 'feed_comments')
    setSupportsFeedInteractions(feedInteractionsAvailable && !interactionsMissingTables)
    const followsMissingTable = hasMissingSchemaError(followsResponse.error, 'follows')
    setSupportsFollowSystem(!followsMissingTable)

    const todayStartIso = getDayStartIso()
    const newListingsTodayInUniversity = postRows.filter((post) => {
      if (post.post_type !== 'listing_created') return false
      if (post.created_at < todayStartIso) return false
      const authorUniversityId = authorMap.get(post.author_id)?.university_id
      return authorUniversityId !== null && authorUniversityId === currentProfile.university_id
    }).length

    if (newListingsTodayInUniversity > 0) {
      setInsightLine(
        t({
          en: `${newListingsTodayInUniversity} new listings were posted near you today.`,
          el: `${newListingsTodayInUniversity} νεες αγγελιες ανεβηκαν κοντα σου σημερα.`,
        }),
      )
    } else {
      setInsightLine(
        t({
          en: 'Students from your university are posting and connecting right now.',
          el: 'Οι φοιτητες του πανεπιστημιου σου ανεβαζουν και συνδεονται τωρα.',
        }),
      )
    }

    const mappedPosts: FeedPostView[] = postRows.map((post) => {
      const author = authorMap.get(post.author_id)
      const authorName = author?.display_name ?? t({ en: 'Student', el: 'Φοιτητης' })
      const authorUniversityName = author?.university_id
        ? (universityMap.get(author.university_id) ?? t({ en: 'University', el: 'Πανεπιστημιο' }))
        : t({ en: 'University', el: 'Πανεπιστημιο' })

      let actionText = t({ en: `${authorName} shared an update`, el: `${authorName} μοιραστηκε ενημερωση` })
      let detailText = post.content ?? t({ en: 'Campus update', el: 'Ενημερωση campus' })
      let actionLabel = t({ en: 'Open profile', el: 'Ανοιγμα προφιλ' })
      let actionHref = `/profile/${post.author_id}`

      if (post.post_type === 'listing_created') {
        const listingTitle =
          (post.related_listing_id ? listingMap.get(post.related_listing_id) : null) ??
          post.content ??
          t({ en: 'new listing', el: 'νεα αγγελια' })
        actionText = t({
          en: `${authorName} listed a new marketplace item`,
          el: `Ο/Η ${authorName} ανεβασε νεο αντικειμενο στην αγορα`,
        })
        detailText = listingTitle
        actionLabel = t({ en: 'View listing', el: 'Δες αγγελια' })
        actionHref = post.related_listing_id ? `/marketplace/${post.related_listing_id}` : '/marketplace'
      } else if (post.post_type === 'wanted_created') {
        const wantedTitle =
          (post.related_wanted_listing_id ? wantedMap.get(post.related_wanted_listing_id) : null) ??
          post.content ??
          t({ en: 'requested item', el: 'ζητουμενο αντικειμενο' })
        actionText = t({
          en: `${authorName} is looking for something`,
          el: `Ο/Η ${authorName} ψαχνει κατι`,
        })
        detailText = wantedTitle
        actionLabel = t({ en: 'View request', el: 'Δες ζητηση' })
        actionHref = '/marketplace?view=want'
      } else if (post.post_type === 'badge_earned') {
        actionText = t({
          en: `${authorName} earned a new badge`,
          el: `Ο/Η ${authorName} κερδισε νεο badge`,
        })
        detailText = post.content ?? t({ en: 'New achievement unlocked', el: 'Νεο achievement ξεκλειδωθηκε' })
        actionLabel = t({ en: 'View profile', el: 'Δες προφιλ' })
        actionHref = `/profile/${post.author_id}`
      }

      const canFollowAuthor =
        verified &&
        !preStudent &&
        !followsMissingTable &&
        post.author_id !== userId &&
        author?.is_verified_student === true &&
        author?.is_pre_student !== true

      return {
        id: post.id,
        authorId: post.author_id,
        authorName,
        authorAvatar: author?.avatar_url ?? null,
        authorUniversityId: author?.university_id ?? null,
        authorUniversityName,
        authorIsVerified: author?.is_verified_student === true,
        createdAt: post.created_at,
        actionText,
        detailText,
        actionLabel,
        actionHref,
        reactionsCount: post.reactions_count,
        commentsCount: post.comments_count,
        hasReacted: reactedSet.has(post.id),
        canFollowAuthor,
        isAuthorFollowed: followingSet.has(post.author_id),
      }
    })

    const commentRows = (commentsResponse.data ?? []) as FeedCommentRow[]
    const commentAuthorIds = Array.from(new Set(commentRows.map((comment) => comment.author_id)))

    let commentAuthorsMap = new Map<string, { name: string; avatar: string | null }>()
    if (commentAuthorIds.length > 0) {
      const { data: commentAuthors } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', commentAuthorIds)

      commentAuthorsMap = new Map(
        (commentAuthors ?? []).map((author) => [
          author.id,
          {
            name: author.display_name ?? t({ en: 'Student', el: 'Φοιτητης' }),
            avatar: author.avatar_url ?? null,
          },
        ]),
      )
    }

    const groupedComments: Record<string, FeedCommentView[]> = {}
    for (const comment of commentRows) {
      const authorInfo = commentAuthorsMap.get(comment.author_id)
      const nextComment: FeedCommentView = {
        ...comment,
        authorName: authorInfo?.name ?? t({ en: 'Student', el: 'Φοιτητης' }),
        authorAvatar: authorInfo?.avatar ?? null,
      }

      if (!groupedComments[comment.post_id]) {
        groupedComments[comment.post_id] = []
      }
      groupedComments[comment.post_id].push(nextComment)
    }

    setCommentsByPost(groupedComments)
    setPosts(mappedPosts)
    setIsLoading(false)
  }, [t])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadFeed()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadFeed])

  const visiblePosts = useMemo(() => {
    if (filter === 'all') return posts
    if (filter === 'following') {
      if (!supportsFollowSystem) return posts
      return posts.filter((post) => followingIds.has(post.authorId))
    }
    if (!currentUniversityId) return []
    return posts.filter((post) => post.authorUniversityId === currentUniversityId)
  }, [currentUniversityId, filter, followingIds, posts, supportsFollowSystem])

  const storyHighlights = useMemo(() => {
    const seen = new Set<string>()
    const highlights: Array<{
      id: string
      name: string
      avatar: string | null
      href: string
      timeLabel: string
    }> = []

    for (const post of visiblePosts) {
      if (seen.has(post.authorId)) continue
      seen.add(post.authorId)
      highlights.push({
        id: post.authorId,
        name: post.authorName,
        avatar: post.authorAvatar,
        href: `/profile/${post.authorId}`,
        timeLabel: compactTimeAgo(post.createdAt) || t({ en: 'Now', el: 'Τωρα' }),
      })
      if (highlights.length >= 10) break
    }

    return highlights
  }, [t, visiblePosts])

  const handleToggleLike = async (postId: string) => {
    if (!currentUserId || isPreStudent || !supportsFeedInteractions) return

    const targetPost = posts.find((post) => post.id === postId)
    if (!targetPost) return

    const nextHasReacted = !targetPost.hasReacted

    setPosts((previous) =>
      previous.map((post) =>
        post.id === postId
          ? {
              ...post,
              hasReacted: nextHasReacted,
              reactionsCount: Math.max(0, post.reactionsCount + (nextHasReacted ? 1 : -1)),
            }
          : post,
      ),
    )

    if (nextHasReacted) {
      const { error } = await supabase.from('feed_reactions').insert({
        post_id: postId,
        user_id: currentUserId,
        reaction_type: 'like',
      })

      if (error) {
        setPosts((previous) =>
          previous.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  hasReacted: false,
                  reactionsCount: Math.max(0, post.reactionsCount - 1),
                }
              : post,
          ),
        )
      }
      return
    }

    const { error } = await supabase
      .from('feed_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', currentUserId)
      .eq('reaction_type', 'like')

    if (error) {
      setPosts((previous) =>
        previous.map((post) =>
          post.id === postId
            ? {
                ...post,
                hasReacted: true,
                reactionsCount: post.reactionsCount + 1,
              }
            : post,
        ),
      )
    }
  }

  const handleToggleFollow = async (authorId: string) => {
    if (
      !currentUserId ||
      !isVerifiedStudent ||
      isPreStudent ||
      !supportsFollowSystem ||
      authorId === currentUserId
    ) {
      return
    }

    const isFollowing = followingIds.has(authorId)
    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('followed_id', authorId)

      if (!error) {
        setFollowingIds((previous) => {
          const next = new Set(previous)
          next.delete(authorId)
          return next
        })
        setPosts((previous) =>
          previous.map((post) =>
            post.authorId === authorId ? { ...post, isAuthorFollowed: false } : post,
          ),
        )
      }
      return
    }

    const { error } = await supabase.from('follows').insert({
      follower_id: currentUserId,
      followed_id: authorId,
    })

    if (!error) {
      setFollowingIds((previous) => new Set(previous).add(authorId))
      setPosts((previous) =>
        previous.map((post) =>
          post.authorId === authorId ? { ...post, isAuthorFollowed: true } : post,
        ),
      )
    }
  }

  const handleCommentSubmit = async (postId: string) => {
    if (!currentUserId || isPreStudent || !supportsFeedInteractions) return

    const value = (commentDrafts[postId] ?? '').trim()
    if (!value) return

    const { data: insertedComment, error } = await supabase
      .from('feed_comments')
      .insert({
        post_id: postId,
        author_id: currentUserId,
        content: value,
      })
      .select('id, post_id, author_id, content, created_at')
      .single()

    if (error || !insertedComment) return

    const nextComment: FeedCommentView = {
      ...(insertedComment as FeedCommentRow),
      authorName: currentUserName || t({ en: 'Student', el: 'Φοιτητης' }),
      authorAvatar: currentUserAvatar,
    }

    setCommentDrafts((previous) => ({ ...previous, [postId]: '' }))
    setExpandedComments((previous) => ({ ...previous, [postId]: true }))
    setCommentsByPost((previous) => {
      const existing = previous[postId] ?? []
      return {
        ...previous,
        [postId]: [...existing, nextComment],
      }
    })
    setPosts((previous) =>
      previous.map((post) =>
        post.id === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post,
      ),
    )
  }

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Campus Feed', el: 'Ροη Campus' })}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({ en: 'Loading campus activity...', el: 'Φορτωση δραστηριοτητας campus...' })}
        </p>
      </section>
    )
  }

  if (errorMessage) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Campus Feed', el: 'Ροη Campus' })}
        </h1>
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {errorMessage}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="social-card relative space-y-3 overflow-hidden p-5">
        <span className="ambient-orb right-[-24px] top-[-42px] h-28 w-28 bg-cyan-400/35" />
        <span className="ambient-orb bottom-[-48px] left-[-16px] h-24 w-24 bg-blue-500/30 [animation-delay:1.1s]" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              {t({ en: 'Campus Feed', el: 'Ροη Campus' })}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t({
                en: 'See what students in your university are doing right now.',
                el: 'Δες τι κανουν οι φοιτητες στο πανεπιστημιο σου τωρα.',
              })}
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-[pulse-soft_1.6s_ease-in-out_infinite]" />
              {t({ en: 'Live student activity', el: 'Live φοιτητικη δραστηριοτητα' })}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filter === 'all'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                  : 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
              }`}
              onClick={() => setFilter('all')}
            >
              {t({ en: 'All', el: 'Ολα' })}
            </button>
            {isVerifiedStudent && !isPreStudent && supportsFollowSystem ? (
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  filter === 'following'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                    : 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
                }`}
                onClick={() => setFilter('following')}
              >
                {t({ en: 'Following', el: 'Ακολουθεις' })}
              </button>
            ) : null}
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filter === 'university'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                  : 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
              }`}
              onClick={() => setFilter('university')}
            >
              {t({ en: 'University', el: 'Πανεπιστημιο' })}
            </button>
          </div>
        </div>

        <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]">
          {insightLine}
        </p>

        {isPreStudent ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t({
              en: 'Pre-student mode: feed is view-only. Verify your student status to like, comment, and follow.',
              el: 'Λειτουργια pre-student: μονο προβολη στη ροη. Κανε verification για like, σχολιο και follow.',
            })}
          </p>
        ) : null}
        {!supportsFeedInteractions ? (
          <p className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            {t({
              en: 'Legacy mode: activity is built from listings while social tables are not yet enabled.',
              el: 'Legacy mode: η ροη γεμιζει απο αγγελιες μεχρι να ενεργοποιηθουν τα social tables.',
            })}
          </p>
        ) : null}
      </header>

      {storyHighlights.length > 0 ? (
        <section className="social-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t({ en: 'Campus pulse', el: 'Pulse του campus' })}
            </h2>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {t({ en: 'Live now', el: 'Live τωρα' })}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {storyHighlights.map((story) => (
              <Link
                key={story.id}
                to={story.href}
                className="group min-w-[80px] rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-2 text-center hover:border-cyan-300/45"
              >
                <div className="mx-auto mb-1 w-max rounded-full bg-gradient-to-r from-cyan-300 to-blue-500 p-[2px]">
                  <Avatar name={story.name} url={story.avatar} size="md" />
                </div>
                <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">
                  {story.name}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">{story.timeLabel}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {visiblePosts.length === 0 ? (
        <section className="social-card p-5 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t({
              en: 'No activity for this filter yet.',
              el: 'Δεν υπαρχει ακομα δραστηριοτητα για αυτο το filter.',
            })}
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {visiblePosts.map((post, index) => {
            const comments = commentsByPost[post.id] ?? []
            const expanded = expandedComments[post.id] ?? false
            const visibleComments = expanded ? comments : comments.slice(-2)
            const accentBarClasses =
              post.actionHref.startsWith('/marketplace/')
                ? 'from-blue-500 via-cyan-400 to-emerald-300'
                : post.actionHref.includes('view=want')
                  ? 'from-pink-400 via-fuchsia-400 to-violet-400'
                  : 'from-sky-400 via-indigo-400 to-cyan-300'

            return (
              <article
                key={post.id}
                className="feed-card social-card overflow-hidden p-0"
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                <div className={`h-1.5 bg-gradient-to-r ${accentBarClasses}`} />
                <div className="p-5">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar
                      name={post.authorName}
                      url={post.authorAvatar}
                      size="lg"
                      showRing
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {post.authorName}
                        </p>
                        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                          {post.authorUniversityName}
                        </span>
                        {post.authorIsVerified ? (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                            {t({ en: 'Verified', el: 'Επαληθευμενος' })}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {compactTimeAgo(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {post.canFollowAuthor ? (
                    <button
                      type="button"
                      onClick={() => handleToggleFollow(post.authorId)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        post.isAuthorFollowed
                          ? 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
                          : 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                      }`}
                    >
                      {post.isAuthorFollowed
                        ? t({ en: 'Following', el: 'Ακολουθεις' })
                        : t({ en: 'Follow', el: 'Ακολουθησε' })}
                    </button>
                  ) : null}
                </header>

                <div className="mt-4 space-y-2">
                  <p className="text-base font-semibold text-[var(--text-primary)]">{post.actionText}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{post.detailText}</p>
                  <Link
                    to={post.actionHref}
                    className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500/90 to-cyan-400/90 px-3 py-1.5 text-xs font-semibold text-slate-950"
                  >
                    {post.actionLabel}
                  </Link>
                </div>

                <div className="mt-4 flex items-center gap-3 border-t border-[var(--border-primary)] pt-3">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(post.id)}
                    disabled={isPreStudent || !supportsFeedInteractions}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      post.hasReacted
                        ? 'bg-blue-500/20 text-blue-200'
                        : 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {post.hasReacted
                      ? t({ en: `Liked (${post.reactionsCount})`, el: `Liked (${post.reactionsCount})` })
                      : t({ en: `Like (${post.reactionsCount})`, el: `Like (${post.reactionsCount})` })}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedComments((previous) => ({ ...previous, [post.id]: !expanded }))
                    }
                    className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    {t({ en: `Comments (${post.commentsCount})`, el: `Σχολια (${post.commentsCount})` })}
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {visibleComments.map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-[var(--surface-soft)] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={comment.authorName}
                          url={comment.authorAvatar}
                          size="sm"
                        />
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{comment.authorName}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{compactTimeAgo(comment.created_at)}</p>
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{comment.content}</p>
                    </div>
                  ))}

                  {comments.length > 2 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedComments((previous) => ({ ...previous, [post.id]: !expanded }))
                      }
                      className="text-xs font-semibold text-[var(--text-secondary)]"
                    >
                      {expanded
                        ? t({ en: 'Show less comments', el: 'Λιγοτερα σχολια' })
                        : t({ en: 'Show all comments', el: 'Ολα τα σχολια' })}
                    </button>
                  ) : null}

                  {!isPreStudent && supportsFeedInteractions ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentDrafts[post.id] ?? ''}
                        onChange={(event) =>
                          setCommentDrafts((previous) => ({
                            ...previous,
                            [post.id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            handleCommentSubmit(post.id)
                          }
                        }}
                        className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        placeholder={t({ en: 'Write a comment...', el: 'Γραψε σχολιο...' })}
                      />
                      <button
                        type="button"
                        onClick={() => handleCommentSubmit(post.id)}
                        className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950"
                      >
                        {t({ en: 'Post', el: 'Δημοσιευση' })}
                      </button>
                    </div>
                  ) : null}
                </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
