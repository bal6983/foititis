import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type RecommendedProfileResult = {
  profile_id: string
  match_tier: number
  school_id: string | null
  university_id: string | null
  city_id: string | null
}

type ProfileCard = {
  id: string
  tier: number
  schoolName: string
  universityName: string
  cityName: string
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

export default function Students() {
  const [tieredCards, setTieredCards] = useState<TieredCards>(emptyTiers)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const hasResults = useMemo(
    () => Object.values(tieredCards).some((tier) => tier.length > 0),
    [tieredCards],
  )

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

      const cards = results.map((item) => ({
        id: item.profile_id,
        tier: item.match_tier,
        schoolName: item.school_id
          ? schoolMap.get(item.school_id) ?? ''
          : '',
        universityName: item.university_id
          ? universityMap.get(item.university_id) ?? ''
          : '',
        cityName: item.city_id ? cityMap.get(item.city_id) ?? '' : '',
      }))

      const nextTiered: TieredCards = { 1: [], 2: [], 3: [], 4: [] }
      cards.forEach((card) => {
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

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      {!errorMessage && !hasResults ? (
        <p className="text-sm text-slate-600">
          Δεν βρέθηκαν φοιτητές με παρόμοια στοιχεία προς το παρόν.
        </p>
      ) : null}

      {Object.entries(tierLabels).map(([tierKey, title]) => {
        const tier = Number(tierKey) as 1 | 2 | 3 | 4
        const cards = tieredCards[tier]

        if (!cards || cards.length === 0) {
          return null
        }

        return (
          <section key={tier} className="space-y-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {card.schoolName || '—'}
                    </p>
                    <p className="text-xs text-slate-600">
                      {card.universityName || '—'}
                    </p>
                    <p className="text-xs text-slate-600">
                      {card.cityName || '—'}
                    </p>
                  </div>
                  <button
                    className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    type="button"
                  >
                    Δες προφίλ
                  </button>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </section>
  )
}
