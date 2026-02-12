import { useCallback } from 'react'
import { useI18n, type Locale } from '../lib/i18n'

const UNITS: Array<{ max: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { max: 60, divisor: 1, unit: 'second' },
  { max: 3600, divisor: 60, unit: 'minute' },
  { max: 86400, divisor: 3600, unit: 'hour' },
  { max: 604800, divisor: 86400, unit: 'day' },
  { max: 2592000, divisor: 604800, unit: 'week' },
  { max: 31536000, divisor: 2592000, unit: 'month' },
  { max: Infinity, divisor: 31536000, unit: 'year' },
]

const LANG_MAP: Record<Locale, string> = {
  en: 'en-US',
  el: 'el-GR',
}

function formatRelative(date: string | Date, locale: Locale): string {
  const now = Date.now()
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime()
  const diff = Math.round((then - now) / 1000)
  const absDiff = Math.abs(diff)

  for (const { max, divisor, unit } of UNITS) {
    if (absDiff < max) {
      const value = Math.round(diff / divisor)
      const rtf = new Intl.RelativeTimeFormat(LANG_MAP[locale], { numeric: 'auto' })
      return rtf.format(value, unit)
    }
  }

  return ''
}

export function useTimeAgo() {
  const { locale } = useI18n()

  const timeAgo = useCallback(
    (date: string | Date) => formatRelative(date, locale),
    [locale]
  )

  return timeAgo
}
