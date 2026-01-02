import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  description: string
  created_at: string
}

type CategoryOption = {
  id: string
  name: string
}

type LocationOption = {
  id: string
  name: string
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('el-GR')
}

export default function Wanted() {
  const [listings, setListings] = useState<WantedListing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesErrorMessage, setCategoriesErrorMessage] = useState('')
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(true)
  const [locationsErrorMessage, setLocationsErrorMessage] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedLocationId, setSelectedLocationId] = useState('')

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
          `ƒœ¤ ã«˜¤ ›¬¤˜«ã ž ­æ¨«à©ž «à¤ ¡˜«žš¦¨ é¤.${details}`,
        )
        setIsLoadingCategories(false)
        return
      }

      setCategories(data ?? [])
      setIsLoadingCategories(false)
    }

    loadCategories()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadLocations = async () => {
      setIsLoadingLocations(true)
      setLocationsErrorMessage('')

      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setLocationsErrorMessage(
          `ƒœ¤ ã«˜¤ ›¬¤˜«ã ž ­æ¨«à©ž «à¤ «¦§¦Ÿœ© é¤.${details}`,
        )
        setIsLoadingLocations(false)
        return
      }

      setLocations(data ?? [])
      setIsLoadingLocations(false)
    }

    loadLocations()

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
        .from('wanted_listings')
        .select(
          'id, title, category, category_id, categories ( id, name ), location, location_id, locations ( id, name ), description, created_at',
        )

      if (selectedCategoryId) {
        query = query.eq('category_id', selectedCategoryId)
      }

      if (selectedLocationId) {
        query = query.eq('location_id', selectedLocationId)
      }

      if (normalizedSearch) {
        const searchPattern = `%${normalizedSearch}%`
        query = query.or(
          `title.ilike.${searchPattern},description.ilike.${searchPattern}`,
        )
      }

      const { data, error } = await query.order('created_at', {
        ascending: false,
      })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(
          `Δεν ήταν δυνατή η φόρτωση των αγγελιών ζήτησης.${details}`,
        )
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
  }, [searchTerm, selectedCategoryId, selectedLocationId])

  const hasFilters =
    searchTerm.length > 0 ||
    selectedCategoryId.length > 0 ||
    selectedLocationId.length > 0
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
          <h1 className="text-2xl font-semibold">Ψάχνω για</h1>
          <p className="text-sm text-slate-600">
            Δες τι αναζητούν άλλοι φοιτητές ή δημοσίευσε τη δική σου ζήτηση.
          </p>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          to="/wanted/new"
        >
          Νέα ζήτηση
        </Link>
      </header>
      <div className="max-w-md space-y-3">
        <label className="sr-only" htmlFor="wanted-search">
          Αναζήτηση
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="wanted-search"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none sm:flex-1 sm:w-auto"
            type="search"
            placeholder="Αναζήτηση σε τίτλο ή περιγραφή"
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
            {'\u0391\u03BD\u03B1\u03B6\u03AE\u03C4\u03B7\u03C3\u03B7'}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="sr-only" htmlFor="wanted-category">
              Κατηγορία
            </label>
            <select
              id="wanted-category"
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
          <div>
            <label className="sr-only" htmlFor="wanted-location">
              Τοποθεσία
            </label>
            <select
              id="wanted-location"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              disabled={isLoadingLocations}
            >
              <option value="">Όλες οι τοποθεσίες</option>
              {locations.map((locationOption) => (
                <option key={locationOption.id} value={locationOption.id}>
                  {locationOption.name}
                </option>
              ))}
            </select>
            {locationsErrorMessage ? (
              <p className="mt-2 text-xs text-rose-600">
                {locationsErrorMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-600">
          Φόρτωση αγγελιών ζήτησης...
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}
      {!isLoading && !errorMessage && listings.length === 0 && hasFilters ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">
            Δεν βρέθηκαν αγγελίες με τα φίλτρα σου.
          </p>
        </div>
      ) : null}
      {!isLoading && !errorMessage && listings.length === 0 && !hasFilters ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">
            ƒœ¤ ¬§á¨®¦¬¤ ˜¡æ£ž ˜ššœ¢åœª ã«ž©žª. ‚å¤œ ¦ §¨é«¦ª §¦¬ Ÿ˜ ž«ã©œ 
            ¡á« .
          </p>
          <Link
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            to="/wanted/new"
          >
            ƒž£ ¦ç¨šž©œ ã«ž©ž
          </Link>
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
                    {listing.categories?.name ?? listing.category}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 break-words">
                    Τοποθεσία: {listing.locations?.name ?? listing.location}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600 break-words whitespace-pre-wrap">
                {listing.description}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{formatDate(listing.created_at)}</span>
                <Link
                  className="font-semibold text-slate-900"
                  to={`/wanted/${listing.id}`}
                >
                  Δες λεπτομέρειες
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
