import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
}

type CategoryOption = {
  id: string
  name: string
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
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

export default function Marketplace() {
  const [listings, setListings] = useState<MarketplaceListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesErrorMessage, setCategoriesErrorMessage] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [searchParams] = useSearchParams()
  const mineParam = searchParams.get('mine')
  const isMineFilter = mineParam === '1' || mineParam === 'true'

  useEffect(() => {
    let isMounted = true

    const loadCategories = async () => {
      setIsLoadingCategories(true)
      setCategoriesErrorMessage('')

      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setCategoriesErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των κατηγοριών.${details}`,
        )
        setIsLoadingCategories(false)
        return
      }

      setCategories(uniqueById(data ?? []))
      setIsLoadingCategories(false)
    }

    loadCategories()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadListings = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const normalizedSearch = searchTerm.trim()
      let query = supabase
        .from('listings')
        .select(
          'id, title, price, condition, condition_rating, location, location_id, locations ( id, name ), category, category_id, categories ( id, name ), description, created_at',
        )

      if (isMineFilter) {
        const { data: userData, error: userError } =
          await supabase.auth.getUser()

        if (userError || !userData.user) {
          const details = userError?.message ? ` (${userError.message})` : ''
          setErrorMessage(`Unable to load your listings.${details}`)
          setIsLoading(false)
          return
        }

        query = query.eq('seller_id', userData.user.id)
      }

      if (selectedCategoryId) {
        query = query.eq('category_id', selectedCategoryId)
      }

      if (normalizedSearch) {
        const searchPattern = `%${normalizedSearch}%`
        query = query.or(
          `title.ilike.${searchPattern},location.ilike.${searchPattern},description.ilike.${searchPattern}`,
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
  }, [searchTerm, selectedCategoryId, isMineFilter])

  const hasSearch = searchTerm.length > 0 || selectedCategoryId.length > 0

  const handleSearchSubmit = () => {
    const nextSearch = searchInput.trim()
    setSearchInput(nextSearch)
    setSearchTerm(nextSearch)
  }

  const isSearchDisabled = searchInput.trim().length === 0

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

      <div className="max-w-md space-y-3">
        <label className="sr-only" htmlFor="marketplace-search">
          Αναζήτηση
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="marketplace-search"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none sm:flex-1 sm:w-auto"
            type="search"
            placeholder="Αναζήτηση σε τίτλο, κατηγορία, τοποθεσία"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              handleSearchSubmit()
            }}
          />
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            onClick={handleSearchSubmit}
            disabled={isSearchDisabled}
          >
            Αναζήτηση
          </button>
        </div>
        <div>
          <label className="sr-only" htmlFor="marketplace-category">
            Κατηγορία
          </label>
          <select
            id="marketplace-category"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
            disabled={isLoadingCategories}
          >
            <option value="">Όλες οι κατηγορίες</option>
            {categories.map((categoryOption) => (
              <option key={categoryOption.id} value={categoryOption.id}>
                {categoryOption.name}
              </option>
            ))}
          </select>
          {categoriesErrorMessage ? (
            <p className="mt-2 text-xs text-rose-600">
              {categoriesErrorMessage}
            </p>
          ) : null}
        </div>
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
          {listings.map((listing) => {
            const conditionLabel = getConditionLabel(listing.condition_rating)
            const categoryName = listing.categories?.name
            const locationName = listing.locations?.name

            return (
              <article
                key={listing.id}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 break-words">
                      {listing.title}
                    </h2>
                    {categoryName ? (
                      <p className="text-sm text-slate-600 break-words">
                        {categoryName}
                        {conditionLabel ? ` \u00B7 ${conditionLabel}` : ''}
                      </p>
                    ) : null}
                    {locationName ? (
                      <p className="mt-2 text-sm text-slate-600 break-words">
                        Τοποθεσία: {locationName}
                      </p>
                    ) : null}
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
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
