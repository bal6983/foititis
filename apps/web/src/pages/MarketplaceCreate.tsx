import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { compressImageFile } from '../lib/imageUpload'
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
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [showLocked, setShowLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreStudent, setIsPreStudent] = useState(false)
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const navigate = useNavigate()

  const handleImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const valid = files.filter((file) => file.type.startsWith('image/'))
    if (valid.length === 0) return

    const limited = valid.slice(0, 6)
    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setSelectedImages(limited)
    setPreviewUrls(limited.map((file) => URL.createObjectURL(file)))
  }

  useEffect(
    () => () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
    },
    [previewUrls],
  )

  useEffect(() => {
    let isMounted = true

    const checkAccess = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!isMounted) return

      if (userData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_pre_student, is_verified_student')
          .eq('id', userData.user.id)
          .maybeSingle()

        if (!isMounted) return
        setIsPreStudent(
          Boolean(profile?.is_pre_student) && !Boolean(profile?.is_verified_student),
        )
      }

      setIsCheckingAccess(false)
    }

    checkAccess()

    return () => {
      isMounted = false
    }
  }, [])

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

    const insertRes = await supabase
      .from('listings')
      .insert(listingPayload)
      .select('id')
      .single()

    if (insertRes.error || !insertRes.data?.id) {
      setShowLocked(true)
      setIsSubmitting(false)
      return
    }

    if (selectedImages.length > 0) {
      const listingId = insertRes.data.id
      const uploadedUrls: string[] = []

      for (let i = 0; i < selectedImages.length; i += 1) {
        const file = await compressImageFile(selectedImages[i], {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.72,
          targetBytes: 300 * 1024,
        })
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${userData.user.id}/${listingId}/${Date.now()}-${i}.${extension}`
        const uploadRes = await supabase.storage
          .from('listing-images')
          .upload(path, file, { upsert: false, contentType: file.type })
        if (uploadRes.error) continue
        const publicUrl = supabase.storage.from('listing-images').getPublicUrl(path).data.publicUrl
        uploadedUrls.push(publicUrl)
      }

      if (uploadedUrls.length > 0) {
        await supabase
          .from('listings')
          .update({
            image_url: uploadedUrls[0],
            image_urls: uploadedUrls,
          })
          .eq('id', listingId)
      }
    }

    setIsSubmitting(false)
    navigate('/marketplace')
  }

  if (isCheckingAccess) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Φόρτωση...</h1>
        <p className="text-sm text-slate-600">Έλεγχος πρόσβασης.</p>
      </section>
    )
  }

  if (isPreStudent) {
    return (
      <section className="space-y-6">
        <header className="space-y-2">
          <Link className="text-sm font-semibold text-slate-600" to="/marketplace">
            Πίσω στις αγγελίες
          </Link>
          <h1 className="text-2xl font-semibold">Δημιουργία αγγελίας</h1>
        </header>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-semibold">
            Μόνο επαληθευμένοι φοιτητές μπορούν να δημιουργήσουν αγγελίες.
          </p>
          <p className="mt-2 text-amber-800">
            Ολοκλήρωσε την επαλήθευση του πανεπιστημιακού σου email για να αποκτήσεις πρόσβαση.
          </p>
          <Link
            className="mt-3 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            to="/verification"
          >
            Μετάβαση στην επαλήθευση
          </Link>
        </div>
      </section>
    )
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
              placeholder="π.χ. €25"
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

        <label className="block space-y-1 text-sm font-medium">
          Φωτογραφίες (προαιρετικά)
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagesChange}
          />
          {previewUrls.length > 0 ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {previewUrls.map((url) => (
                <img key={url} src={url} alt="preview" className="h-20 w-full rounded-lg object-cover" />
              ))}
            </div>
          ) : null}
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
