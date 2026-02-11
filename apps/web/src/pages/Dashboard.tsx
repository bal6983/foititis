import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BadgeGrid from '../components/gamification/BadgeGrid'
import LevelCard from '../components/gamification/LevelCard'
import MarketplaceCard from '../components/marketplace/MarketplaceCard'
import SectionCard from '../components/ui/SectionCard'
import { useI18n, type LocalizedMessage } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'
import type { UnifiedMarketplaceItem } from '../components/marketplace/types'

type ProfileSummary = {
  id: string
  display_name: string | null
  full_name: string | null
  avatar_url: string | null
  is_verified_student: boolean | null
  is_pre_student: boolean | null
  university_id: string | null
}

type ListingRow = {
  id: string
  title: string
  description: string
  price: string
  condition: string
  category: string
  created_at: string
  seller_id: string
}

type WantedRow = {
  id: string
  title: string
  description: string
  category: string
  created_at: string
  user_id: string
}

export default function Dashboard() {
  const { t } = useI18n()
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [universityName, setUniversityName] = useState('')
  const [previewItems, setPreviewItems] = useState<UnifiedMarketplaceItem[]>([])
  const [sellCount, setSellCount] = useState(0)
  const [wantCount, setWantCount] = useState(0)
  const [mySellCount, setMySellCount] = useState(0)
  const [myWantCount, setMyWantCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<LocalizedMessage | null>(null)

  const announcements = [
    t({
      en: 'Department registration window closes this Friday.',
      el: 'Η εγγραφή στα τμήματα κλείνει αυτή την Παρασκευή.',
    }),
    t({
      en: 'Library night schedule is extended during exams.',
      el: 'Το ωράριο της βιβλιοθήκης επεκτείνεται στην εξεταστική.',
    }),
    t({
      en: 'Hackathon pre-registration opens next Monday.',
      el: 'Οι προεγγραφές για το hackathon ανοίγουν την επόμενη Δευτέρα.',
    }),
  ]

  useEffect(() => {
    let isMounted = true

    const loadDashboard = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage({
          en: `Unable to load dashboard.${details}`,
          el: `Δεν ήταν δυνατή η φόρτωση του πίνακα.${details}`,
        })
        setIsLoading(false)
        return
      }

      const userId = userData.user.id

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(
          'id, display_name, full_name, avatar_url, is_verified_student, is_pre_student, university_id',
        )
        .eq('id', userId)
        .maybeSingle()

      if (!isMounted) return

      if (profileError || !profileData) {
        const details = profileError?.message ? ` (${profileError.message})` : ''
        setErrorMessage({
          en: `Unable to load profile.${details}`,
          el: `Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`,
        })
        setIsLoading(false)
        return
      }

      const typedProfile = profileData as ProfileSummary
      setProfile(typedProfile)
      let resolvedUniversityName = ''

      if (typedProfile.university_id) {
        const { data: university } = await supabase
          .from('universities')
          .select('name')
          .eq('id', typedProfile.university_id)
          .maybeSingle()
        if (isMounted && university?.name) {
          resolvedUniversityName = university.name
          setUniversityName(university.name)
        }
      }

      const [
        sellRowsResponse,
        wantRowsResponse,
        sellCountResponse,
        wantCountResponse,
        mySellCountResponse,
        myWantCountResponse,
      ] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, description, price, condition, category, created_at, seller_id')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('wanted_listings')
          .select('id, title, description, category, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase.from('listings').select('id', { count: 'exact', head: true }),
        supabase.from('wanted_listings').select('id', { count: 'exact', head: true }),
        supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', userId),
        supabase
          .from('wanted_listings')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ])

      if (!isMounted) return

      setSellCount(sellCountResponse.count ?? 0)
      setWantCount(wantCountResponse.count ?? 0)
      setMySellCount(mySellCountResponse.count ?? 0)
      setMyWantCount(myWantCountResponse.count ?? 0)

      const sellRows = (sellRowsResponse.data ?? []) as ListingRow[]
      const wantRows = (wantRowsResponse.data ?? []) as WantedRow[]

      const mappedSell: UnifiedMarketplaceItem[] = sellRows.map((row) => ({
        id: row.id,
        ownerId: row.seller_id,
        type: 'sell',
        title: row.title,
        description: row.description,
        category: row.category,
        condition: row.condition,
        price: row.price,
        universityName: resolvedUniversityName,
        sellerName: typedProfile.display_name || typedProfile.full_name || t({ en: 'Student', el: 'Φοιτητής' }),
        sellerLevel: 6,
        sellerVerified: Boolean(typedProfile.is_verified_student),
        createdAt: row.created_at,
      }))

      const mappedWant: UnifiedMarketplaceItem[] = wantRows.map((row) => ({
        id: row.id,
        ownerId: row.user_id,
        type: 'want',
        title: row.title,
        description: row.description,
        category: row.category,
        condition: t({ en: 'Requested', el: 'Ζητείται' }),
        price: null,
        universityName: resolvedUniversityName,
        sellerName: typedProfile.display_name || typedProfile.full_name || t({ en: 'Student', el: 'Φοιτητής' }),
        sellerLevel: 4,
        sellerVerified: Boolean(typedProfile.is_verified_student),
        createdAt: row.created_at,
      }))

      const merged = [...mappedSell, ...mappedWant]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 4)

      setPreviewItems(merged)
      setIsLoading(false)
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [t])

  const isVerified = Boolean(profile?.is_verified_student)
  const isPreStudent = Boolean(profile?.is_pre_student) && !isVerified
  const displayName =
    profile?.display_name || profile?.full_name || t({ en: 'Student', el: 'Φοιτητής' })

  const totalXp = useMemo(() => {
    const base = 280 + mySellCount * 55 + myWantCount * 35
    return isVerified ? base + 220 : base
  }, [isVerified, mySellCount, myWantCount])

  const unlockedBadgeIds = useMemo(() => {
    if (!isVerified) return []
    const badges = ['verified-student']
    if (mySellCount >= 1) badges.push('trusted-seller')
    if (mySellCount >= 5) badges.push('ten-trades')
    if (myWantCount >= 1) badges.push('helpful-member')
    if (mySellCount + myWantCount >= 3) badges.push('active-this-month')
    return badges
  }, [isVerified, mySellCount, myWantCount])

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">{t({ en: 'Loading dashboard...', el: 'Φόρτωση πίνακα...' })}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({ en: 'Preparing your student workspace.', el: 'Ετοιμάζουμε τον χώρο σου.' })}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {(universityName || t({ en: 'University', el: 'Πανεπιστήμιο' }))} •{' '}
              {t({ en: 'Student Utility Workspace', el: 'Χώρος Εργαλείων Φοιτητή' })}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              isVerified
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-100'
            }`}
          >
            {isVerified
              ? t({ en: 'Verified Student', el: 'Επαληθευμένος φοιτητής' })
              : t({ en: 'Pre-student', el: 'Pre-student' })}
          </span>
        </div>
      </header>

      {errorMessage ? (
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {t(errorMessage)}
        </p>
      ) : null}

      <SectionCard
        title={t({ en: 'Marketplace Overview', el: 'Επισκόπηση Marketplace' })}
        subtitle={t({
          en: 'Unified marketplace activity across selling and searching.',
          el: 'Ενοποιημένη δραστηριότητα για πώληση και αναζήτηση.',
        })}
        action={
          <Link
            to="/marketplace"
            className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {t({ en: 'Open Marketplace', el: 'Άνοιγμα Marketplace' })}
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">
              {t({ en: 'For Sale', el: 'Προς Πώληση' })}
            </p>
            <p className="mt-1 text-xl font-semibold">{sellCount}</p>
          </article>
          <article className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">
              {t({ en: 'Looking For', el: 'Αναζήτηση' })}
            </p>
            <p className="mt-1 text-xl font-semibold">{wantCount}</p>
          </article>
          <article className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">
              {t({ en: 'My Listings', el: 'Οι αγγελίες μου' })}
            </p>
            <p className="mt-1 text-xl font-semibold">{mySellCount + myWantCount}</p>
          </article>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {previewItems.length > 0 ? (
            previewItems.map((item) => <MarketplaceCard key={`${item.type}-${item.id}`} item={item} />)
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              {t({ en: 'No marketplace activity yet.', el: 'Δεν υπάρχει δραστηριότητα ακόμα.' })}
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title={t({ en: 'Activity Summary', el: 'Σύνοψη Δραστηριότητας' })}
        subtitle={t({ en: 'XP progress and badge momentum.', el: 'Πρόοδος XP και σήματα.' })}
      >
        <div className="space-y-4">
          <div className={isPreStudent ? 'relative' : ''}>
            <div className={isPreStudent ? 'opacity-55 blur-[1px]' : ''}>
              <LevelCard
                name={displayName}
                avatarUrl={profile?.avatar_url}
                totalXp={totalXp}
              />
            </div>
            {isPreStudent ? (
              <p className="absolute inset-0 grid place-items-center text-center text-xs font-semibold text-amber-100">
                {t({
                  en: 'Verify your university email to unlock full features.',
                  el: 'Επαλήθευσε το πανεπιστημιακό email για πλήρη πρόσβαση.',
                })}
              </p>
            ) : null}
          </div>
          <BadgeGrid
            unlockedBadgeIds={unlockedBadgeIds}
            lockedReason={t({
              en: 'Verify your university email to unlock full features.',
              el: 'Επαλήθευσε το πανεπιστημιακό email για πλήρη πρόσβαση.',
            })}
          />
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title={t({ en: 'University Announcements', el: 'Ανακοινώσεις Πανεπιστημίου' })}
          subtitle={t({
            en: 'Static placeholder area for institutional updates.',
            el: 'Ενδεικτικός χώρος για ενημερώσεις ιδρύματος.',
          })}
        >
          <ul className="space-y-2">
            {announcements.map((announcement) => (
              <li
                key={announcement}
                className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-secondary)]"
              >
                {announcement}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title={t({ en: 'Quick Actions', el: 'Γρήγορες Ενέργειες' })}
          subtitle={t({ en: 'Move fast across key workflows.', el: 'Μετακινήσου γρήγορα στις βασικές ροές.' })}
        >
          <div className="grid gap-2">
            <Link
              to="/marketplace?create=sell"
              className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2 text-center text-sm font-semibold text-slate-950"
            >
              {t({ en: 'List Item', el: 'Πώληση Αντικειμένου' })}
            </Link>
            <Link
              to="/marketplace?create=want"
              className="rounded-xl border border-[var(--border-primary)] px-4 py-2 text-center text-sm font-semibold text-[var(--text-primary)]"
            >
              {t({ en: 'Request Item', el: 'Αναζήτηση Αντικειμένου' })}
            </Link>
            <Link
              to="/marketplace?mine=1"
              className="rounded-xl border border-[var(--border-primary)] px-4 py-2 text-center text-sm font-semibold text-[var(--text-primary)]"
            >
              {t({ en: 'View My Listings', el: 'Οι αγγελίες μου' })}
            </Link>
          </div>
        </SectionCard>
      </div>
    </section>
  )
}
