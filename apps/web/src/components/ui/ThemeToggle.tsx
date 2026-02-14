import { useI18n } from '../../lib/i18n'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--surface-card)] text-[13px] shadow-sm transition hover:scale-[1.03]"
      aria-label={t({ en: 'Toggle theme', el: 'Εναλλαγή θέματος' })}
      title={
        isDark
          ? t({ en: 'Switch to light mode', el: 'Μετάβαση σε φωτεινό θέμα' })
          : t({ en: 'Switch to dark mode', el: 'Μετάβαση σε σκοτεινό θέμα' })
      }
    >
      {isDark ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 text-amber-200"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 text-cyan-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.4A8.5 8.5 0 1 1 11.6 3c-.1.3-.1.7-.1 1 0 4.7 3.8 8.5 8.5 8.5.3 0 .7 0 1-.1z" />
        </svg>
      )}
    </button>
  )
}
