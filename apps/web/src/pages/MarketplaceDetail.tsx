import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type MarketplaceListing = {
  id: string
  title: string
  price: string
  condition: string
  condition_rating: number | null
  location: string
  location_id: string | null
  locations: { id: string; name: string } | null
  category: string
  category_id: string | null
  categories: { id: string; name: string } | null
  description: string
  created_at: string
  seller_id: string
  view_count: number | null
  image_url: string | null
  image_urls: string[]
  profiles: { display_name: string | null } | null
}

type MarketplaceListingQueryResult = Omit<
  MarketplaceListing,
  'locations' | 'categories' | 'profiles' | 'image_url' | 'image_urls'
> & {
  image_url: string | null
  image_urls: string[] | null
  locations: { id: string; name: string }[] | { id: string; name: string } | null
  categories: { id: string; name: string }[] | { id: string; name: string } | null
  profiles: { display_name: string | null }[] | { display_name: string | null } | null
}

type PostgrestErrorLike = {
  message?: string | null
  details?: string | null
  hint?: string | null
  code?: string | null
}

const firstOrSelf = <T,>(value: T[] | T | null): T | null => {
  if (Array.isArray(value)) return value[0] ?? null
  return value
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
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('el-GR')
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

export default function MarketplaceDetail() {
  const { listingId } = useParams()
  const navigate = useNavigate()
  const [listing, setListing] = useState<MarketplaceListing | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isContactLoading, setIsContactLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedUsesFallback, setSavedUsesFallback] = useState(false)
  const [contactError, setContactError] = useState('')
  const [loadErrorMessage, setLoadErrorMessage] = useState('')

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

      if (!userError && userData.user) {
        setCurrentUserId(userData.user.id)
      } else {
        setCurrentUserId(null)
      }

      const listingWithViewRes = await supabase
        .from('listings')
        .select(
          'id, title, price, condition, condition_rating, location, location_id, locations ( id, name ), category, category_id, categories ( id, name ), description, created_at, seller_id, view_count, image_url, image_urls, profiles(display_name)',
        )
        .eq('id', listingId)
        .single()

      let data = listingWithViewRes.data as MarketplaceListingQueryResult | null
      let error = listingWithViewRes.error

      if (
        listingWithViewRes.error &&
        (hasMissingSchemaError(listingWithViewRes.error, 'view_count') ||
          hasMissingSchemaError(listingWithViewRes.error, 'image_urls'))
      ) {
        const listingLegacyRes = await supabase
          .from('listings')
          .select(
            'id, title, price, condition, condition_rating, location, location_id, locations ( id, name ), category, category_id, categories ( id, name ), description, created_at, seller_id, image_url, profiles(display_name)',
          )
          .eq('id', listingId)
          .single()

        if (listingLegacyRes.data) {
          data = {
            ...(listingLegacyRes.data as Omit<MarketplaceListingQueryResult, 'view_count'>),
            view_count: 0,
            image_urls: null,
          } as MarketplaceListingQueryResult
        }
        error = listingLegacyRes.error
      }

      if (!isMounted) return

      if (error || !data) {
        const details = error?.message ? ` (${error.message})` : ''
        setLoadErrorMessage(`Η αγγελία που ζήτησες δεν βρέθηκε.${details}`)
        setIsLoading(false)
        return
      }

      const listingData = data as MarketplaceListingQueryResult
      const normalizedImageUrls = Array.from(
        new Set(
          [
            ...(Array.isArray(listingData.image_urls) ? listingData.image_urls : []),
            listingData.image_url ?? '',
          ].filter((value) => value.trim() !== ''),
        ),
      )
      setListing({
        ...listingData,
        locations: firstOrSelf(listingData.locations),
        categories: firstOrSelf(listingData.categories),
        profiles: firstOrSelf(listingData.profiles),
        image_url: listingData.image_url ?? null,
        image_urls: normalizedImageUrls,
      })

      if (!userError && userData.user && userData.user.id !== listingData.seller_id) {
        const viewInsertRes = await supabase
          .from('listing_views')
          .insert({
            listing_id: listingData.id,
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

      if (!userError && userData.user) {
        const userId = userData.user.id
        const savedRes = await supabase
          .from('saved_items')
          .select('id')
          .eq('user_id', userId)
          .eq('item_type', 'listing')
          .eq('item_id', listingData.id)
          .maybeSingle()

        if (savedRes.error && hasMissingSchemaError(savedRes.error, 'saved_items')) {
          const fallback = window.localStorage.getItem(`saved:${userId}:listing:${listingData.id}`)
          setSavedUsesFallback(true)
          setIsSaved(fallback === '1')
        } else if (!savedRes.error) {
          setSavedUsesFallback(false)
          setIsSaved(Boolean(savedRes.data))
        }
      }

      setIsLoading(false)
    }

    loadListing()

    return () => {
      isMounted = false
    }
  }, [listingId])

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Αγγελία</h1>
        <p className="text-sm text-slate-600">Φόρτωση αγγελίας...</p>
      </section>
    )
  }

  if (loadErrorMessage || !listing) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Αγγελία</h1>
        <p className="text-sm text-slate-600">
          {loadErrorMessage || 'Η αγγελία που ζήτησες δεν βρέθηκε.'}
        </p>
        <Link className="text-sm font-semibold text-slate-900" to="/marketplace">
          Πίσω στις αγγελίες
        </Link>
      </section>
    )
  }

  const sellerName = listing.profiles?.display_name ?? '—'
  const isSeller = currentUserId === listing.seller_id
  const conditionLabel = getConditionLabel(listing.condition_rating)
  const categoryName = listing.categories?.name
  const locationName = listing.locations?.name

  const handleDelete = async () => {
    if (!isSeller || isDeleting) {
      return
    }

    const shouldDelete = window.confirm(
      'Είσαι σίγουρος ότι θέλεις να διαγράψεις την αγγελία;',
    )

    if (!shouldDelete) {
      return
    }

    setIsDeleting(true)

    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listing.id)

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

    if (savedUsesFallback) {
      const key = `saved:${currentUserId}:listing:${listing.id}`
      if (nextSaved) {
        window.localStorage.setItem(key, '1')
      } else {
        window.localStorage.removeItem(key)
      }
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
          window.localStorage.setItem(`saved:${currentUserId}:listing:${listing.id}`, '1')
          setIsSaved(true)
        } else {
          setSaveError('Unable to save listing.')
        }
        setIsSaving(false)
        return
      }
      setIsSaved(true)
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
        window.localStorage.removeItem(`saved:${currentUserId}:listing:${listing.id}`)
        setIsSaved(false)
      } else {
        setSaveError('Unable to remove saved listing.')
      }
      setIsSaving(false)
      return
    }

    setIsSaved(false)
    setIsSaving(false)
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

  const handleContactSeller = async () => {
    if (!currentUserId) {
      setContactError('Χρειάζεται σύνδεση για επικοινωνία με πωλητή.')
      navigate('/login')
      return
    }

    if (currentUserId === listing.seller_id) {
      setContactError('Είσαι ο πωλητής της αγγελίας.')
      return
    }

    setIsContactLoading(true)
    setContactError('')

    let conversationId = ''
    const primaryRpc = await supabase.rpc('get_or_create_conversation', {
      user_a: currentUserId,
      user_b: listing.seller_id,
    })

    if (primaryRpc.error) {
      const fallbackRpc = await supabase.rpc('start_conversation', {
        other_user_id: listing.seller_id,
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

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link className="text-sm font-semibold text-[var(--text-secondary)]" to="/marketplace">
          Πίσω στις αγγελίες
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold break-words text-[var(--text-primary)]">{listing.title}</h1>
            {categoryName ? (
              <p className="text-sm text-[var(--text-secondary)] break-words">
                {categoryName}
                {conditionLabel ? ` \u00B7 ${conditionLabel}` : ''}
              </p>
            ) : null}
          </div>
          <span className="text-lg font-semibold text-[var(--text-primary)]">
            {listing.price}
          </span>
        </div>
      </header>

      {listing.image_urls.length > 0 ? (
        <section className="social-card p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Φωτογραφίες</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {listing.image_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={url}
                  alt={listing.title}
                  className="h-52 w-full rounded-xl object-cover ring-1 ring-[var(--border-primary)]"
                />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <div className="social-card p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {locationName ? (
            <div>
              <dt className="text-xs font-semibold text-[var(--text-secondary)]">Τοποθεσία</dt>
              <dd className="mt-1 text-[var(--text-primary)] break-words">{locationName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-semibold text-[var(--text-secondary)]">
              Δημοσιεύτηκε
            </dt>
            <dd className="mt-1 text-[var(--text-primary)]">
              {formatDate(listing.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-[var(--text-secondary)]">Πωλητής</dt>
            <dd className="mt-1 text-[var(--text-primary)] break-words">{sellerName}</dd>
          </div>
          {categoryName ? (
            <div>
              <dt className="text-xs font-semibold text-[var(--text-secondary)]">Κατηγορία</dt>
              <dd className="mt-1 text-[var(--text-primary)] break-words">{categoryName}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="social-card p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Περιγραφή</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)] break-words whitespace-pre-wrap">{listing.description}</p>
      </div>

      <div className="social-card p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Ενέργειες αγγελίας
        </h2>

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

        {contactError ? (
          <p className="mt-3 text-sm text-rose-300">{contactError}</p>
        ) : null}
        {saveError ? <p className="mt-2 text-sm text-rose-300">{saveError}</p> : null}
        {savedUsesFallback ? (
          <p className="mt-2 text-xs text-amber-100">
            Το save δουλεύει προσωρινά τοπικά μέχρι να εφαρμοστούν τα migrations.
          </p>
        ) : null}

        {isSeller ? (
          <>
            <p className="mt-3 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              {`${listing.view_count ?? 0} προβολές στην αγγελία`}
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
      </div>
    </section>
  )
}
