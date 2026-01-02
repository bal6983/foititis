import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type WantedListing = {
  id: string
  title: string
  category: string
  category_id: string | null
  categories: { id: string; name: string } | null
  location: string
  location_id: string | null
  locations: { id: string; name: string } | null
  condition_rating: number | null
  description: string
  created_at: string
  user_id: string
}

type RelatedListing = {
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

export default function WantedDetail() {
  const { wantedId } = useParams()
  const [listing, setListing] = useState<WantedListing | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadErrorMessage, setLoadErrorMessage] = useState('')
  const [relatedListings, setRelatedListings] = useState<RelatedListing[]>([])
  const [isRelatedLoading, setIsRelatedLoading] = useState(false)
  const [relatedErrorMessage, setRelatedErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadListing = async () => {
      setIsLoading(true)
      setLoadErrorMessage('')
      setRelatedListings([])
      setRelatedErrorMessage('')
      setIsRelatedLoading(false)

      if (!wantedId) {
        setLoadErrorMessage('Δεν βρέθηκε η αγγελία ζήτησης.')
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('wanted_listings')
        .select(
          'id, title, category, category_id, categories ( id, name ), location, location_id, locations ( id, name ), condition_rating, description, created_at, user_id',
        )
        .eq('id', wantedId)
        .single()

      if (!isMounted) return

      if (error || !data) {
        const details = error?.message ? ` (${error.message})` : ''
        setLoadErrorMessage(`Δεν βρέθηκε η αγγελία ζήτησης.${details}`)
        setIsLoading(false)
        return
      }

      setListing(data)
      setIsLoading(false)

      const categoryId = data.category_id

      if (!categoryId) {
        return
      }

      setIsRelatedLoading(true)
      const titleTerm = data.title.trim()
      const buildRelatedQuery = () =>
        supabase
          .from('listings')
          .select(
            'id, title, price, condition, condition_rating, location, location_id, locations ( id, name ), category, category_id, categories ( id, name ), description, created_at',
          )
          .eq('category_id', categoryId)
          .order('created_at', { ascending: false })
          .limit(6)

      if (titleTerm) {
        const titlePattern = `%${titleTerm}%`
        const { data: relatedData, error: relatedError } = await buildRelatedQuery().ilike(
          'title',
          titlePattern,
        )

        if (!isMounted) return

        if (relatedError) {
          const details = relatedError.message ? ` (${relatedError.message})` : ''
          setRelatedErrorMessage(
            `ƒœ¤ ã«˜¤ ›¬¤˜«ã ž ­æ¨«à©ž ©®œ« ¡é¤ ˜ššœ¢ é¤.${details}`,
          )
          setIsRelatedLoading(false)
          return
        }

        if (relatedData && relatedData.length > 0) {
          setRelatedListings(relatedData)
          setIsRelatedLoading(false)
          return
        }
      }

      const { data: fallbackData, error: fallbackError } = await buildRelatedQuery()

      if (!isMounted) return

      if (fallbackError) {
        const details = fallbackError.message ? ` (${fallbackError.message})` : ''
        setRelatedErrorMessage(
          `ƒœ¤ ã«˜¤ ›¬¤˜«ã ž ­æ¨«à©ž ©®œ« ¡é¤ ˜ššœ¢ é¤.${details}`,
        )
        setIsRelatedLoading(false)
        return
      }

      setRelatedListings(fallbackData ?? [])
      setIsRelatedLoading(false)

    }

    loadListing()

    return () => {
      isMounted = false
    }
  }, [wantedId])

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Αγγελία ζήτησης</h1>
        <p className="text-sm text-slate-600">Φόρτωση αγγελίας ζήτησης...</p>
      </section>
    )
  }

  if (loadErrorMessage || !listing) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Αγγελία ζήτησης</h1>
        <p className="text-sm text-slate-600">
          {loadErrorMessage || 'Δεν βρέθηκε η αγγελία ζήτησης.'}
        </p>
        <Link className="text-sm font-semibold text-slate-900" to="/wanted">
          Πίσω στις αγγελίες ζήτησης
        </Link>
      </section>
    )
  }

  const conditionLabel = getConditionLabel(listing.condition_rating)

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link className="text-sm font-semibold text-slate-600" to="/wanted">
          Πίσω στις αγγελίες ζήτησης
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold break-words">
              {listing.title}
            </h1>
            <p className="text-sm text-slate-600 break-words">
              {listing.categories?.name ?? listing.category}
            </p>
          </div>
        </div>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-slate-500">Τοποθεσία</dt>
            <dd className="mt-1 text-slate-900 break-words">
              {listing.locations?.name ?? listing.location}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">
              Δημοσιεύτηκε
            </dt>
            <dd className="mt-1 text-slate-900">
              {formatDate(listing.created_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-500">Κατηγορία</dt>
            <dd className="mt-1 text-slate-900 break-words">
              {listing.categories?.name ?? listing.category}
            </dd>
          </div>
          {conditionLabel ? (
            <div>
              <dt className="text-xs font-semibold text-slate-500">Κατάσταση</dt>
              <dd className="mt-1 text-slate-900">{conditionLabel}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Περιγραφή</h2>
        <p className="mt-2 text-sm text-slate-600 break-words whitespace-pre-wrap">
          {listing.description}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Επικοινώνησε</h2>
        <button
          className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          type="button"
        >
          Επικοινώνησε
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Σχετικές αγγελίες
        </h2>

        {isRelatedLoading ? (
          <p className="text-sm text-slate-600">Φόρτωση σχετικών αγγελιών...</p>
        ) : null}

        {relatedErrorMessage ? (
          <p className="text-sm text-rose-600">{relatedErrorMessage}</p>
        ) : null}

        {!isRelatedLoading &&
        !relatedErrorMessage &&
        relatedListings.length === 0 ? (
          <p className="text-sm text-slate-600">
            Δεν βρέθηκαν σχετικές αγγελίες.
          </p>
        ) : null}

        {!isRelatedLoading &&
        !relatedErrorMessage &&
        relatedListings.length > 0 ? (
          <div className="grid gap-4">
            {relatedListings.map((related) => {
              const relatedConditionLabel = getConditionLabel(
                related.condition_rating,
              )

              return (
                <article
                  key={related.id}
                  className="rounded-lg border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 break-words">
                        {related.title}
                      </h3>
                      <p className="text-sm text-slate-600 break-words">
                        {related.categories?.name ?? related.category}
                        {relatedConditionLabel
                          ? ` · ${relatedConditionLabel}`
                          : ''}
                      </p>
                      <p className="mt-2 text-sm text-slate-600 break-words">
                        ’¦§¦Ÿœ©å˜: {related.locations?.name ?? related.location}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {related.price}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 break-words whitespace-pre-wrap">
                    {related.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span>{formatDate(related.created_at)}</span>
                    <Link
                      className="font-semibold text-slate-900"
                      to={`/marketplace/${related.id}`}
                    >
                      ƒœª ¢œ§«¦£â¨œ œª
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </section>
  )
}
