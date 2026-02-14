import { Outlet } from 'react-router-dom'
import LanguageToggle from '../components/ui/LanguageToggle'
import ThemeToggle from '../components/ui/ThemeToggle'
import { useI18n } from '../lib/i18n'

export default function AuthLayout() {
  const { t } = useI18n()

  return (
    <div className="flex min-h-screen flex-col text-[var(--text-primary)]">
      <header className="flex items-center justify-end gap-2 px-4 py-3">
        <ThemeToggle />
        <LanguageToggle />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-12">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-[var(--text-primary)]">
            foititis
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {t({
              en: 'The student platform for campus life',
              el: 'Η πλατφόρμα φοιτητικής ζωής',
            })}
          </p>
        </div>

        <div className="glass-card rounded-2xl border border-[var(--border-primary)] p-6">
          <Outlet />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
          {t({
            en: 'A platform by students, for students.',
            el: 'Μια πλατφόρμα από φοιτητές, για φοιτητές.',
          })}
        </p>
      </main>
    </div>
  )
}
