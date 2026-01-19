import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type RecommendedProfileResult = {
  profile_id: string
  match_tier: number
  school_id: string | null
  university_id: string | null
  city_id: string | null
}

type ProfileSummary = {
  display_name: string | null
  is_verified_student: boolean | null
  city_id: string | null
  university_id: string | null
  school_id: string | null
}

type RecommendedProfileCard = {
  id: string
  universityName: string
  schoolName: string
  displayName: string | null
  studyYear: number | null
  avatarUrl: string
  label: string
  matchCount: number
  orderIndex: number
  schoolMatch: boolean
  universityMatch: boolean
  cityMatch: boolean
}

type MatchGroups = {
  strongMatches: RecommendedProfileCard[]
  mediumMatches: RecommendedProfileCard[]
  weakMatches: RecommendedProfileCard[]
}

const emptyMatchGroups: MatchGroups = {
  strongMatches: [],
  mediumMatches: [],
  weakMatches: [],
}

type MatchFilterId =
  | 'all'
  | 'schoolUniversityCity'
  | 'schoolCity'
  | 'universityCity'
  | 'city'
  | 'university'
  | 'school'

const matchFilters: { id: MatchFilterId; label: string }[] = [
  { id: 'all', label: 'Όλοι' },
  {
    id: 'schoolUniversityCity',
    label: 'Ίδια σχολή + πανεπιστήμιο + πόλη',
  },
  { id: 'schoolCity', label: 'Ίδια σχολή + πόλη' },
  { id: 'universityCity', label: 'Ίδιο πανεπιστήμιο + πόλη' },
  { id: 'city', label: 'Ίδια πόλη' },
  { id: 'university', label: 'Ίδιο πανεπιστήμιο' },
  { id: 'school', label: 'Ίδια σχολή' },
]

const getMatchLabel = (
  schoolMatch: boolean,
  universityMatch: boolean,
  cityMatch: boolean,
) => {
  if (schoolMatch && universityMatch && cityMatch) {
    return 'Ίδια σχολή, πανεπιστήμιο & πόλη'
  }
  if (schoolMatch && universityMatch) {
    return 'Ίδια σχολή & πανεπιστήμιο'
  }
  if (schoolMatch && cityMatch) {
    return 'Ίδια σχολή & πόλη'
  }
  if (universityMatch && cityMatch) {
    return 'Ίδιο πανεπιστήμιο & πόλη'
  }
  if (schoolMatch) {
    return 'Ίδια σχολή'
  }
  if (universityMatch) {
    return 'Ίδιο πανεπιστήμιο'
  }
  if (cityMatch) {
    return 'Ίδια πόλη'
  }
  return 'Διαφορετικά στοιχεία'
}

const getAvatarInitial = (value: string) =>
  value.trim().charAt(0).toUpperCase() || '—'

export default function Dashboard() {
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [recommendedResults, setRecommendedResults] = useState<
    RecommendedProfileResult[] | null
  >(null)
  const [matchGroups, setMatchGroups] =
    useState<MatchGroups>(emptyMatchGroups)
  const [activeFilter, setActiveFilter] = useState<MatchFilterId>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const allCards = [
    ...matchGroups.strongMatches,
    ...matchGroups.mediumMatches,
    ...matchGroups.weakMatches,
  ]

  const filteredCards = allCards.filter((card) => {
    switch (activeFilter) {
      case 'schoolUniversityCity':
        return card.schoolMatch && card.universityMatch && card.cityMatch
      case 'schoolCity':
        return card.schoolMatch && card.cityMatch
      case 'universityCity':
        return card.universityMatch && card.cityMatch
      case 'city':
        return card.cityMatch
      case 'university':
        return card.universityMatch
      case 'school':
        return card.schoolMatch
      case 'all':
      default:
        return true
    }
  })

  const cardsToShow = filteredCards.slice(0, 4)
  const hasAnyResults = allCards.length > 0

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των δεδομένων.${details}`,
        )
        setIsLoading(false)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('public_profiles')
        .select('display_name, is_verified_student, city_id, university_id, school_id')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError.message ? ` (${profileError.message})` : ''
        setErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των δεδομένων.${details}`,
        )
      }

      const normalizedProfile: ProfileSummary = {
        display_name: profileData?.display_name ?? null,
        is_verified_student: profileData?.is_verified_student ?? null,
        city_id: profileData?.city_id ?? null,
        university_id: profileData?.university_id ?? null,
        school_id: profileData?.school_id ?? null,
      }

      setProfile(normalizedProfile)
      setDisplayName(normalizedProfile.display_name ?? null)
      setIsVerifiedStudent(Boolean(normalizedProfile.is_verified_student))

      const { data: recommendedData, error: recommendedError } =
        await supabase.rpc('get_recommended_student_profiles', {
          current_user_id: userData.user.id,
          limit_per_tier: 4,
        })

      if (!isMounted) return

      const rpcResults = recommendedData

      if (recommendedError || !rpcResults) {
        setMatchGroups(emptyMatchGroups)
        setRecommendedResults(null)
        setIsLoading(false)
        return
      }

      const results = rpcResults as RecommendedProfileResult[]
      setRecommendedResults(results)
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!recommendedResults) {
      return
    }

    let isMounted = true

    const computeMatches = async () => {
      setIsLoading(true)

      const currentSchoolId = profile?.school_id ?? null
      const currentUniversityId = profile?.university_id ?? null
      const currentCityId = profile?.city_id ?? null
      const results = recommendedResults

      const schoolIds = Array.from(
        new Set(results.map((item) => item.school_id).filter(Boolean)),
      ) as string[]
      const universityIds = Array.from(
        new Set(results.map((item) => item.university_id).filter(Boolean)),
      ) as string[]
      const schoolMap = new Map<string, string>()
      const universityMap = new Map<string, string>()
      const profileIds = Array.from(
        new Set(results.map((item) => item.profile_id).filter(Boolean)),
      ) as string[]
      const profileMap = new Map<
        string,
        { displayName: string | null; studyYear: number | null; avatarUrl: string }
      >()

      if (schoolIds.length > 0) {
        const { data: schoolsData } = await supabase
          .from('schools')
          .select('id, name')
          .in('id', schoolIds)
        schoolsData?.forEach((school) => {
          schoolMap.set(school.id, school.name)
        })
      }

      if (universityIds.length > 0) {
        const { data: universitiesData } = await supabase
          .from('universities')
          .select('id, name')
          .in('id', universityIds)
        universitiesData?.forEach((university) => {
          universityMap.set(university.id, university.name)
        })
      }

      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('public_profiles')
          .select('id, display_name, study_year, avatar_url')
          .in('id', profileIds)
        profilesData?.forEach((profileItem) => {
          profileMap.set(profileItem.id, {
            displayName: profileItem.display_name ?? null,
            studyYear: profileItem.study_year ?? null,
            avatarUrl: profileItem.avatar_url ?? '',
          })
        })

        if (profileMap.size === 0) {
          await Promise.all(
            profileIds.map(async (profileId) => {
              const { data: profileItem } = await supabase
                .from('public_profiles')
                .select('id, display_name, study_year, avatar_url')
                .eq('id', profileId)
                .maybeSingle()

              if (profileItem) {
                profileMap.set(profileItem.id, {
                  displayName: profileItem.display_name ?? null,
                  studyYear: profileItem.study_year ?? null,
                  avatarUrl: profileItem.avatar_url ?? '',
                })
              }
            }),
          )
        }
      }

      if (!isMounted) return

      const cards = results.map((item, index) => {
        const schoolMatch =
          currentSchoolId !== null && item.school_id === currentSchoolId
        const universityMatch =
          currentUniversityId !== null &&
          item.university_id === currentUniversityId
        const cityMatch =
          currentCityId !== null && item.city_id === currentCityId
        const matchCount = [schoolMatch, universityMatch, cityMatch].filter(
          Boolean,
        ).length
        const profileInfo = profileMap.get(item.profile_id)

        return {
          id: item.profile_id,
          displayName: profileInfo?.displayName ?? null,
          avatarUrl: profileInfo?.avatarUrl ?? '',
          universityName: item.university_id
            ? universityMap.get(item.university_id) ?? ''
            : '',
          schoolName: item.school_id ? schoolMap.get(item.school_id) ?? '' : '',
          studyYear: profileInfo?.studyYear ?? null,
          label: getMatchLabel(schoolMatch, universityMatch, cityMatch),
          matchCount,
          orderIndex: index,
          schoolMatch,
          universityMatch,
          cityMatch,
        }
      })

      const strongMatches = cards
        .filter((card) => card.matchCount >= 2)
        .sort(
          (a, b) =>
            b.matchCount - a.matchCount || a.orderIndex - b.orderIndex,
        )
      const mediumMatches = cards
        .filter((card) => card.matchCount === 1)
        .sort((a, b) => a.orderIndex - b.orderIndex)
      const weakMatches = cards
        .filter((card) => card.matchCount === 0)
        .sort((a, b) => a.orderIndex - b.orderIndex)

      setMatchGroups({
        strongMatches,
        mediumMatches,
        weakMatches,
      })
      setIsLoading(false)
    }

    computeMatches()

    return () => {
      isMounted = false
    }
  }, [profile, recommendedResults])

  const greetingName = displayName ?? 'Χρήστης'
  const hasGreetingName = greetingName.trim().length > 0

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">
          Φορτώνουμε τις προτάσεις σου...
        </h1>
        <p className="text-sm text-slate-600">
          Περίμενε λίγο όσο ετοιμάζουμε τα προτεινόμενα προφίλ.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold flex flex-wrap items-center gap-2">
          {hasGreetingName ? (
            <>
              <span>Γεια σου,</span>
              <span className="inline-flex items-center gap-2">
                <span className="break-all">{greetingName}</span>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center border border-slate-300/70 bg-transparent text-[9px] font-semibold leading-none [clip-path:polygon(25%_6%,_75%_6%,_100%_50%,_75%_94%,_25%_94%,_0%_50%)] ${
                    isVerifiedStudent ? 'text-purple-500' : 'text-red-500'
                  }`}
                  aria-hidden="true"
                >
                  {isVerifiedStudent ? 'ΕΠ' : 'ΜΗ'}
                </span>
              </span>
            </>
          ) : (
            <span>Γεια σου!</span>
          )}
        </h1>
        <p className="text-sm text-slate-600">
          Βρες νέους φοιτητές που ταιριάζουν στο προφίλ σου.
        </p>
      </header>

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Προτεινόμενοι φοιτητές για εσένα
            </h2>
            <p className="text-xs text-slate-500">
              Φιλτράρε με βάση τα κοινά στοιχεία σου.
            </p>
          </div>
          {hasAnyResults ? (
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              to="/students"
            >
              Δες όλους τους φοιτητές
            </Link>
          ) : null}
        </div>

        {hasAnyResults ? (
          <div className="flex flex-wrap gap-2">
            {matchFilters.map((filter) => {
              const isActive = activeFilter === filter.id
              return (
                <button
                  key={filter.id}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                </button>
              )
            })}
          </div>
        ) : null}

        {cardsToShow.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {cardsToShow.map((profileItem) => (
              <div
                key={profileItem.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">
                    <span className="absolute inset-0 flex items-center justify-center">
                      {getAvatarInitial(profileItem.displayName ?? 'Χρήστης')}
                    </span>
                    {profileItem.avatarUrl ? (
                      <img
                        alt={profileItem.displayName ?? 'Χρήστης'}
                        className="relative h-10 w-10 rounded-full object-cover"
                        src={profileItem.avatarUrl}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {profileItem.displayName ?? 'Χρήστης'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Πανεπιστήμιο: {profileItem.universityName || '—'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Σχολή: {profileItem.schoolName || '—'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Έτος φοίτησης: {profileItem.studyYear ?? '—'}
                  </p>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  Ταίριασμα: {profileItem.label}
                </p>
                <Link
                  className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  to={`/profile/${profileItem.id}`}
                >
                  Δες προφίλ
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {hasAnyResults
                ? 'Δεν υπάρχουν φοιτητές για αυτό το φίλτρο.'
                : 'Δεν υπάρχουν ακόμη φοιτητές με παρόμοια στοιχεία.'}
            </p>
            {!hasAnyResults ? (
              <Link
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                to="/students"
              >
                Δες όλους τους φοιτητές
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Marketplace</h2>
            <p className="text-sm text-slate-600">
              Βρες αγγελίες για σημειώσεις, βιβλία και μεταχειρισμένα.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            to="/marketplace"
          >
            Εξερεύνησε
          </Link>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Νέα</h2>
            <p className="text-sm text-slate-600">
              Δες ενημερώσεις για νέα από την κοινότητα.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Σύντομα
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Εκδηλώσεις</h2>
            <p className="text-sm text-slate-600">
              Βρες εκδηλώσεις για όλους τους φοιτητές.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Σύντομα
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Μηνύματα / Chat</h2>
            <p className="text-sm text-slate-600">
              Σύντομα θα μπορείς να στέλνεις μηνύματα σε άλλους φοιτητές.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Σύντομα
          </button>
        </section>
      </div>
    </section>
  )
}
