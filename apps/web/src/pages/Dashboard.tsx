import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [isVerifiedStudent, setIsVerifiedStudent] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      setIsLoading(true)
      setErrorMessage('')

      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (!isMounted) return

      if (userError || !userData.user) {
        const details = userError?.message ? ` (${userError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του χρήστη.${details}`)
        setIsLoading(false)
        return
      }

      setEmail(userData.user.email ?? '')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, is_verified_student')
        .eq('id', userData.user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profileError) {
        const details = profileError.message ? ` (${profileError.message})` : ''
        setErrorMessage(`Δεν ήταν δυνατή η φόρτωση του προφίλ.${details}`)
      }

      setDisplayName(profile?.display_name ?? '')
      setIsVerifiedStudent(Boolean(profile?.is_verified_student))
      setIsLoading(false)
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [])

  const greetingName = displayName || email
  const hasGreetingName = greetingName.trim().length > 0

  if (isLoading) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Φόρτωση πίνακα...</h1>
        <p className="text-sm text-slate-600">
          Δες τι μπορείς να κάνεις στην πλατφόρμα.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold flex flex-wrap items-center gap-2">
          {hasGreetingName ? (
            <>
              <span>Καλώς ήρθες,</span>
              <span className="inline-flex items-center gap-2">
                <span className="break-all">{greetingName}</span>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center border border-slate-300/70 bg-transparent text-[9px] font-semibold leading-none [clip-path:polygon(25%_6%,_75%_6%,_100%_50%,_75%_94%,_25%_94%,_0%_50%)] ${
                    isVerifiedStudent ? 'text-purple-500' : 'text-red-500'
                  }`}
                  aria-hidden="true"
                >
                  {isVerifiedStudent ? '✓' : 'pS'}
                </span>
              </span>
            </>
          ) : (
            <span>Καλώς ήρθες!</span>
          )}
        </h1>
        <p className="text-sm text-slate-600">
          Δες τι μπορείς να κάνεις στην πλατφόρμα.
        </p>
      </header>

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Marketplace</h2>
            <p className="text-sm text-slate-600">
              Αγόρασε ή πούλησε αντικείμενα από άλλους φοιτητές.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            to="/marketplace"
          >
            Άνοιγμα
          </Link>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Ομάδες</h2>
            <p className="text-sm text-slate-600">
              Σύντομα θα μπορείς να συμμετέχεις σε ομάδες φοιτητών.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Άνοιγμα
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Εκδηλώσεις</h2>
            <p className="text-sm text-slate-600">
              Σύντομα θα βρίσκεις εκδηλώσεις και συναντήσεις.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Άνοιγμα
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Συζητήσεις / Chat</h2>
            <p className="text-sm text-slate-600">
              Σύντομα θα μπορείς να συνομιλείς με άλλους φοιτητές.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400"
            type="button"
            disabled
          >
            Άνοιγμα
          </button>
        </section>
      </div>
    </section>
  )
}
