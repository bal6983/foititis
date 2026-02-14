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
      <span aria-hidden="true" className={isDark ? 'text-cyan-100' : 'text-amber-100'}>
        {isDark ? '☾' : '☀'}
      </span>
    </button>
  )
}
