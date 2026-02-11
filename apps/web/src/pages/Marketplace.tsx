import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CreateItemModal from '../components/marketplace/CreateItemModal'
import FilterTabs, { type ListingFilter } from '../components/marketplace/FilterTabs'
import MarketplaceCard from '../components/marketplace/MarketplaceCard'
import type {
  CreateMarketplaceItemInput,
  UnifiedMarketplaceItem,
} from '../components/marketplace/types'
import SectionCard from '../components/ui/SectionCard'
import { useI18n, type LocalizedMessage } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type ListingRow = {
  id: string
  title: string
  description: string
  price: string
  category: string
  condition: string
  condition_rating: number | null
  created_at: string
  seller_id: string
}

type WantedRow = {
  id: string
  title: string
  description: string
  category: string
  condition_rating: number | null
  created_at: string
  user_id: string
}

type PublicProfileRow = {
  id: string
  display_name: string | null
  university_id: string | null
  is_verified_student: boolean | null
}

type CategoryOption = {
  id: string
  name: string
}

const conditionLabelMapEn: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
}

export default function Marketplace() {
  const { t } = useI18n()
  const conditionLabelMap: Record<number, string> = {
    1: t({ en: 'Poor', el: 'Πολύ κακή' }),
    2: t({ en: 'Fair', el: 'Κακή' }),
    3: t({ en: 'Good', el: 'Μέτρια' }),
    4: t({ en: 'Very Good', el: 'Καλή' }),
    5: t({ en: 'Excellent', el: 'Πολύ καλή' }),
  }

  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<UnifiedMarketplaceItem[]>([])
  const [filter, setFilter] = useState<ListingFilter>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<LocalizedMessage | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUniversityName, setCurrentUniversityName] = useState('University')
  const [canCreate, setCanCreate] = useState(true)
  const [createType, setCreateType] = useState<'sell' | 'want'>('sell')

  const viewParam = searchParams.get('view')
  const createParam = searchParams.get('create')
  const isMineFilter =
    searchParams.get('mine') === '1' || searchParams.get('mine') === 'true'

  const loadMarketplace = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      const details = userError?.message ? ` (${userError.message})` : ''
      setErrorMessage({
        en: `Unable to load marketplace.${details}`,
        el: `Δεν ήταν δυνατή η φόρτωση του marketplace.${details}`,
      })
      setIsLoading(false)
      return
    }

    const userId = userData.user.id
    setCurrentUserId(userId)

    const [profileResponse, categoriesResponse] = await Promise.all([
      supabase
        .from('profiles')
        .select('university_id, is_pre_student, is_verified_student')
        .eq('id', userId)
        .maybeSingle(),
      supabase.from('categories').select('id, name').order('name', { ascending: true }),
    ])

    const profileData = profileResponse.data
    const isVerified = Boolean(profileData?.is_verified_student)
    const isPreStudent = Boolean(profileData?.is_pre_student) && !isVerified
    setCanCreate(!isPreStudent)

    if (categoriesResponse.data) {
      setCategories(categoriesResponse.data as CategoryOption[])
    }

    if (profileData?.university_id) {
      const { data: universityData } = await supabase
        .from('universities')
        .select('name')
        .eq('id', profileData.university_id)
        .maybeSingle()
      if (universityData?.name) {
        setCurrentUniversityName(universityData.name)
      }
    }

    const [sellResponse, wantResponse] = await Promise.all([
      supabase
        .from('listings')
        .select(
          'id, title, description, price, category, condition, condition_rating, created_at, seller_id',
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('wanted_listings')
        .select('id, title, description, category, condition_rating, created_at, user_id')
        .order('created_at', { ascending: false }),
    ])

    if (sellResponse.error || wantResponse.error) {
      const details = sellResponse.error?.message || wantResponse.error?.message
      setErrorMessage({
        en: `Unable to load marketplace items.${details ? ` (${details})` : ''}`,
        el: `Δεν ήταν δυνατή η φόρτωση αγγελιών.${details ? ` (${details})` : ''}`,
      })
      setIsLoading(false)
      return
    }

    const sellRows = (sellResponse.data ?? []) as ListingRow[]
    const wantRows = (wantResponse.data ?? []) as WantedRow[]

    const ownerIds = Array.from(
      new Set([
        ...sellRows.map((item) => item.seller_id),
        ...wantRows.map((item) => item.user_id),
      ]),
    )

    let profileMap = new Map<string, PublicProfileRow>()
    let universityMap = new Map<string, string>()

    if (ownerIds.length > 0) {
      const { data: publicProfiles } = await supabase
        .from('public_profiles')
        .select('id, display_name, university_id, is_verified_student')
        .in('id', ownerIds)

      const typedProfiles = (publicProfiles ?? []) as PublicProfileRow[]
      profileMap = new Map(typedProfiles.map((item) => [item.id, item]))

      const universityIds = Array.from(
        new Set(typedProfiles.map((item) => item.university_id).filter(Boolean)),
      ) as string[]

      if (universityIds.length > 0) {
        const { data: universities } = await supabase
          .from('universities')
          .select('id, name')
          .in('id', universityIds)
        universityMap = new Map((universities ?? []).map((item) => [item.id, item.name]))
      }
    }

    const mapLevel = (ownerId: string) => 1 + (ownerId.length % 12)

    const merged: UnifiedMarketplaceItem[] = [
      ...sellRows.map((row) => {
        const owner = profileMap.get(row.seller_id)
        const level = mapLevel(row.seller_id)
        return {
          id: row.id,
          ownerId: row.seller_id,
          type: 'sell' as const,
          title: row.title,
          description: row.description,
          category: row.category,
          condition:
            row.condition ||
            (row.condition_rating ? conditionLabelMap[row.condition_rating] : ''),
          price: row.price,
          universityName: owner?.university_id
            ? universityMap.get(owner.university_id) ?? t({ en: 'University', el: 'Πανεπιστήμιο' })
            : t({ en: 'University', el: 'Πανεπιστήμιο' }),
          sellerName: owner?.display_name || t({ en: 'Student', el: 'Φοιτητής' }),
          sellerLevel: level,
          sellerVerified: Boolean(owner?.is_verified_student),
          createdAt: row.created_at,
        }
      }),
      ...wantRows.map((row) => {
        const owner = profileMap.get(row.user_id)
        const level = mapLevel(row.user_id)
        return {
          id: row.id,
          ownerId: row.user_id,
          type: 'want' as const,
          title: row.title,
          description: row.description,
          category: row.category,
          condition: row.condition_rating
            ? conditionLabelMap[row.condition_rating]
            : t({ en: 'Requested', el: 'Ζητείται' }),
          price: null,
          universityName: owner?.university_id
            ? universityMap.get(owner.university_id) ?? t({ en: 'University', el: 'Πανεπιστήμιο' })
            : t({ en: 'University', el: 'Πανεπιστήμιο' }),
          sellerName: owner?.display_name || t({ en: 'Student', el: 'Φοιτητής' }),
          sellerLevel: level,
          sellerVerified: Boolean(owner?.is_verified_student),
          createdAt: row.created_at,
        }
      }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    setItems(merged)
    setIsLoading(false)
  }

  useEffect(() => {
    loadMarketplace()
  }, [t])

  useEffect(() => {
    if (viewParam === 'sell' || viewParam === 'want') {
      setFilter(viewParam)
      return
    }
    setFilter('all')
  }, [viewParam])

  useEffect(() => {
    if (createParam !== 'sell' && createParam !== 'want') {
      return
    }

    setCreateType(createParam)
    setIsCreateOpen(true)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('create')
    setSearchParams(nextParams, { replace: true })
  }, [createParam, searchParams, setSearchParams])

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return items.filter((item) => {
      if (isMineFilter && currentUserId && item.ownerId !== currentUserId) return false
      if (filter !== 'all' && item.type !== filter) return false
      if (!normalized) return true
      return (
        item.title.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized) ||
        item.universityName.toLowerCase().includes(normalized)
      )
    })
  }, [currentUserId, filter, isMineFilter, items, search])

  const handleCreate = async (payload: CreateMarketplaceItemInput) => {
    if (!currentUserId) return
    setIsSubmitting(true)

    const categoryName =
      categories.find((category) => category.id === payload.categoryId)?.name ?? 'General'
    const conditionText = payload.conditionRating
      ? conditionLabelMapEn[payload.conditionRating]
      : 'Good'

    if (payload.type === 'sell') {
      const { error } = await supabase.from('listings').insert({
        seller_id: currentUserId,
        title: payload.title,
        description: payload.description,
        category: categoryName,
        category_id: payload.categoryId,
        condition: conditionText,
        condition_rating: payload.conditionRating,
        price: payload.price ?? 'Contact for price',
        location: payload.universityName || currentUniversityName,
      })
      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage({
          en: `Unable to create listing.${details}`,
          el: `Δεν ήταν δυνατή η δημιουργία αγγελίας.${details}`,
        })
        setIsSubmitting(false)
        return
      }
    } else {
      const { error } = await supabase.from('wanted_listings').insert({
        user_id: currentUserId,
        title: payload.title,
        description: payload.description,
        category: categoryName,
        category_id: payload.categoryId,
        condition_rating: payload.conditionRating,
        location: payload.universityName || currentUniversityName,
      })
      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage({
          en: `Unable to create request.${details}`,
          el: `Δεν ήταν δυνατή η δημιουργία ζήτησης.${details}`,
        })
        setIsSubmitting(false)
        return
      }
    }

    setIsSubmitting(false)
    setIsCreateOpen(false)
    await loadMarketplace()
  }

  return (
    <section className="space-y-4">
      <SectionCard
        title={t({ en: 'Unified Marketplace', el: 'Ενοποιημένο Marketplace' })}
        subtitle={t({
          en: 'Sell and search in one trust-based student system.',
          el: 'Πώληση και αναζήτηση σε ένα ενιαίο σύστημα εμπιστοσύνης.',
        })}
        action={
          <button
            type="button"
            onClick={() => {
              setCreateType(filter === 'want' ? 'want' : 'sell')
              setIsCreateOpen(true)
            }}
            disabled={!canCreate}
            className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            {t({ en: 'Create Item', el: 'Δημιουργία' })}
          </button>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterTabs
              value={filter}
              onChange={(nextFilter) => {
                setFilter(nextFilter)
                const nextParams = new URLSearchParams(searchParams)
                if (nextFilter === 'all') nextParams.delete('view')
                if (nextFilter === 'sell') nextParams.set('view', 'sell')
                if (nextFilter === 'want') nextParams.set('view', 'want')
                setSearchParams(nextParams, { replace: true })
              }}
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSearch(searchInput.trim())
                }
              }}
              placeholder={t({ en: 'Search items', el: 'Αναζήτηση' })}
              className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-4 py-1.5 text-xs text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={() => setSearch(searchInput.trim())}
              className="rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
            >
              {t({ en: 'Search', el: 'Αναζήτηση' })}
            </button>
          </div>

          {!canCreate ? (
            <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {t({
                en: 'Verify your university email to unlock full marketplace publishing.',
                el: 'Επαλήθευσε το πανεπιστημιακό email για πλήρη πρόσβαση.',
              })}
            </p>
          ) : null}
        </div>
      </SectionCard>

      {isLoading ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {t({ en: 'Loading marketplace...', el: 'Φόρτωση marketplace...' })}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {t(errorMessage)}
        </p>
      ) : null}

      {!isLoading && !errorMessage ? (
        filteredItems.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredItems.map((item) => (
              <MarketplaceCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <section className="glass-card p-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {t({ en: 'No items match your current filters.', el: 'Δεν υπάρχουν αγγελίες με αυτά τα φίλτρα.' })}
            </p>
          </section>
        )
      ) : null}

      <CreateItemModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        categories={categories}
        universityName={currentUniversityName}
        isSubmitting={isSubmitting}
        initialType={createType}
      />
    </section>
  )
}
