import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import type { CreateMarketplaceItemInput, MarketplaceType } from './types'

type CategoryOption = {
  id: string
  name: string
}

type CreateItemModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateMarketplaceItemInput) => Promise<void>
  categories: CategoryOption[]
  universityName: string
  isSubmitting: boolean
  initialType?: MarketplaceType
}

export default function CreateItemModal({
  open,
  onClose,
  onSubmit,
  categories,
  universityName,
  isSubmitting,
  initialType = 'sell',
}: CreateItemModalProps) {
  const { t } = useI18n()
  const [type, setType] = useState<MarketplaceType>(initialType)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [conditionRating, setConditionRating] = useState<number | null>(null)
  const [price, setPrice] = useState('')

  const conditionOptions = [
    { id: 1, label: t({ en: 'Poor', el: 'Πολύ κακή' }) },
    { id: 2, label: t({ en: 'Fair', el: 'Κακή' }) },
    { id: 3, label: t({ en: 'Good', el: 'Μέτρια' }) },
    { id: 4, label: t({ en: 'Very Good', el: 'Καλή' }) },
    { id: 5, label: t({ en: 'Excellent', el: 'Πολύ καλή' }) },
  ]

  const canSubmit = useMemo(
    () =>
      title.trim() !== '' &&
      description.trim() !== '' &&
      categoryId !== '' &&
      !isSubmitting,
    [categoryId, description, isSubmitting, title],
  )

  useEffect(() => {
    if (open) {
      setType(initialType)
    }
  }, [initialType, open])

  if (!open) return null

  const submit = async () => {
    if (!canSubmit) return

    await onSubmit({
      type,
      title: title.trim(),
      description: description.trim(),
      categoryId,
      conditionRating,
      price: price.trim() === '' ? null : price.trim(),
      universityName,
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <div className="glass-card w-full max-w-xl p-5">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t({ en: 'Create Item', el: 'Δημιουργία' })}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {t({
                en: 'Unified marketplace for selling and searching.',
                el: 'Ενοποιημένο marketplace για πώληση και αναζήτηση.',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-xs text-[var(--text-secondary)]"
          >
            {t({ en: 'Close', el: 'Κλείσιμο' })}
          </button>
        </header>

        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-[var(--border-primary)] bg-[var(--surface-soft)] p-1">
            {(['sell', 'want'] as const).map((option) => {
              const active = type === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    active
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-slate-950'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {option === 'sell'
                    ? t({ en: 'For Sale', el: 'Προς Πώληση' })
                    : t({ en: 'Looking For', el: 'Αναζήτηση' })}
                </button>
              )
            })}
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">
              {t({ en: 'Title', el: 'Τίτλος' })}
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">
              {t({ en: 'Description', el: 'Περιγραφή' })}
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-[var(--text-secondary)]">
                {t({ en: 'Category', el: 'Κατηγορία' })}
              </span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="">{t({ en: 'Select category', el: 'Επίλεξε κατηγορία' })}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-[var(--text-secondary)]">
                {t({ en: 'Condition', el: 'Κατάσταση' })}
              </span>
              <select
                value={conditionRating ?? ''}
                onChange={(event) =>
                  setConditionRating(
                    event.target.value === '' ? null : Number(event.target.value),
                  )
                }
                className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="">{t({ en: 'Select condition', el: 'Επίλεξε κατάσταση' })}</option>
                {conditionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">
              {t({ en: 'Price', el: 'Τιμή' })} {type === 'want' ? t({ en: '(optional)', el: '(προαιρετικό)' }) : ''}
            </span>
            <input
              type="text"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
              placeholder={
                type === 'want'
                  ? t({ en: 'Budget (optional)', el: 'Προϋπολογισμός (προαιρετικό)' })
                  : t({ en: 'Price', el: 'Τιμή' })
              }
            />
          </label>

          <p className="text-xs text-[var(--text-secondary)]">
            {t({ en: 'University', el: 'Πανεπιστήμιο' })}: {universityName || t({ en: 'Not set', el: 'Δεν έχει οριστεί' })}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-primary)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]"
          >
            {t({ en: 'Cancel', el: 'Ακύρωση' })}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            {isSubmitting ? t({ en: 'Saving...', el: 'Αποθήκευση...' }) : t({ en: 'Create', el: 'Δημιουργία' })}
          </button>
        </div>
      </div>
    </div>
  )
}
