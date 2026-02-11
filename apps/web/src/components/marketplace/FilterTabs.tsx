import { useI18n } from '../../lib/i18n'

export type ListingFilter = 'all' | 'sell' | 'want'

type FilterTabsProps = {
  value: ListingFilter
  onChange: (next: ListingFilter) => void
}

export default function FilterTabs({ value, onChange }: FilterTabsProps) {
  const { t } = useI18n()
  const options: Array<{ id: ListingFilter; label: string }> = [
    { id: 'all', label: t({ en: 'All', el: 'Όλα' }) },
    { id: 'sell', label: t({ en: 'For Sale', el: 'Προς Πώληση' }) },
    { id: 'want', label: t({ en: 'Looking For', el: 'Αναζήτηση' }) },
  ]

  return (
    <div className="inline-flex rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] p-1">
      {options.map((option) => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              active
                ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
