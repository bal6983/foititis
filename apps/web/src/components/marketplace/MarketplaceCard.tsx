import { Link } from 'react-router-dom'
import { useI18n } from '../../lib/i18n'
import { toEuro } from '../../lib/imageUpload'
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
      ? t({ en: 'For sale', el: 'Προς πώληση' })
      : t({ en: 'Wanted', el: 'Ζητείται' })

  const typeClass =
    item.type === 'sell'
      ? 'badge-pill badge-pill--sell'
      : 'badge-pill badge-pill--wanted'

  const trustLabel = item.sellerVerified
    ? t({ en: 'Verified', el: 'Επαληθευμένος' })
    : t({ en: 'Pre-student', el: 'Pre-student' })

  const trustClass = item.sellerVerified
    ? 'badge-pill badge-pill--verified'
    : 'badge-pill badge-pill--prestudent'

  const displayPrice =
    item.type === 'want'
      ? item.price?.trim()
        ? toEuro(item.price)
        : t({ en: 'Negotiable', el: 'Συζητήσιμη' })
      : item.price?.trim()
        ? toEuro(item.price)
        : t({ en: 'Contact for price', el: 'Επικοινώνησε για τιμή' })

  return (
    <article className="social-card flex h-full flex-col overflow-hidden">
      {item.primaryImageUrl ? (
        <Link to={item.type === 'sell' ? `/marketplace/${item.id}` : `/wanted/${item.id}`}>
          <img
            src={item.primaryImageUrl}
            alt={item.title}
            className="h-44 w-full object-cover"
            loading="lazy"
          />
        </Link>
      ) : (
        <div className="flex h-28 items-center justify-center bg-[var(--surface-soft)]">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {t({ en: 'No photo', el: 'Χωρίς φωτογραφία' })}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={typeClass}>
            {typeLabel}
          </span>
          <span className="badge-pill badge-pill--neutral">
            {item.category}
          </span>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-base font-semibold text-[var(--text-primary)]">
            {item.title}
          </h3>
          <span className="price-emphasis whitespace-nowrap text-sm">
            {displayPrice}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-[var(--text-secondary)]">
          {item.description}
        </p>

        <div className="mt-3 grid gap-1 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
          <p>
            {t({ en: 'University', el: 'Πανεπιστήμιο' })}: {item.universityName}
          </p>
          <p>
            {t({ en: 'Condition', el: 'Κατάσταση' })}:{' '}
            {item.condition || t({ en: 'Not set', el: 'Δεν ορίστηκε' })}
          </p>
          <p>
            {t({ en: 'Seller level', el: 'Επίπεδο πωλητή' })}: {item.sellerLevel}
          </p>
          <p>{formatDate(item.createdAt)}</p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">{item.sellerName}</span>
            <span className={trustClass}>
              {trustLabel}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to={item.type === 'sell' ? `/marketplace/${item.id}` : `/wanted/${item.id}`}
              className="inline-flex items-center rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-blue-400/50"
            >
              {t({ en: 'View listing', el: 'Προβολή αγγελίας' })}
            </Link>
            {onToggleSave ? (
              <button
                type="button"
                onClick={() => onToggleSave(item)}
                disabled={saveBusy || !saveEnabled}
                className="inline-flex items-center rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-60"
              >
                {item.isSaved
                  ? t({ en: 'Saved', el: 'Αποθηκευμένο' })
                  : t({ en: 'Save', el: 'Αποθήκευση' })}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
