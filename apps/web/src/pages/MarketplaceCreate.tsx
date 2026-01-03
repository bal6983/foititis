import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type CategoryOption = {
  id: string
  name: string
}

type LocationOption = {
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

export default function MarketplaceCreate() {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [conditionRating, setConditionRating] = useState<number | null>(null)
  const [locationId, setLocationId] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [showLocked, setShowLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true

    const loadCategories = async () => {
      setIsLoadingCategories(true)

      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση των κατηγοριών.${details}`)
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

    const loadLocations = async () => {
      setIsLoadingLocations(true)

      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .order('name', { ascending: true })

      if (!isMounted) return

      if (error) {
        const details = error.message ? ` (${error.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση των τοποθεσιών.${details}`)
        setIsLoadingLocations(false)
        return
      }

      setLocations(uniqueById(data ?? []))
      setIsLoadingLocations(false)
    }

    loadLocations()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setShowLocked(false)
    setIsSubmitting(true)

    const selectedCategory = categories.find(
      (categoryOption) => categoryOption.id === categoryId,
    )

    if (!selectedCategory) {
      setErrorMessage('Παρακαλώ επίλεξε κατηγορία.')
      setIsSubmitting(false)
      return
    }

    const selectedLocation = locations.find(
      (locationOption) => locationOption.id === locationId,
    )

    if (!selectedLocation) {
      setErrorMessage('Παρακαλώ επίλεξε τοποθεσία.')
      setIsSubmitting(false)
      return
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      const details = userError?.message ? ` (${userError.message})` : ''
      setErrorMessage(`Πρέπει να συνδεθείς για να συνεχίσεις.${details}`)
      setIsSubmitting(false)
      return
    }

    const listingPayload: Record<string, string | number | null> = {
      title,
      price,
      category: selectedCategory.name,
      category_id: selectedCategory.id,
      condition: conditionRating !== null ? conditionRating.toString() : '',
      location: selectedLocation.name,
      location_id: selectedLocation.id,
      description,
      seller_id: userData.user.id,
    }

    if (conditionRating !== null) {
      listingPayload.condition_rating = conditionRating
    }

    const { error } = await supabase.from('listings').insert(listingPayload)

    if (error) {
      setShowLocked(true)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    navigate('/marketplace')
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link className="text-sm font-semibold text-slate-600" to="/marketplace">
          Πίσω στις αγγελίες
        </Link>
        <h1 className="text-2xl font-semibold">Δημιουργία αγγελίας</h1>
        <p className="text-sm text-slate-600">
          Συμπλήρωσε τα βασικά στοιχεία της αγγελίας σου.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm font-medium">
          Τίτλος
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Π.χ. Βιβλίο Οικονομικών"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium">
            Τιμή
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="text"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Π.χ. €25"
            />
          </label>

          <label className="block space-y-1 text-sm font-medium">
            Κατηγορία
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={isLoadingCategories}
              required
            >
              <option value="">
                {isLoadingCategories
                  ? 'Φόρτωση κατηγοριών...'
                  : 'Επίλεξε κατηγορία'}
              </option>
              {categories.map((categoryOption) => (
                <option key={categoryOption.id} value={categoryOption.id}>
                  {categoryOption.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium">
            Κατάσταση
            <input
              className="mt-1 w-full accent-slate-900"
              type="range"
              min={1}
              max={5}
              step={1}
              value={conditionRating ?? 3}
              onChange={(event) => setConditionRating(Number(event.target.value))}
            />
            {conditionRating !== null ? (
              <p className="text-xs text-slate-600">
                {getConditionLabel(conditionRating)}
              </p>
            ) : null}
          </label>

          <label className="block space-y-1 text-sm font-medium">
            Τοποθεσία
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              disabled={isLoadingLocations}
              required
            >
              <option value="">
                {isLoadingLocations
                  ? 'Φόρτωση τοποθεσιών...'
                  : 'Επίλεξε τοποθεσία'}
              </option>
              {locations.map((locationOption) => (
                <option key={locationOption.id} value={locationOption.id}>
                  {locationOption.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-sm font-medium">
          Περιγραφή
          <textarea
            className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Περιέγραψε σύντομα το αντικείμενο."
          />
        </label>
        <button
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Υποβολή σε εξέλιξη...' : 'Υποβολή αγγελίας'}
        </button>

        {errorMessage ? (
          <p className="text-sm text-rose-600">{errorMessage}</p>
        ) : null}

        {showLocked ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              Διαθέσιμο μόνο για επιβεβαιωμένους φοιτητές.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Ολοκλήρωσε την επαλήθευση για να δημοσιεύσεις αγγελία.
            </p>
            <Link
              className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              to="/verification"
            >
              Μετάβαση στην επαλήθευση φοιτητή
            </Link>
          </div>
        ) : null}
      </form>
    </section>
  )
}
