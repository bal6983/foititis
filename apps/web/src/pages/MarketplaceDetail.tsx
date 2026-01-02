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
  profiles: { display_name: string | null } | null
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

export default function MarketplaceDetail() {
  const { listingId } = useParams()
  const navigate = useNavigate()
  const [listing, setListing] = useState<MarketplaceListing | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
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

      const { data, error } = await supabase
        .from('listings')
        .select(
          'id, title, price, condition, condition_rating, location, location_id, locations ( id, name ), category, category_id, categories ( id, name ), description, created_at, seller_id, profiles(display_name)',
        )
        .eq('id', listingId)
        .single()

      if (!isMounted) return

      if (error || !data) {
        const details = error?.message ? ` (${error.message})` : ''
        setLoadErrorMessage(`Η αγγελία που ζήτησες δεν βρέθηκε.${details}`)
        setIsLoading(false)
        return
      }

      setListing(data)
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

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link className="text-sm font-semibold text-slate-600" to="/marketplace">
          Πίσω στις αγγελίες
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold break-words">{listing.title}</h1>
            {categoryName ? (
              <p className="text-sm text-slate-600 break-words">
                {categoryName}
                {conditionLabel ? ` \u00B7 ${conditionLabel}` : ''}
              </p>
            ) : null}
          </div>
          <span className="text-lg font-semibold text-slate-900">
            {listing.price}
          </span>
        </div>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {locationName ? (
            <div>
              <dt className="text-xs font-semibold text-slate-500">Τοποθεσία</dt>
              <dd className="mt-1 text-slate-900 break-words">{locationName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-semibold text-slate-500">
              Δημοσιεύτηκε
            </dt>
            <dd className="mt-1 text-slate-900">
              {formatDate(listing.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">Πωλητής</dt>
            <dd className="mt-1 text-slate-900 break-words">{sellerName}</dd>
          </div>
          {categoryName ? (
            <div>
              <dt className="text-xs font-semibold text-slate-500">Κατηγορία</dt>
              <dd className="mt-1 text-slate-900 break-words">{categoryName}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Περιγραφή</h2>
        <p className="mt-2 text-sm text-slate-600 break-words whitespace-pre-wrap">{listing.description}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Ενέργειες αγγελίας
        </h2>

        <button
          className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          type="button"
        >
          Επικοινωνία με τον πωλητή
        </button>

        {isSeller ? (
          <button
            className="mt-3 inline-flex items-center rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Διαγραφή σε εξέλιξη...' : 'Διαγραφή αγγελίας'}
          </button>
        ) : null}
      </div>
    </section>
  )
}