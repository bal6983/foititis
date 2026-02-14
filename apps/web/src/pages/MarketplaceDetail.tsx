import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toEuro } from '../lib/imageUpload'
import { supabase } from '../lib/supabaseClient'

type ListingRow = {
  id: string
  title: string
  price: string
  condition: string
  condition_rating: number | null
  location: string
  location_id: string | null
  locations: { id: string; name: string } | { id: string; name: string }[] | null
  category: string
  category_id: string | null
  categories: { id: string; name: string } | { id: string; name: string }[] | null
  description: string
  created_at: string
  seller_id: string
  view_count: number | null
  image_url: string | null
  image_urls: string[] | null
  profiles: { display_name: string | null } | { display_name: string | null }[] | null
}

type ListingViewModel = {
  id: string
  title: string
  price: string
  condition: string
  conditionRating: number | null
  locationName: string | null
  categoryName: string | null
  description: string
  createdAt: string
  sellerId: string
  sellerName: string
  viewCount: number
  imageUrls: string[]
}

type PostgrestErrorLike = {
  message?: string | null
  details?: string | null
  hint?: string | null
  code?: string | null
}

const firstOrSelf = <T,>(value: T | T[] | null): T | null => {
  if (Array.isArray(value)) return value[0] ?? null
  return value
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

const conditionLabels: Record<number, string> = {
  1: 'Πολύ κακή',
  2: 'Κακή',
  3: 'Μέτρια',
  4: 'Καλή',
  5: 'Πολύ καλή',
}

const getConditionLabel = (value?: number | null) =>
  typeof value === 'number' ? conditionLabels[value] ?? '' : ''

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('el-GR')
}

const getConversationIdFromRpc = (data: unknown) => {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) {
    return (data[0] as { conversation_id?: string } | undefined)?.conversation_id ?? ''
  }
  if (data && typeof data === 'object' && 'conversation_id' in data) {
    return (data as { conversation_id?: string }).conversation_id ?? ''
  }
  return ''
}

export default function MarketplaceDetail() {
  const { listingId } = useParams()
  const navigate = useNavigate()

  const [listing, setListing] = useState<ListingViewModel | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedUsesFallback, setSavedUsesFallback] = useState(false)
  const [isContactLoading, setIsContactLoading] = useState(false)
  const [contactError, setContactError] = useState('')
  const [loadErrorMessage, setLoadErrorMessage] = useState('')
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadListing = async () => {
      if (!listingId) {
        setLoadErrorMessage('Η αγγελία που ζήτησες δεν βρέθηκε.')
        setIsLoading(false)
        return
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (!isMounted) return
      setCurrentUserId(userError || !userData.user ? null : userData.user.id)

      let listingRes = await supabase
        .from('listings')
        .select(
          'id, title, price, condition, condition_rating, location, location_id, locations ( id, name ), category, category_id, categories ( id, name ), description, created_at, seller_id, view_count, image_url, image_urls, profiles(display_name)',
        )
        .eq('id', listingId)
        .single()

      if (
        listingRes.error &&
        (hasMissingSchemaError(listingRes.error, 'view_count') ||
          hasMissingSchemaError(listingRes.error, 'image_urls'))
      ) {
        listingRes = await supabase
          .from('listings')
          .select(
            'id, title, price, condition, condition_rating, location, location_id, locations ( id, name ), category, category_id, categories ( id, name ), description, created_at, seller_id, image_url, profiles(display_name)',
          )
          .eq('id', listingId)
          .single()
      }

      if (!isMounted) return

      if (listingRes.error || !listingRes.data) {
        const details = listingRes.error?.message ? ` (${listingRes.error.message})` : ''
        setLoadErrorMessage(`Η αγγελία που ζήτησες δεν βρέθηκε.${details}`)
        setIsLoading(false)
        return
      }

      const raw = listingRes.data as ListingRow
      const location = firstOrSelf(raw.locations)
      const category = firstOrSelf(raw.categories)
      const profile = firstOrSelf(raw.profiles)
      const imageUrls = Array.from(
        new Set(
          [raw.image_url ?? '', ...(Array.isArray(raw.image_urls) ? raw.image_urls : [])].filter(
            (item) => item.trim() !== '',
          ),
        ),
      )

      const viewModel: ListingViewModel = {
        id: raw.id,
        title: raw.title,
        price: raw.price,
        condition: raw.condition,
        conditionRating: raw.condition_rating,
        locationName: location?.name ?? null,
        categoryName: category?.name ?? raw.category ?? null,
        description: raw.description,
        createdAt: raw.created_at,
        sellerId: raw.seller_id,
        sellerName: profile?.display_name ?? '—',
        viewCount: raw.view_count ?? 0,
        imageUrls,
      }

      setListing(viewModel)
      setActiveImageUrl(imageUrls[0] ?? null)

      if (userData.user && userData.user.id !== viewModel.sellerId) {
        const viewInsertRes = await supabase.from('listing_views').insert({
          listing_id: viewModel.id,
          viewer_id: userData.user.id,
        })
        if (
          viewInsertRes.error &&
          viewInsertRes.error.code !== '23505' &&
          !hasMissingSchemaError(viewInsertRes.error, 'listing_views')
        ) {
          console.error('Listing view tracking error:', viewInsertRes.error)
        }
      }

      if (userData.user) {
        const userId = userData.user.id
        const savedRes = await supabase
          .from('saved_items')
          .select('id')
          .eq('user_id', userId)
          .eq('item_type', 'listing')
          .eq('item_id', viewModel.id)
          .maybeSingle()

        if (savedRes.error && hasMissingSchemaError(savedRes.error, 'saved_items')) {
          setSavedUsesFallback(true)
          setIsSaved(window.localStorage.getItem(`saved:${userId}:listing:${viewModel.id}`) === '1')
        } else if (!savedRes.error) {
          setSavedUsesFallback(false)
          setIsSaved(Boolean(savedRes.data))
        }
      }

      setIsLoading(false)
    }

    void loadListing()
    return () => {
      isMounted = false
    }
  }, [listingId])

  const isSeller = currentUserId === listing?.sellerId
  const displayCondition = useMemo(() => {
    if (!listing) return ''
    return listing.condition || getConditionLabel(listing.conditionRating)
  }, [listing])

  const handleDelete = async () => {
    if (!listing || !isSeller || isDeleting) return
    const shouldDelete = window.confirm('Είσαι σίγουρος ότι θέλεις να διαγράψεις την αγγελία;')
    if (!shouldDelete) return

    setIsDeleting(true)
    const { error } = await supabase.from('listings').delete().eq('id', listing.id)
    if (error) {
      const details = error.message ? ` (${error.message})` : ''
      window.alert(`Δεν ήταν δυνατή η διαγραφή αγγελίας.${details}`)
      setIsDeleting(false)
      return
    }
    navigate('/marketplace')
  }

  const handleToggleSave = async () => {
    if (!currentUserId || !listing || isSaving) return

    setIsSaving(true)
    setSaveError('')
    const nextSaved = !isSaved
    const localKey = `saved:${currentUserId}:listing:${listing.id}`

    if (savedUsesFallback) {
      if (nextSaved) window.localStorage.setItem(localKey, '1')
      else window.localStorage.removeItem(localKey)
      setIsSaved(nextSaved)
      setIsSaving(false)
      return
    }

    if (nextSaved) {
      const insertRes = await supabase.from('saved_items').insert({
        user_id: currentUserId,
        item_type: 'listing',
        item_id: listing.id,
      })
      if (insertRes.error) {
        if (hasMissingSchemaError(insertRes.error, 'saved_items')) {
          setSavedUsesFallback(true)
          window.localStorage.setItem(localKey, '1')
          setIsSaved(true)
        } else {
          setSaveError('Δεν ήταν δυνατή η αποθήκευση.')
        }
      } else {
        setIsSaved(true)
      }
      setIsSaving(false)
      return
    }

    const deleteRes = await supabase
      .from('saved_items')
      .delete()
      .eq('user_id', currentUserId)
      .eq('item_type', 'listing')
      .eq('item_id', listing.id)

    if (deleteRes.error) {
      if (hasMissingSchemaError(deleteRes.error, 'saved_items')) {
        setSavedUsesFallback(true)
        window.localStorage.removeItem(localKey)
        setIsSaved(false)
      } else {
        setSaveError('Δεν ήταν δυνατή η αφαίρεση από αποθηκευμένα.')
      }
      setIsSaving(false)
      return
    }

    setIsSaved(false)
    setIsSaving(false)
  }

  const handleContactSeller = async () => {
    if (!listing) return
    if (!currentUserId) {
      setContactError('Χρειάζεται σύνδεση για επικοινωνία με πωλητή.')
      navigate('/login')
      return
    }
    if (currentUserId === listing.sellerId) {
      setContactError('Είσαι ο πωλητής της αγγελίας.')
      return
    }

    setIsContactLoading(true)
    setContactError('')

    let conversationId = ''
    const primaryRpc = await supabase.rpc('get_or_create_conversation', {
      user_a: currentUserId,
      user_b: listing.sellerId,
    })

    if (primaryRpc.error) {
      const fallbackRpc = await supabase.rpc('start_conversation', {
        other_user_id: listing.sellerId,
      })
      if (fallbackRpc.error) {
        setContactError('Αδυναμία ανοίγματος συνομιλίας με πωλητή.')
        setIsContactLoading(false)
        return
      }
      conversationId = getConversationIdFromRpc(fallbackRpc.data)
    } else {
      conversationId = getConversationIdFromRpc(primaryRpc.data)
    }

    if (!conversationId) {
      setContactError('Η συνομιλία δεν βρέθηκε.')
      setIsContactLoading(false)
      return
    }

    navigate(`/chats?c=${conversationId}`)
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Αγγελία</h1>
        <p className="text-sm text-[var(--text-secondary)]">Φόρτωση αγγελίας...</p>
      </section>
    )
  }

  if (!listing || loadErrorMessage) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Αγγελία</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {loadErrorMessage || 'Η αγγελία που ζήτησες δεν βρέθηκε.'}
        </p>
        <Link className="text-sm font-semibold text-[var(--text-primary)]" to="/marketplace">
          Πίσω στις αγγελίες
        </Link>
      </section>
    )
  }

  const displayPrice = listing.price?.trim() ? toEuro(listing.price) : '—'

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <Link className="text-sm font-semibold text-[var(--text-secondary)]" to="/marketplace">
          Πίσω στις αγγελίες
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold text-[var(--text-primary)]">
              {listing.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {[listing.categoryName, displayCondition].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className="text-xl font-bold text-cyan-200">{displayPrice}</span>
        </div>
      </header>

      {listing.imageUrls.length > 0 ? (
        <section className="social-card p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Φωτογραφίες</h2>
          {activeImageUrl ? (
            <img
              src={activeImageUrl}
              alt={listing.title}
              className="mt-3 h-72 w-full rounded-xl object-cover"
            />
          ) : null}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {listing.imageUrls.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setActiveImageUrl(url)}
                className={`overflow-hidden rounded-lg border ${
                  activeImageUrl === url
                    ? 'border-cyan-300/70'
                    : 'border-[var(--border-primary)]'
                }`}
              >
                <img src={url} alt={listing.title} className="h-16 w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="social-card p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-[var(--text-secondary)]">Τοποθεσία</dt>
            <dd className="mt-1 break-words text-[var(--text-primary)]">
              {listing.locationName || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--text-secondary)]">Δημοσιεύτηκε</dt>
            <dd className="mt-1 text-[var(--text-primary)]">{formatDate(listing.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--text-secondary)]">Πωλητής</dt>
            <dd className="mt-1 break-words text-[var(--text-primary)]">{listing.sellerName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--text-secondary)]">Κατηγορία</dt>
            <dd className="mt-1 break-words text-[var(--text-primary)]">
              {listing.categoryName || '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="social-card p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Περιγραφή</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)]">
          {listing.description}
        </p>
      </section>

      <section className="social-card p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ενέργειες αγγελίας</h2>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            type="button"
            onClick={handleContactSeller}
            disabled={!currentUserId || isSeller || isContactLoading}
          >
            {!currentUserId
              ? 'Σύνδεση για επικοινωνία'
              : isSeller
                ? 'Είσαι ο πωλητής'
                : isContactLoading
                  ? 'Άνοιγμα συνομιλίας...'
                  : 'Επικοινωνία με τον πωλητή'}
          </button>

          {!isSeller ? (
            <button
              className="inline-flex items-center rounded-lg border border-[var(--border-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]"
              type="button"
              onClick={handleToggleSave}
              disabled={isSaving}
            >
              {isSaving
                ? 'Αποθήκευση...'
                : isSaved
                  ? 'Αφαιρέθηκε από αποθηκευμένα'
                  : 'Αποθήκευση αγγελίας'}
            </button>
          ) : null}
        </div>

        {contactError ? <p className="mt-3 text-sm text-rose-300">{contactError}</p> : null}
        {saveError ? <p className="mt-2 text-sm text-rose-300">{saveError}</p> : null}
        {savedUsesFallback ? (
          <p className="mt-2 text-xs text-amber-100">
            Το save λειτουργεί προσωρινά τοπικά μέχρι να εφαρμοστούν τα migrations.
          </p>
        ) : null}

        {isSeller ? (
          <>
            <p className="mt-3 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              {`${listing.viewCount} προβολές στην αγγελία`}
            </p>
            <button
              className="mt-3 inline-flex items-center rounded-lg border border-rose-300/40 px-4 py-2 text-sm font-semibold text-rose-300"
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Διαγραφή σε εξέλιξη...' : 'Διαγραφή αγγελίας'}
            </button>
          </>
        ) : null}
      </section>
    </section>
  )
}
