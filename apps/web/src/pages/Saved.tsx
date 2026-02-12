import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

type SavedItemType = 'listing' | 'wanted' | 'event'

type SavedRow = {
  id: string
  user_id: string
  item_type: SavedItemType
  item_id: string
  created_at: string
}

type ListingRow = {
  id: string
  title: string
  price: string | null
  created_at: string
}

type WantedRow = {
  id: string
  title: string
  created_at: string
}

type SavedView = {
  key: string
  itemType: SavedItemType
  itemId: string
  title: string
  subtitle: string
  href: string | null
  createdAt: string
}

type Filter = 'all' | 'listing' | 'wanted' | 'event'

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

const localStorageKey = (userId: string, itemType: SavedItemType, itemId: string) =>
  `saved:${userId}:${itemType}:${itemId}`

export default function Saved() {
  const { t, formatDate } = useI18n()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [savedItems, setSavedItems] = useState<SavedView[]>([])
  const [isFallbackMode, setIsFallbackMode] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const loadSaved = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      const details = authError?.message ? ` (${authError.message})` : ''
      setErrorMessage(t({ en: `Unable to load saved items${details}.`, el: `Αδυναμια φορτωσης αποθηκευμενων${details}.` }))
      setIsLoading(false)
      return
    }

    const userId = authData.user.id
    setCurrentUserId(userId)

    const savedRes = await supabase
      .from('saved_items')
      .select('id, user_id, item_type, item_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    let rows: SavedRow[] = []
    let fallbackMode = false

    if (savedRes.error && hasMissingSchemaError(savedRes.error, 'saved_items')) {
      fallbackMode = true
      const localRows: SavedRow[] = []
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i)
        if (!key) continue
        const parts = key.split(':')
        if (parts.length !== 4) continue
        if (parts[0] !== 'saved') continue
        if (parts[1] !== userId) continue
        const itemType = parts[2] as SavedItemType
        const itemId = parts[3]
        if (!['listing', 'wanted', 'event'].includes(itemType)) continue
        if (window.localStorage.getItem(key) !== '1') continue
        localRows.push({
          id: key,
          user_id: userId,
          item_type: itemType,
          item_id: itemId,
          created_at: new Date().toISOString(),
        })
      }
      rows = localRows
    } else if (savedRes.error) {
      const details = savedRes.error.message ? ` (${savedRes.error.message})` : ''
      setErrorMessage(t({ en: `Unable to load saved items${details}.`, el: `Αδυναμια φορτωσης αποθηκευμενων${details}.` }))
      setIsLoading(false)
      return
    } else {
      rows = (savedRes.data ?? []) as SavedRow[]
    }

    setIsFallbackMode(fallbackMode)

    const listingIds = rows.filter((row) => row.item_type === 'listing').map((row) => row.item_id)
    const wantedIds = rows.filter((row) => row.item_type === 'wanted').map((row) => row.item_id)

    const [listingRes, wantedRes] = await Promise.all([
      listingIds.length > 0
        ? supabase.from('listings').select('id, title, price, created_at').in('id', listingIds)
        : Promise.resolve({ data: [] as ListingRow[], error: null }),
      wantedIds.length > 0
        ? supabase.from('wanted_listings').select('id, title, created_at').in('id', wantedIds)
        : Promise.resolve({ data: [] as WantedRow[], error: null }),
    ])

    const listingMap = new Map(((listingRes.data ?? []) as ListingRow[]).map((item) => [item.id, item]))
    const wantedMap = new Map(((wantedRes.data ?? []) as WantedRow[]).map((item) => [item.id, item]))

    const nextSaved: SavedView[] = rows
      .map((row) => {
        if (row.item_type === 'listing') {
          const listing = listingMap.get(row.item_id)
          return {
            key: `${row.item_type}:${row.item_id}`,
            itemType: row.item_type,
            itemId: row.item_id,
            title: listing?.title ?? t({ en: 'Listing', el: 'Αγγελια' }),
            subtitle: listing?.price ?? t({ en: 'Saved listing', el: 'Αποθηκευμενη αγγελια' }),
            href: listing ? `/marketplace/${listing.id}` : null,
            createdAt: row.created_at,
          }
        }

        if (row.item_type === 'wanted') {
          const wanted = wantedMap.get(row.item_id)
          return {
            key: `${row.item_type}:${row.item_id}`,
            itemType: row.item_type,
            itemId: row.item_id,
            title: wanted?.title ?? t({ en: 'Request', el: 'Ζητηση' }),
            subtitle: t({ en: 'Saved request', el: 'Αποθηκευμενη ζητηση' }),
            href: wanted ? `/wanted/${wanted.id}` : null,
            createdAt: row.created_at,
          }
        }

        return {
          key: `${row.item_type}:${row.item_id}`,
          itemType: row.item_type,
          itemId: row.item_id,
          title: t({ en: 'Event (coming soon)', el: 'Εκδηλωση (συντομα)' }),
          subtitle: t({ en: 'Saved event placeholder', el: 'Θεση αποθηκευμενης εκδηλωσης' }),
          href: null,
          createdAt: row.created_at,
        }
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

    setSavedItems(nextSaved)
    setIsLoading(false)
  }, [t])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadSaved()
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [loadSaved])

  const visibleItems = useMemo(() => {
    if (filter === 'all') return savedItems
    return savedItems.filter((item) => item.itemType === filter)
  }, [filter, savedItems])

  const handleRemove = async (item: SavedView) => {
    if (!currentUserId) return

    if (isFallbackMode) {
      window.localStorage.removeItem(localStorageKey(currentUserId, item.itemType, item.itemId))
      setSavedItems((previous) => previous.filter((entry) => entry.key !== item.key))
      return
    }

    const deleteRes = await supabase
      .from('saved_items')
      .delete()
      .eq('user_id', currentUserId)
      .eq('item_type', item.itemType)
      .eq('item_id', item.itemId)

    if (!deleteRes.error) {
      setSavedItems((previous) => previous.filter((entry) => entry.key !== item.key))
    }
  }

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Saved', el: 'Αποθηκευμενα' })}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({ en: 'Loading saved items...', el: 'Φορτωση αποθηκευμενων...' })}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="social-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              {t({ en: 'Saved', el: 'Αποθηκευμενα' })}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t({
                en: 'Your saved listings, requests, and future event bookmarks.',
                el: 'Οι αποθηκευμενες αγγελιες, ζητησεις και μελλοντικα saved events.',
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'listing', 'wanted', 'event'] as Filter[]).map((nextFilter) => (
              <button
                key={nextFilter}
                type="button"
                onClick={() => setFilter(nextFilter)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  filter === nextFilter
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                    : 'border border-[var(--border-primary)] text-[var(--text-secondary)]'
                }`}
              >
                {nextFilter === 'all' ? t({ en: 'All', el: 'Ολα' }) : nextFilter}
              </button>
            ))}
          </div>
        </div>
        {isFallbackMode ? (
          <p className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {t({
              en: 'Fallback mode active: saved items are local until DB migrations run.',
              el: 'Fallback mode ενεργο: τα saved ειναι τοπικα μεχρι να τρεξουν τα migrations.',
            })}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="mt-3 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {errorMessage}
          </p>
        ) : null}
      </header>

      {visibleItems.length === 0 ? (
        <section className="social-card p-5 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t({ en: 'No saved items yet.', el: 'Δεν υπαρχουν αποθηκευμενα ακομα.' })}
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => (
            <article key={item.key} className="social-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-[var(--text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.subtitle}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.href ? (
                    <Link
                      to={item.href}
                      className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                    >
                      {t({ en: 'Open', el: 'Ανοιγμα' })}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    className="rounded-full border border-rose-300/40 px-3 py-1 text-xs font-semibold text-rose-200"
                  >
                    {t({ en: 'Remove', el: 'Αφαιρεση' })}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
