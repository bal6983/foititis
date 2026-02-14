import { type ChangeEvent, useEffect, useId, useMemo, useState } from 'react'
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

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
  const [conditionRating, setConditionRating] = useState(3)
  const [price, setPrice] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const fileInputId = useId()

  const conditionLabel = useMemo(() => {
    if (conditionRating <= 1) return t({ en: 'Poor', el: 'Πολύ κακή' })
    if (conditionRating === 2) return t({ en: 'Fair', el: 'Κακή' })
    if (conditionRating === 3) return t({ en: 'Good', el: 'Μέτρια' })
    if (conditionRating === 4) return t({ en: 'Very Good', el: 'Καλή' })
    return t({ en: 'Excellent', el: 'Πολύ καλή' })
  }, [conditionRating, t])

  const canSubmit = useMemo(
    () =>
      title.trim() !== '' &&
      description.trim() !== '' &&
      categoryId !== '' &&
      !isSubmitting,
    [categoryId, description, isSubmitting, title],
  )

  useEffect(() => {
    if (open) setType(initialType)
  }, [initialType, open])

  useEffect(() => {
    if (open) return
    setImages([])
    setPreviewUrls((current) => {
      current.forEach((url) => URL.revokeObjectURL(url))
      return current.length === 0 ? current : []
    })
  }, [open])

  const onImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    )
    event.target.value = ''
    if (nextFiles.length === 0) return

    const limited = nextFiles
      .filter((file) => file.size <= 8 * 1024 * 1024)
      .slice(0, 6)
    if (limited.length === 0) return

    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setImages(limited)
    setPreviewUrls(limited.map((file) => URL.createObjectURL(file)))
  }

  const submit = async () => {
    if (!canSubmit) return
    const normalizedPrice = price.replace(/[^\d.,]/g, '').trim()

    await onSubmit({
      type,
      title: title.trim(),
      description: description.trim(),
      categoryId,
      conditionRating: clamp(conditionRating, 1, 5),
      price: normalizedPrice === '' ? null : normalizedPrice,
      universityName,
      images,
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <div className="glass-card w-full max-w-2xl p-5">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t({ en: 'Create listing', el: 'Δημιουργία αγγελίας' })}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {t({
                en: 'Post your item with clear details and photos.',
                el: 'Ανέβασε την αγγελία σου με περιγραφή και φωτογραφίες.',
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-primary)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
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
                    ? t({ en: 'For sale', el: 'Προς πώληση' })
                    : t({ en: 'Wanted', el: 'Ζητείται' })}
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
                <option value="">
                  {t({ en: 'Select category', el: 'Επίλεξε κατηγορία' })}
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-[var(--text-secondary)]">
                {t({ en: 'Price', el: 'Τιμή' })}{' '}
                {type === 'want'
                  ? t({ en: '(optional)', el: '(προαιρετικό)' })
                  : ''}
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">
                  €
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] pl-7 pr-3 py-2 text-sm text-[var(--text-primary)]"
                  placeholder={t({ en: 'e.g. 25', el: 'π.χ. 25' })}
                />
              </div>
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">
              {t({ en: 'Condition', el: 'Κατάσταση' })}
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={conditionRating}
              onChange={(event) =>
                setConditionRating(clamp(Number(event.target.value), 1, 5))
              }
              className="w-full accent-cyan-300"
            />
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              {conditionLabel}
            </p>
          </label>

          <p className="text-xs text-[var(--text-secondary)]">
            {t({ en: 'University', el: 'Πανεπιστήμιο' })}:{' '}
            {universityName || t({ en: 'Not set', el: 'Δεν έχει οριστεί' })}
          </p>

          <label className="block space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">
              {t({ en: 'Photos (optional)', el: 'Φωτογραφίες (προαιρετικό)' })}
            </span>
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              multiple
              onChange={onImagesChange}
              className="sr-only"
            />
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] p-2">
              <label
                htmlFor={fileInputId}
                className="inline-flex cursor-pointer items-center rounded-lg border border-[var(--border-primary)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-cyan-300/50"
              >
                {t({ en: 'Choose files', el: 'Επιλογή αρχείων' })}
              </label>
              <p className="truncate text-xs text-[var(--text-secondary)]">
                {images.length > 0
                  ? images.map((file) => file.name).join(', ')
                  : t({ en: 'No file selected', el: 'Δεν επιλέχθηκε κανένα αρχείο.' })}
              </p>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {t({
                en: 'Up to 6 photos. Large images are automatically compressed.',
                el: 'Έως 6 φωτογραφίες. Οι μεγάλες εικόνες συμπιέζονται αυτόματα.',
              })}
            </p>
            {previewUrls.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {previewUrls.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt="preview"
                    className="h-20 w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            ) : null}
          </label>
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
            {isSubmitting
              ? t({ en: 'Saving...', el: 'Αποθήκευση...' })
              : t({ en: 'Create', el: 'Δημιουργία' })}
          </button>
        </div>
      </div>
    </div>
  )
}
