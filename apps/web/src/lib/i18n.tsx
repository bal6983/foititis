import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Locale = 'en' | 'el'

export type LocalizedMessage = {
  en: string
  el: string
}

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (message: LocalizedMessage) => string
  formatDate: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string
  formatDateTime: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string
}

const LOCALE_STORAGE_KEY = 'foititis.locale'
const languageTagMap: Record<Locale, string> = {
  en: 'en-US',
  el: 'el-GR',
}

const I18nContext = createContext<I18nContextValue | null>(null)

const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored === 'en' || stored === 'el') return stored
  return 'en'
}

const formatDateValue = (
  locale: Locale,
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(languageTagMap[locale], options).format(date)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (message) => message[locale] ?? message.en,
      formatDate: (value, options) => formatDateValue(locale, value, options),
      formatDateTime: (value, options) =>
        formatDateValue(locale, value, {
          dateStyle: 'medium',
          timeStyle: 'short',
          ...options,
        }),
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider.')
  }
  return context
}
