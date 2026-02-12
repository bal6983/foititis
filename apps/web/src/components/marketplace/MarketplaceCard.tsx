import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import type { UnifiedMarketplaceItem } from './types'

type MarketplaceCardProps = {
  item: UnifiedMarketplaceItem
  onToggleSave?: (item: UnifiedMarketplaceItem) => void
  saveBusy?: boolean
  saveEnabled?: boolean
}

export default function MarketplaceCard({
  item,
  onToggleSave,
  saveBusy = false,
  saveEnabled = true,
}: MarketplaceCardProps) {
  const { t, formatDate } = useI18n()

  const typeLabel =
    item.type === 'sell'
      ? t({ en: 'For sale', el: 'Προς πωληση' })
      : t({ en: 'Looking for', el: 'Ζητειται' })
  const typeClass =
    item.type === 'sell'
      ? 'bg-blue-500/20 text-blue-200 border-blue-300/30'
      : 'bg-cyan-500/20 text-cyan-200 border-cyan-300/30'

  const trustLabel = item.sellerVerified
    ? t({ en: 'Verified', el: 'Επαληθευμενος' })
    : t({ en: 'Pre-student', el: 'Pre-student' })
  const trustClass = item.sellerVerified
    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-300/30'
    : 'bg-amber-500/20 text-amber-100 border-amber-300/30'

  return (
    <article className="glass-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeClass}`}>
          {typeLabel}
        </span>
        <span className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
          {item.category}
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{item.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{item.description}</p>

      <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
        <p>
          {t({ en: 'University', el: 'Πανεπιστημιο' })}:{' '}
          {item.universityName || t({ en: 'Unknown', el: 'Αγνωστο' })}
        </p>
        <p>
          {t({ en: 'Condition', el: 'Κατασταση' })}:{' '}
          {item.condition || t({ en: 'Not set', el: 'Δεν οριστηκε' })}
        </p>
        <p>
          {t({ en: 'Price', el: 'Τιμη' })}:{' '}
          {item.type === 'want'
            ? item.price?.trim()
              ? item.price
              : t({ en: 'Negotiable', el: 'Συζητησιμη' })
            : item.price ?? t({ en: 'Contact for price', el: 'Επικοινωνησε για τιμη' })}
        </p>
        <p>
          {t({ en: 'Seller level', el: 'Επιπεδο πωλητη' })}: {item.sellerLevel}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">{item.sellerName}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${trustClass}`}>
            {trustLabel}
          </span>
        </div>
        <span className="text-xs text-[var(--text-secondary)]">{formatDate(item.createdAt)}</span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          to={item.type === 'sell' ? `/marketplace/${item.id}` : `/wanted/${item.id}`}
          className="inline-flex items-center rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-blue-400/50"
        >
          {t({ en: 'View listing', el: 'Προβολη αγγελιας' })}
        </Link>
        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(item)}
            disabled={saveBusy || !saveEnabled}
            className="inline-flex items-center rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-60"
          >
            {item.isSaved
              ? t({ en: 'Saved', el: 'Αποθηκευμενο' })
              : t({ en: 'Save', el: 'Αποθηκευση' })}
          </button>
        ) : null}
      </div>
    </article>
  )
}
