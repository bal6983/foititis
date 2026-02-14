import { useI18n } from '../../lib/i18n'

type LanguageToggleProps = {
  showLabel?: boolean
}

export default function LanguageToggle({ showLabel = true }: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n()
  const isGreek = locale === 'el'

  const toggleLocale = () => {
    setLocale(isGreek ? 'en' : 'el')
  }

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className={`inline-flex items-center rounded-full border shadow-sm transition ${
        showLabel
          ? 'gap-2 border-[var(--border-primary)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          : 'gap-1.5 border-cyan-300/30 bg-[color:var(--surface-soft)]/90 px-2 py-1 text-[11px] font-semibold text-cyan-100'
      }`}
      aria-label={t({ en: 'Toggle language', el: 'Εναλλαγή γλώσσας' })}
      title={
        isGreek
          ? t({ en: 'Switch to English', el: 'Μετάβαση σε Αγγλικά' })
          : t({ en: 'Switch to Greek', el: 'Μετάβαση σε Ελληνικά' })
      }
    >
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full border transition ${
          isGreek
            ? 'border-cyan-300/45 bg-cyan-500/25'
            : 'border-indigo-300/45 bg-indigo-500/22'
        }`}
        aria-hidden="true"
      >
        <span
          className={`h-3 w-3 rounded-full shadow-[0_2px_8px_rgba(2,6,23,0.35)] transition-transform duration-200 ${
            isGreek ? 'translate-x-[12px] bg-cyan-100' : 'translate-x-[2px] bg-indigo-100'
          }`}
        />
      </span>
      <span className={showLabel ? 'min-w-[24px] text-center text-[11px]' : 'text-[11px]'}>
        {isGreek ? 'EL' : 'EN'}
      </span>
      {showLabel ? <span>{t({ en: 'Language', el: 'Γλώσσα' })}</span> : null}
    </button>
  )
}
