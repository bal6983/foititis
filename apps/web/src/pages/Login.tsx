import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      const details = error?.message ? ` (${error.message})` : ''
      setErrorMessage(`Δεν ήταν δυνατή η σύνδεση.${details}`)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    navigate('/dashboard')
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Σύνδεση</h1>
        <p className="text-sm text-slate-600">
          Χρησιμοποίησε email και κωδικό για να συνεχίσεις.
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm font-medium">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="email"
            autoComplete="email"
            placeholder="you@uni.gr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm font-medium">
          Κωδικός
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            type="password"
            autoComplete="current-password"
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Γίνεται σύνδεση...' : 'Σύνδεση'}
        </button>
      </form>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <p className="text-sm text-slate-600">
        Δεν έχεις λογαριασμό;{' '}
        <Link className="font-semibold text-slate-900" to="/signup">
          Δημιούργησε λογαριασμό
        </Link>
        .
      </p>
    </section>
  )
}
