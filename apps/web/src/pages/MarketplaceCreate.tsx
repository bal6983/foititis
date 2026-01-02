import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function MarketplaceCreate() {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showLocked, setShowLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setShowLocked(false)
    setIsSubmitting(true)

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      const details = userError?.message ? ` (${userError.message})` : ''
      setErrorMessage(`Πρέπει να συνδεθείς για να συνεχίσεις.${details}`)
      setIsSubmitting(false)
      return
    }

    const { error } = await supabase.from('listings').insert({
      title,
      price,
      category,
      condition,
      location,
      description,
      seller_id: userData.user.id,
    })

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
              required
            />
          </label>

          <label className="block space-y-1 text-sm font-medium">
            Κατηγορία
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Π.χ. Βιβλία"
              required
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium">
            Κατάσταση
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="text"
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              placeholder="Π.χ. Πολύ καλή"
              required
            />
          </label>

          <label className="block space-y-1 text-sm font-medium">
            Τοποθεσία
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Π.χ. Αθήνα"
              required
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm font-medium">
          Περιγραφή
          <textarea
            className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Περιέγραψε σύντομα το αντικείμενο."
            required
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
