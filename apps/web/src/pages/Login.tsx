import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n, type LocalizedMessage } from '../lib/i18n'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<LocalizedMessage | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      const details = error?.message ? ` (${error.message})` : ''
      setErrorMessage({
        en: `Unable to sign in.${details}`,
        el: `Δεν ήταν δυνατή η σύνδεση.${details}`,
      })
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    navigate('/dashboard')
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t({ en: 'Sign in', el: 'Σύνδεση' })}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t({
            en: 'Use email and password to continue.',
            el: 'Χρησιμοποίησε email και κωδικό για να συνεχίσεις.',
          })}
        </p>
      </header>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-blue-400/60 focus:outline-none"
            type="email"
            autoComplete="email"
            placeholder="you@uni.gr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-1 text-sm font-medium text-[var(--text-primary)]">
          {t({ en: 'Password', el: 'Κωδικός' })}
          <input
            className="mt-1 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-blue-400/60 focus:outline-none"
            type="password"
            autoComplete="current-password"
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? t({ en: 'Signing in...', el: 'Γίνεται σύνδεση...' })
            : t({ en: 'Sign in', el: 'Σύνδεση' })}
        </button>
      </form>

      {errorMessage ? (
        <p className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {t(errorMessage)}
        </p>
      ) : null}

      <p className="text-sm text-[var(--text-secondary)]">
        {t({ en: "Don't have an account?", el: 'Δεν έχεις λογαριασμό;' })}{' '}
        <Link className="font-semibold text-[var(--accent)]" to="/signup">
          {t({ en: 'Create an account', el: 'Δημιούργησε λογαριασμό' })}
        </Link>
        .
      </p>
    </section>
  )
}
