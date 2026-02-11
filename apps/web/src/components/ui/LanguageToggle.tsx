import { useI18n } from '../../lib/i18n'

type LanguageToggleProps = {
  showLabel?: boolean
}

export default function LanguageToggle({ showLabel = true }: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n()

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm">
      {showLabel ? (
        <span className="text-[var(--text-secondary)]">
          {t({ en: 'Language', el: 'Γλώσσα' })}
        </span>
      ) : null}
      <select
        value={locale}
        onChange={(event) => {
          const nextLocale = event.target.value === 'el' ? 'el' : 'en'
          setLocale(nextLocale)
        }}
        aria-label={t({ en: 'Select language', el: 'Επιλογή γλώσσας' })}
        className="bg-transparent text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
      >
        <option value="en">{t({ en: 'English', el: 'Αγγλικά' })}</option>
        <option value="el">{t({ en: 'Greek', el: 'Ελληνικά' })}</option>
      </select>
    </label>
  )
}
