import { useI18n } from '../lib/i18n'

export default function NotFound() {
  const { t } = useI18n()

  return (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold">
        {t({ en: 'Not found', el: 'Δεν βρέθηκε' })}
      </h1>
      <p className="text-sm text-slate-600">
        {t({
          en: 'The page you requested does not exist.',
          el: 'Η σελίδα που ζήτησες δεν υπάρχει.',
        })}
      </p>
    </section>
  )
}
