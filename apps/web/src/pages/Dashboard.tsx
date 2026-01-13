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

type RecommendedProfileCard = {
  id: string
  schoolName: string
  universityName: string
  cityName: string
  label: string
  matchCount: number
  orderIndex: number
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

const getMatchLabel = (
  schoolMatch: boolean,
  universityMatch: boolean,
  cityMatch: boolean,
) => {
  if (schoolMatch && universityMatch && cityMatch) {
    return 'Ίδια σχολή, ΑΕΙ & πόλη'
  }
  if (schoolMatch && universityMatch) {
    return 'Ίδια σχολή & ΑΕΙ'
  }
  if (schoolMatch && cityMatch) {
    return 'Ίδια σχολή & πόλη'
  }
  if (universityMatch && cityMatch) {
    return 'Ίδιο ΑΕΙ & πόλη'
  }
  if (schoolMatch) {
    return 'Ίδια σχολή'
  }
  if (universityMatch) {
    return 'Ίδιο ΑΕΙ'
  }
  if (cityMatch) {
    return 'Ίδια πόλη'
  }
  return 'Πρόταση'
}

export default function Dashboard() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [matchGroups, setMatchGroups] =
    useState<MatchGroups>(emptyMatchGroups)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const cardsToShow = [
    ...matchGroups.strongMatches,
    ...matchGroups.mediumMatches,
    ...matchGroups.weakMatches,
  ].slice(0, 4)

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του χρήστη.${details}`)
        setIsLoading(false)
        return
      }

      setEmail(userData.user.email ?? '')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, is_verified_student, city_id, university_id, school_id')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError.message ? ` (${profileError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`)
      }

      setDisplayName(profile?.display_name ?? '')
      setIsVerifiedStudent(Boolean(profile?.is_verified_student))

      const { data: recommendedData, error: recommendedError } =
        await supabase.rpc('get_recommended_student_profiles', {
          current_user_id: userData.user.id,
          limit_per_tier: 4,
        })

      if (!isMounted) return

      if (!recommendedError && recommendedData) {
        const currentSchoolId = profile?.school_id ?? null
        const currentUniversityId = profile?.university_id ?? null
        const currentCityId = profile?.city_id ?? null
        const results = recommendedData as RecommendedProfileResult[]

        const schoolIds = Array.from(
          new Set(results.map((item) => item.school_id).filter(Boolean)),
        ) as string[]
        const universityIds = Array.from(
          new Set(results.map((item) => item.university_id).filter(Boolean)),
        ) as string[]
        const cityIds = Array.from(
          new Set(results.map((item) => item.city_id).filter(Boolean)),
        ) as string[]

        const schoolMap = new Map<string, string>()
        const universityMap = new Map<string, string>()
        const cityMap = new Map<string, string>()

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

        if (cityIds.length > 0) {
          const { data: citiesData } = await supabase
            .from('cities')
            .select('id, name')
            .in('id', cityIds)
          citiesData?.forEach((city) => {
            cityMap.set(city.id, city.name)
          })
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

          return {
            id: item.profile_id,
            schoolName: item.school_id
              ? schoolMap.get(item.school_id) ?? ''
              : '',
            universityName: item.university_id
              ? universityMap.get(item.university_id) ?? ''
              : '',
            cityName: item.city_id ? cityMap.get(item.city_id) ?? '' : '',
            label: getMatchLabel(schoolMatch, universityMatch, cityMatch),
            matchCount,
            orderIndex: index,
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
      } else {
        setMatchGroups(emptyMatchGroups)
      }

      setIsLoading(false)
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [])

  const greetingName = displayName || email
  const hasGreetingName = greetingName.trim().length > 0

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Φόρτωση πίνακα...</h1>
        <p className="text-sm text-slate-600">
          Δες τι μπορείς να κάνεις στην πλατφόρμα.
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
              <span>Καλώς ήρθες,</span>
              <span className="inline-flex items-center gap-2">
                <span className="break-all">{greetingName}</span>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center border border-slate-300/70 bg-transparent text-[9px] font-semibold leading-none [clip-path:polygon(25%_6%,_75%_6%,_100%_50%,_75%_94%,_25%_94%,_0%_50%)] ${
                    isVerifiedStudent ? 'text-purple-500' : 'text-red-500'
                  }`}
                  aria-hidden="true"
                >
                  {isVerifiedStudent ? '✓' : 'pS'}
                </span>
              </span>
            </>
          ) : (
            <span>Καλώς ήρθες!</span>
          )}
        </h1>
        <p className="text-sm text-slate-600">
          Δες τι μπορείς να κάνεις στην πλατφόρμα.
        </p>
      </header>

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            Προτεινόμενοι φοιτητές για εσένα
          </h2>
        </div>

        {cardsToShow.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {cardsToShow.map((profile) => (
              <div
                key={profile.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {profile.schoolName || '—'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {profile.universityName || '—'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {profile.cityName || '—'}
                  </p>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {profile.label}
                </p>
                <button
                  className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  type="button"
                >
                  Δες προφίλ
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Δεν βρέθηκαν ακόμη προτεινόμενοι φοιτητές.
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Marketplace</h2>
            <p className="text-sm text-slate-600">
              Αγόρασε ή πούλησε αντικείμενα από άλλους φοιτητές.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            to="/marketplace"
          >
            Άνοιγμα
          </Link>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Ομάδες</h2>
            <p className="text-sm text-slate-600">
              Σύντομα θα μπορείς να συμμετέχεις σε ομάδες φοιτητών.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Άνοιγμα
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Εκδηλώσεις</h2>
            <p className="text-sm text-slate-600">
              Σύντομα θα βρίσκεις εκδηλώσεις και συναντήσεις.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Άνοιγμα
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Συζητήσεις / Chat</h2>
            <p className="text-sm text-slate-600">
              Σύντομα θα μπορείς να συνομιλείς με άλλους φοιτητές.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Άνοιγμα
          </button>
        </section>
      </div>
    </section>
  )
}
