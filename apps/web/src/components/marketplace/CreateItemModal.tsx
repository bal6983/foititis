import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
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
  const [images, setImages] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  const conditionOptions = [
    { id: 1, label: t({ en: 'Poor', el: 'Ξ ΞΏΞ»Ο ΞΊΞ±ΞΊΞ®' }) },
    { id: 2, label: t({ en: 'Fair', el: 'ΞΞ±ΞΊΞ®' }) },
    { id: 3, label: t({ en: 'Good', el: 'ΞΞ­Ο„ΟΞΉΞ±' }) },
    { id: 4, label: t({ en: 'Very Good', el: 'ΞΞ±Ξ»Ξ®' }) },
    { id: 5, label: t({ en: 'Excellent', el: 'Ξ ΞΏΞ»Ο ΞΊΞ±Ξ»Ξ®' }) },
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
    const limited = nextFiles.slice(0, 6)
    previewUrls.forEach((url) => URL.revokeObjectURL(url))
    setImages(limited)
    setPreviewUrls(limited.map((file) => URL.createObjectURL(file)))
  }

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
      images,
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <div className="glass-card w-full max-w-xl p-5">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {t({ en: 'Create Item', el: 'Ξ”Ξ·ΞΌΞΉΞΏΟ…ΟΞ³Ξ―Ξ±' })}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {t({
                en: 'Unified marketplace for selling and searching.',
                el: 'Ξ•Ξ½ΞΏΟ€ΞΏΞΉΞ·ΞΌΞ­Ξ½ΞΏ marketplace Ξ³ΞΉΞ± Ο€ΟΞ»Ξ·ΟƒΞ· ΞΊΞ±ΞΉ Ξ±Ξ½Ξ±Ξ¶Ξ®Ο„Ξ·ΟƒΞ·.',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-primary)] px-2 py-1 text-xs text-[var(--text-secondary)]"
          >
            {t({ en: 'Close', el: 'ΞΞ»ΞµΞ―ΟƒΞΉΞΌΞΏ' })}
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
                    ? t({ en: 'For Sale', el: 'Ξ ΟΞΏΟ‚ Ξ ΟΞ»Ξ·ΟƒΞ·' })
                    : t({ en: 'Looking For', el: 'Ξ‘Ξ½Ξ±Ξ¶Ξ®Ο„Ξ·ΟƒΞ·' })}
                </button>
              )
            })}
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">
              {t({ en: 'Title', el: 'Ξ¤Ξ―Ο„Ξ»ΞΏΟ‚' })}
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
              {t({ en: 'Description', el: 'Ξ ΞµΟΞΉΞ³ΟΞ±Ο†Ξ®' })}
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
                {t({ en: 'Category', el: 'ΞΞ±Ο„Ξ·Ξ³ΞΏΟΞ―Ξ±' })}
              </span>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="">{t({ en: 'Select category', el: 'Ξ•Ο€Ξ―Ξ»ΞµΞΎΞµ ΞΊΞ±Ο„Ξ·Ξ³ΞΏΟΞ―Ξ±' })}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-[var(--text-secondary)]">
                {t({ en: 'Condition', el: 'ΞΞ±Ο„Ξ¬ΟƒΟ„Ξ±ΟƒΞ·' })}
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
                <option value="">{t({ en: 'Select condition', el: 'Ξ•Ο€Ξ―Ξ»ΞµΞΎΞµ ΞΊΞ±Ο„Ξ¬ΟƒΟ„Ξ±ΟƒΞ·' })}</option>
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
              {t({ en: 'Price', el: 'Ξ¤ΞΉΞΌΞ®' })} {type === 'want' ? t({ en: '(optional)', el: '(Ο€ΟΞΏΞ±ΞΉΟΞµΟ„ΞΉΞΊΟ)' }) : ''}
            </span>
            <input
              type="text"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
              placeholder={
                type === 'want'
                  ? t({ en: 'Budget (optional)', el: 'Ξ ΟΞΏΟ‹Ο€ΞΏΞ»ΞΏΞ³ΞΉΟƒΞΌΟΟ‚ (Ο€ΟΞΏΞ±ΞΉΟΞµΟ„ΞΉΞΊΟ)' })
                  : t({ en: 'Price', el: 'Ξ¤ΞΉΞΌΞ®' })
              }
            />
          </label>

          <p className="text-xs text-[var(--text-secondary)]">
            {t({ en: 'University', el: 'Ξ Ξ±Ξ½ΞµΟ€ΞΉΟƒΟ„Ξ®ΞΌΞΉΞΏ' })}: {universityName || t({ en: 'Not set', el: 'Ξ”ΞµΞ½ Ξ­Ο‡ΞµΞΉ ΞΏΟΞΉΟƒΟ„ΞµΞ―' })}
          </p>

          <label className="block space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">
              {t({ en: 'Photos (optional)', el: 'Ξ¦Ο‰Ο„ΞΏΞ³ΟΞ±Ο†Ξ―ΞµΟ‚ (Ο€ΟΞΏΞ±ΞΉΟΞµΟ„ΞΉΞΊΟ)' })}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onImagesChange}
              className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
            {previewUrls.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {previewUrls.map((url) => (
                  <img key={url} src={url} alt="preview" className="h-16 w-full rounded-lg object-cover" />
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
            {t({ en: 'Cancel', el: 'Ξ‘ΞΊΟΟΟ‰ΟƒΞ·' })}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            {isSubmitting ? t({ en: 'Saving...', el: 'Ξ‘Ο€ΞΏΞΈΞ®ΞΊΞµΟ…ΟƒΞ·...' }) : t({ en: 'Create', el: 'Ξ”Ξ·ΞΌΞΉΞΏΟ…ΟΞ³Ξ―Ξ±' })}
          </button>
        </div>
      </div>
    </div>
  )
}

