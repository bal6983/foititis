import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type RecommendedProfileResult = {
  profile_id: string
  match_tier: number
  school_id: string | null
  university_id: string | null
  city_id: string | null
}

type PublicProfileRow = {
  id: string
  display_name: string | null
  study_year: number | null
  avatar_url: string | null
  school_id: string | null
  university_id: string | null
  city_id: string | null
  is_pre_student: boolean | null
  is_verified_student: boolean | null
}

type UniversityOption = {
  id: string
  name: string
}

type SchoolOption = {
  id: string
  name: string
  university_id: string | null
}

type CurrentProfile = {
  schoolId: string | null
  universityId: string | null
  cityId: string | null
}

type ProfileCard = {
  id: string
  tier: number
  displayName: string | null
  studyYear: number | null
  schoolName: string
  universityName: string
  avatarUrl: string
  schoolId: string | null
  universityId: string | null
  cityId: string | null
  isPreStudent: boolean
  isVerifiedStudent: boolean
}

type SearchResultCard = {
  id: string
  displayName: string | null
  studyYear: number | null
  schoolName: string
  universityName: string
  avatarUrl: string
  isPreStudent: boolean
  isVerifiedStudent: boolean
  cityId: string | null
  schoolId: string | null
}

type TieredCards = {
  1: ProfileCard[]
  2: ProfileCard[]
  3: ProfileCard[]
  4: ProfileCard[]
}

const emptyTiers: TieredCards = { 1: [], 2: [], 3: [], 4: [] }

const tierLabels: Record<number, string> = {
  1: 'Από τη σχολή σου',
  2: 'Από το πανεπιστήμιό σου',
  3: 'Από την ίδια σχολή (άλλα πανεπιστήμια)',
  4: 'Από την πόλη σου',
}

type MatchFilterId =
  | 'all'
  | 'schoolUniversityCity'
  | 'schoolCity'
  | 'universityCity'
  | 'city'
  | 'university'
  | 'school'

type AudienceFilterId = 'all' | 'prestudent' | 'students'

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

const getAvatarInitial = (value: string) =>
  value.trim().charAt(0).toUpperCase() || '—'

const audienceFilters: { id: AudienceFilterId; label: string }[] = [
  { id: 'prestudent', label: 'Pre-students' },
  { id: 'students', label: 'Students' },
]

const getStatusBadge = (isVerifiedStudent: boolean) => {
  if (isVerifiedStudent) {
    return { label: 'Verified', className: 'bg-emerald-100 text-emerald-700' }
  }
  return { label: 'Pre-student', className: 'bg-amber-100 text-amber-700' }
}

const matchesCurrentUserAudience = (
  card: { isPreStudent: boolean; isVerifiedStudent: boolean },
  currentUserIsPreStudent: boolean,
) =>
  currentUserIsPreStudent ? card.isPreStudent : card.isVerifiedStudent

const getFallbackTier = (
  candidate: {
    school_id: string | null
    university_id: string | null
    city_id: string | null
  },
  currentProfile: CurrentProfile,
) => {
  const schoolMatch =
    currentProfile.schoolId !== null &&
    candidate.school_id === currentProfile.schoolId
  const universityMatch =
    currentProfile.universityId !== null &&
    candidate.university_id === currentProfile.universityId
  const cityMatch =
    currentProfile.cityId !== null && candidate.city_id === currentProfile.cityId

  if (schoolMatch) return 1
  if (universityMatch) return 2
  if (cityMatch) return 4
  return 4
}

export default function Students() {
  const [tieredCards, setTieredCards] = useState<TieredCards>(emptyTiers)
  const [currentProfile, setCurrentProfile] =
    useState<CurrentProfile | null>(null)
  const [activeFilter, setActiveFilter] = useState<MatchFilterId>('all')
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [audienceFilter, setAudienceFilter] =
    useState<AudienceFilterId>('students')
  const defaultFiltersSetRef = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchName, setSearchName] = useState('')
  const [searchUniversity, setSearchUniversity] = useState('')
  const [searchSchool, setSearchSchool] = useState('')
  const [universities, setUniversities] = useState<UniversityOption[]>([])
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [searchUniversitiesError, setSearchUniversitiesError] = useState('')
  const [searchSchoolsError, setSearchSchoolsError] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResultCard[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const hasResults = useMemo(
    () => Object.values(tieredCards).some((tier) => tier.length > 0),
    [tieredCards],
  )

  const filteredTiered = useMemo(() => {
    const schoolId = currentProfile?.schoolId ?? null
    const universityId = currentProfile?.universityId ?? null
    const cityId = currentProfile?.cityId ?? null

    const matchesAudience = (card: ProfileCard) => {
      if (audienceFilter === 'prestudent') {
        return card.isPreStudent
      }
      if (audienceFilter === 'students') {
        return card.isVerifiedStudent
      }
      return true
    }

    const matchesFilter = (card: ProfileCard) => {
      if (!matchesAudience(card)) {
        return false
      }

      const schoolMatch = schoolId !== null && card.schoolId === schoolId
      const universityMatch =
        universityId !== null && card.universityId === universityId
      const cityMatch = cityId !== null && card.cityId === cityId

      switch (activeFilter) {
        case 'schoolUniversityCity':
          return schoolMatch && universityMatch && cityMatch
        case 'schoolCity':
          return schoolMatch && cityMatch
        case 'universityCity':
          return universityMatch && cityMatch
        case 'city':
          return cityMatch
        case 'university':
          return universityMatch
        case 'school':
          return schoolMatch
        case 'all':
        default:
          return true
      }
    }

    return {
      1: tieredCards[1].filter(matchesFilter),
      2: tieredCards[2].filter(matchesFilter),
      3: tieredCards[3].filter(matchesFilter),
      4: tieredCards[4].filter(matchesFilter),
    }
  }, [activeFilter, audienceFilter, currentProfile, tieredCards])

  const hasFilteredResults = useMemo(
    () => Object.values(filteredTiered).some((tier) => tier.length > 0),
    [filteredTiered],
  )

  useEffect(() => {
    if (!isPreStudent || defaultFiltersSetRef.current) {
      return
    }

    setActiveFilter('all')
    setAudienceFilter('prestudent')
    defaultFiltersSetRef.current = true
  }, [isPreStudent])

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSearching(true)
    setSearchError('')
    setHasSearched(true)

    const normalizedName = searchName.trim()
    const normalizedUniversity = searchUniversity.trim()
    const normalizedSchool = searchSchool.trim()

    if (!normalizedName && !normalizedUniversity && !normalizedSchool) {
      setSearchResults([])
      setSearchError('Συμπλήρωσε τουλάχιστον ένα πεδίο αναζήτησης.')
      setIsSearching(false)
      return
    }

    let universityIds: string[] | null = null
    if (normalizedUniversity) {
      const { data: universitiesData, error: universitiesError } =
        await supabase
          .from('universities')
          .select('id')
          .ilike('name', `%${normalizedUniversity}%`)

      if (universitiesError) {
        console.error('University search error:', universitiesError)
        setSearchError('Δεν ήταν δυνατή η αναζήτηση φοιτητών.')
        setSearchResults([])
        setIsSearching(false)
        return
      }

      universityIds = (universitiesData ?? []).map((item) => item.id)
      if (universityIds.length === 0) {
        setSearchResults([])
        setIsSearching(false)
        return
      }
    }

    let schoolIds: string[] | null = null
    if (normalizedSchool) {
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id')
        .ilike('name', `%${normalizedSchool}%`)

      if (schoolsError) {
        console.error('School search error:', schoolsError)
        setSearchError('Δεν ήταν δυνατή η αναζήτηση φοιτητών.')
        setSearchResults([])
        setIsSearching(false)
        return
      }

      schoolIds = (schoolsData ?? []).map((item) => item.id)
      if (schoolIds.length === 0) {
        setSearchResults([])
        setIsSearching(false)
        return
      }
    }

    let profilesQuery = supabase
      .from('public_profiles')
      .select(
        'id, display_name, study_year, avatar_url, school_id, university_id, city_id, is_verified_student, is_pre_student',
      )

    if (audienceFilter === 'prestudent') {
      profilesQuery = profilesQuery
        .eq('is_pre_student', true)
        .eq('is_verified_student', false)
    } else if (audienceFilter === 'students') {
      profilesQuery = profilesQuery.eq('is_verified_student', true)
    }

    if (normalizedName) {
      profilesQuery = profilesQuery.ilike(
        'display_name',
        `%${normalizedName}%`,
      )
    }

    if (universityIds) {
      profilesQuery = profilesQuery.in('university_id', universityIds)
    }

    if (schoolIds) {
      profilesQuery = profilesQuery.in('school_id', schoolIds)
    }

    const { data: profilesData, error: profilesError } = await profilesQuery

    if (profilesError) {
      console.error('Public profiles search error:', profilesError)
      setSearchError('Δεν ήταν δυνατή η αναζήτηση φοιτητών.')
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const profiles = (profilesData as PublicProfileRow[] | null) ?? []

    if (profiles.length === 0) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const resultUniversityIds = Array.from(
      new Set(profiles.map((item) => item.university_id).filter(Boolean)),
    ) as string[]
    const resultSchoolIds = Array.from(
      new Set(profiles.map((item) => item.school_id).filter(Boolean)),
    ) as string[]

    const searchUniversityMap = new Map<string, string>()
    const searchSchoolMap = new Map<string, string>()

    if (resultUniversityIds.length > 0) {
      const { data: universitiesData } = await supabase
        .from('universities')
        .select('id, name')
        .in('id', resultUniversityIds)

      universitiesData?.forEach((university) => {
        searchUniversityMap.set(university.id, university.name)
      })
    }

    if (resultSchoolIds.length > 0) {
      const { data: schoolsData } = await supabase
        .from('schools')
        .select('id, name')
        .in('id', resultSchoolIds)

      schoolsData?.forEach((school) => {
        searchSchoolMap.set(school.id, school.name)
      })
    }

    const nextResults: SearchResultCard[] = profiles.map((profile) => ({
      id: profile.id,
      displayName: profile.display_name,
      studyYear: profile.study_year ?? null,
      avatarUrl: profile.avatar_url ?? '',
      isPreStudent:
        Boolean(profile.is_pre_student) && !Boolean(profile.is_verified_student),
      isVerifiedStudent: Boolean(profile.is_verified_student),
      cityId: profile.city_id ?? null,
      schoolId: profile.school_id ?? null,
      universityName: profile.university_id
        ? searchUniversityMap.get(profile.university_id) ?? ''
        : '',
      schoolName: profile.school_id
        ? searchSchoolMap.get(profile.school_id) ?? ''
        : '',
    }))

    if (isPreStudent && currentProfile) {
      const myCityId = currentProfile.cityId
      const mySchoolId = currentProfile.schoolId

      const getSearchPriority = (card: SearchResultCard): number => {
        if (card.isPreStudent) {
          const cityMatch = myCityId !== null && card.cityId === myCityId
          const schoolMatch = mySchoolId !== null && card.schoolId === mySchoolId
          if (cityMatch && schoolMatch) return 1
          if (cityMatch) return 2
          if (schoolMatch) return 3
          return 4
        }
        return 5
      }

      nextResults.sort((a, b) => getSearchPriority(a) - getSearchPriority(b))
    }

    setSearchResults(nextResults)
    setIsSearching(false)
  }

  useEffect(() => {
    let isMounted = true

    const loadSearchOptions = async () => {
      setSearchUniversitiesError('')
      setSearchSchoolsError('')

      const [universitiesResponse, schoolsResponse] = await Promise.all([
        supabase.from('universities').select('id, name').order('name'),
        supabase
          .from('schools')
          .select('id, name, university_id')
          .order('name'),
      ])

      if (!isMounted) return

      if (universitiesResponse.error) {
        console.error('Universities load error:', universitiesResponse.error)
        setSearchUniversitiesError('Unable to load universities.')
        setUniversities([])
      } else {
        setUniversities(universitiesResponse.data ?? [])
      }

      if (schoolsResponse.error) {
        console.error('Schools load error:', schoolsResponse.error)
        setSearchSchoolsError('Unable to load schools.')
        setSchools([])
      } else {
        setSchools(schoolsResponse.data ?? [])
      }

    }

    loadSearchOptions()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadRecommendations = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των προτάσεων.${details}`,
        )
        setIsLoading(false)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('school_id, university_id, city_id, is_pre_student, is_verified_student')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError.message ? ` (${profileError.message})` : ''
        setErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των προτάσεων.${details}`,
        )
      }

      setCurrentProfile({
        schoolId: profileData?.school_id ?? null,
        universityId: profileData?.university_id ?? null,
        cityId: profileData?.city_id ?? null,
      })
      const currentUserIsPreStudent =
        Boolean(profileData?.is_pre_student) &&
        !Boolean(profileData?.is_verified_student)
      setIsPreStudent(currentUserIsPreStudent)

      const { data: recommendedData, error: recommendedError } =
        await supabase.rpc('get_recommended_student_profiles', {
          current_user_id: userData.user.id,
          limit_per_tier: 10,
        })

      if (!isMounted) return

      if (recommendedError || !recommendedData) {
        const details = recommendedError?.message
          ? ` (${recommendedError.message})`
          : ''
        setErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των προτάσεων.${details}`,
        )
        setTieredCards(emptyTiers)
        setIsLoading(false)
        return
      }

      const results = recommendedData as RecommendedProfileResult[]

      if (results.length === 0) {
        setTieredCards(emptyTiers)
        setIsLoading(false)
        return
      }

      const schoolIds = Array.from(
        new Set(results.map((item) => item.school_id).filter(Boolean)),
      ) as string[]
      const universityIds = Array.from(
        new Set(results.map((item) => item.university_id).filter(Boolean)),
      ) as string[]
      const profileIds = Array.from(
        new Set(results.map((item) => item.profile_id)),
      )

      const schoolMap = new Map<string, string>()
      const universityMap = new Map<string, string>()
      const profileMap = new Map<
        string,
        {
          displayName: string | null
          studyYear: number | null
          avatarUrl: string
          isPreStudent: boolean
          isVerifiedStudent: boolean
        }
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
          .select(
            'id, display_name, study_year, avatar_url, is_verified_student, is_pre_student',
          )
          .in('id', profileIds)

        profilesData?.forEach((profileItem) => {
          profileMap.set(profileItem.id, {
            displayName: profileItem.display_name ?? null,
            studyYear: profileItem.study_year ?? null,
            avatarUrl: profileItem.avatar_url ?? '',
            isPreStudent:
              Boolean(profileItem.is_pre_student) &&
              !Boolean(profileItem.is_verified_student),
            isVerifiedStudent: Boolean(profileItem.is_verified_student),
          })
        })
      }

      if (!isMounted) return

      const cards = results.map((item) => {
        const profileInfo = profileMap.get(item.profile_id)

        return {
          id: item.profile_id,
          tier: item.match_tier,
          displayName: profileInfo?.displayName ?? null,
          studyYear: profileInfo?.studyYear ?? null,
          isPreStudent: profileInfo?.isPreStudent ?? false,
          isVerifiedStudent: profileInfo?.isVerifiedStudent ?? false,
          avatarUrl: profileInfo?.avatarUrl ?? '',
          schoolName: item.school_id ? schoolMap.get(item.school_id) ?? '' : '',
          universityName: item.university_id
            ? universityMap.get(item.university_id) ?? ''
            : '',
          schoolId: item.school_id,
          universityId: item.university_id,
          cityId: item.city_id,
        }
      })

      let cardsForAudience = cards.filter((card) =>
        matchesCurrentUserAudience(card, currentUserIsPreStudent),
      )

      if (currentUserIsPreStudent && cardsForAudience.length === 0) {
        const currentProfileSnapshot: CurrentProfile = {
          schoolId: profileData?.school_id ?? null,
          universityId: profileData?.university_id ?? null,
          cityId: profileData?.city_id ?? null,
        }

        const { data: fallbackProfilesData, error: fallbackProfilesError } =
          await supabase
            .from('public_profiles')
            .select(
              'id, display_name, study_year, avatar_url, school_id, university_id, city_id, is_verified_student, is_pre_student',
            )
            .eq('is_pre_student', true)
            .eq('is_verified_student', false)
            .neq('id', userData.user.id)

        if (!fallbackProfilesError && fallbackProfilesData) {
          const fallbackProfiles = fallbackProfilesData as PublicProfileRow[]
          const fallbackSchoolIds = Array.from(
            new Set(fallbackProfiles.map((item) => item.school_id).filter(Boolean)),
          ) as string[]
          const fallbackUniversityIds = Array.from(
            new Set(
              fallbackProfiles.map((item) => item.university_id).filter(Boolean),
            ),
          ) as string[]

          const fallbackSchoolMap = new Map<string, string>()
          const fallbackUniversityMap = new Map<string, string>()

          if (fallbackSchoolIds.length > 0) {
            const { data: fallbackSchoolsData } = await supabase
              .from('schools')
              .select('id, name')
              .in('id', fallbackSchoolIds)

            fallbackSchoolsData?.forEach((school) => {
              fallbackSchoolMap.set(school.id, school.name)
            })
          }

          if (fallbackUniversityIds.length > 0) {
            const { data: fallbackUniversitiesData } = await supabase
              .from('universities')
              .select('id, name')
              .in('id', fallbackUniversityIds)

            fallbackUniversitiesData?.forEach((university) => {
              fallbackUniversityMap.set(university.id, university.name)
            })
          }

          cardsForAudience = fallbackProfiles.map((profileItem) => ({
            id: profileItem.id,
            tier: getFallbackTier(profileItem, currentProfileSnapshot),
            displayName: profileItem.display_name,
            studyYear: profileItem.study_year ?? null,
            isPreStudent:
              Boolean(profileItem.is_pre_student) &&
              !Boolean(profileItem.is_verified_student),
            isVerifiedStudent: Boolean(profileItem.is_verified_student),
            avatarUrl: profileItem.avatar_url ?? '',
            schoolName: profileItem.school_id
              ? fallbackSchoolMap.get(profileItem.school_id) ?? ''
              : '',
            universityName: profileItem.university_id
              ? fallbackUniversityMap.get(profileItem.university_id) ?? ''
              : '',
            schoolId: profileItem.school_id ?? null,
            universityId: profileItem.university_id ?? null,
            cityId: profileItem.city_id ?? null,
          }))
        }
      }

      const nextTiered: TieredCards = { 1: [], 2: [], 3: [], 4: [] }
      cardsForAudience.forEach((card) => {
        if (card.tier >= 1 && card.tier <= 4) {
          nextTiered[card.tier as 1 | 2 | 3 | 4].push(card)
        }
      })

      setTieredCards(nextTiered)
      setIsLoading(false)
    }

    loadRecommendations()

    return () => {
      isMounted = false
    }
  }, [])

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Φοιτητές</h1>
        <p className="text-sm text-slate-600">
          Φορτώνουμε τις προτάσεις σου...
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Φοιτητές</h1>
      </header>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Αναζήτηση φοιτητών</h2>
          <p className="text-xs text-slate-500">
            Βρες φοιτητές με βάση το όνομα, τη σχολή ή το πανεπιστήμιο.
          </p>
        </div>
        <form className="space-y-3" onSubmit={handleSearch}>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="Όνομα"
              type="search"
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="Πανεπιστήμιο"
              type="search"
              list="universities"
              value={searchUniversity}
              onChange={(event) => setSearchUniversity(event.target.value)}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="Σχολή"
              type="search"
              list="schools"
              value={searchSchool}
              onChange={(event) => setSearchSchool(event.target.value)}
            />
          </div>
          <datalist id="universities">
            {universities.map((university) => (
              <option key={university.id} value={university.name} />
            ))}
          </datalist>
          <datalist id="schools">
            {schools.map((school) => (
              <option key={school.id} value={school.name} />
            ))}
          </datalist>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSearching}
          >
            {isSearching ? 'Αναζήτηση...' : 'Αναζήτηση'}
          </button>
        </form>
        {searchUniversitiesError ? (
          <p className="text-xs text-rose-600">{searchUniversitiesError}</p>
        ) : null}
        {searchSchoolsError ? (
          <p className="text-xs text-rose-600">{searchSchoolsError}</p>
        ) : null}
        {searchError ? (
          <p className="text-sm text-rose-600">{searchError}</p>
        ) : null}
      </section>

      {hasSearched ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Αποτελέσματα αναζήτησης</h2>
          {isSearching ? (
            <p className="text-sm text-slate-600">
              Φορτώνουμε τα αποτελέσματα...
            </p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-slate-600">
              Δεν βρέθηκαν φοιτητές με αυτά τα κριτήρια.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((result) => {
                const displayName = result.displayName?.trim() || 'Χρήστης'
                const statusBadge = getStatusBadge(result.isVerifiedStudent)
                return (
                  <div
                    key={result.id}
                    className="relative rounded-lg border border-slate-200 bg-white p-4"
                  >
                      <span
                        className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                        <span className="absolute inset-0 flex items-center justify-center">
                          {getAvatarInitial(displayName)}
                        </span>
                        {result.avatarUrl ? (
                          <img
                            alt={displayName}
                            className="relative h-10 w-10 rounded-full object-cover"
                            src={result.avatarUrl}
                            onError={(event) => {
                              event.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {displayName}
                      </p>
                      <p className="text-xs text-slate-600">
                        Πανεπιστήμιο: {result.universityName || '—'}
                      </p>
                      <p className="text-xs text-slate-600">
                        Σχολή: {result.schoolName || '—'}
                      </p>
                      <p className="text-xs text-slate-600">
                        Έτος φοίτησης: {result.studyYear ?? '—'}
                      </p>
                    </div>
                    <Link
                      className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      to={`/profile/${result.id}`}
                    >
                      Δες προφίλ
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      {isPreStudent && hasResults ? (
        <div className="flex flex-wrap gap-2">
          {audienceFilters.map((filter) => {
            const isActive = audienceFilter === filter.id
            return (
              <button
                key={filter.id}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                type="button"
                onClick={() => setAudienceFilter(filter.id)}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {hasResults ? (
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

      {!errorMessage && !hasFilteredResults ? (
        <p className="text-sm text-slate-600">
          {hasResults
            ? 'Δεν υπάρχουν φοιτητές για αυτό το φίλτρο.'
            : 'Δεν υπάρχουν ακόμη φοιτητές με παρόμοια στοιχεία.'}
        </p>
      ) : null}

      {Object.entries(tierLabels).map(([tierKey, title]) => {
        const tier = Number(tierKey) as 1 | 2 | 3 | 4
        const cards = filteredTiered[tier]

        if (!cards || cards.length === 0) {
          return null
        }

        return (
          <section key={tier} className="space-y-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => {
                const statusBadge = getStatusBadge(card.isVerifiedStudent)
                return (
                <div
                  key={card.id}
                    className="relative rounded-lg border border-slate-200 bg-white p-4"
                >
                      <span
                        className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                      <span className="absolute inset-0 flex items-center justify-center">
                        {getAvatarInitial(card.displayName || 'Χρήστης')}
                      </span>
                      {card.avatarUrl ? (
                        <img
                          alt={card.displayName || 'Χρήστης'}
                          className="relative h-10 w-10 rounded-full object-cover"
                          src={card.avatarUrl}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {card.displayName || 'Χρήστης'}
                    </p>
                    <p className="text-xs text-slate-600">
                      Πανεπιστήμιο: {card.universityName || '—'}
                    </p>
                    <p className="text-xs text-slate-600">
                      Σχολή: {card.schoolName || '—'}
                    </p>
                    <p className="text-xs text-slate-600">
                      Έτος φοίτησης: {card.studyYear ?? '—'}
                    </p>
                  </div>
                  <Link
                    className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    to={`/profile/${card.id}`}
                  >
                    Δες προφίλ
                  </Link>
                </div>
              )})}
            </div>
          </section>
        )
      })}
    </section>
  )
}
