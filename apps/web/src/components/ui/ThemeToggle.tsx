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
      className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition hover:text-[var(--text-primary)]"
      aria-label={t({ en: 'Toggle theme', el: 'Εναλλαγή θέματος' })}
      title={
        isDark
          ? t({ en: 'Switch to light mode', el: 'Μετάβαση σε φωτεινό θέμα' })
          : t({ en: 'Switch to dark mode', el: 'Μετάβαση σε σκοτεινό θέμα' })
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isDark ? 'bg-cyan-400' : 'bg-blue-500'
        }`}
      />
      <span>
        {isDark
          ? t({ en: 'Dark', el: 'Σκοτεινό' })
          : t({ en: 'Light', el: 'Φωτεινό' })}
      </span>
    </button>
  )
}
