import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type MarketplaceListing = {
  id: string
  title: string
  price: string
  condition: string
  location: string
  category: string
  description: string
  created_at: string
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('el-GR')
}

export default function Marketplace() {
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadListings = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const normalizedSearch = searchTerm.trim()
      let query = supabase
        .from('listings')
        .select(
          'id, title, price, condition, location, category, description, created_at',
        )

      if (normalizedSearch) {
        const searchPattern = `%${normalizedSearch}%`
        query = query.or(
          `title.ilike.${searchPattern},category.ilike.${searchPattern},location.ilike.${searchPattern},description.ilike.${searchPattern}`,
        )
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση αγγελιών.${details}`)
        setIsLoading(false)
        return
      }

      setListings(data ?? [])
      setIsLoading(false)
    }

    loadListings()

    return () => {
      isMounted = false
    }
  }, [searchTerm])

  const hasSearch = searchTerm.length > 0

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Αγορά</h1>
          <p className="text-sm text-slate-600">
            Ανακάλυψε αγγελίες από φοιτητές της κοινότητας.
          </p>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          to="/marketplace/new"
        >
          Δημιουργία αγγελίας
        </Link>
      </header>

      <div className="max-w-md">
        <label className="sr-only" htmlFor="marketplace-search">
          Αναζήτηση
        </label>
        <input
          id="marketplace-search"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          type="search"
          placeholder="Αναζήτηση σε τίτλο, κατηγορία, τοποθεσία"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            const nextSearch = searchInput.trim()
            setSearchInput(nextSearch)
            setSearchTerm(nextSearch)
          }}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">Φόρτωση αγγελιών...</p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      {!isLoading && !errorMessage && listings.length === 0 && !hasSearch ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">
            Δεν υπάρχουν αγγελίες ακόμα. Γίνε ο πρώτος που θα ανεβάσει κάτι.
          </p>
          <Link
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            to="/marketplace/new"
          >
            Δημιουργία αγγελίας
          </Link>
        </div>
      ) : null}

      {!isLoading &&
      !errorMessage &&
      listings.length === 0 &&
      hasSearch ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">
            Δεν βρέθηκαν αγγελίες για την αναζήτησή σου.
          </p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && listings.length > 0 ? (
        <div className="grid gap-4">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900 break-words">
                    {listing.title}
                  </h2>
                  <p className="text-sm text-slate-600 break-words">
                    {listing.category} · {listing.condition}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 break-words">
                    Τοποθεσία: {listing.location}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {listing.price}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600 break-words whitespace-pre-wrap">
                {listing.description}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{formatDate(listing.created_at)}</span>
                <Link
                  className="font-semibold text-slate-900"
                  to={`/marketplace/${listing.id}`}
                >
                  Δες αγγελία
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
