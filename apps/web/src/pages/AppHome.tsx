import { useI18n } from '../lib/i18n'

export default function AppHome() {
  const { t } = useI18n()

  return (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold">
        {t({ en: 'Dashboard', el: 'Πίνακας' })}
      </h1>
      <p className="text-sm text-slate-600">
        {t({ en: 'Temporary placeholder.', el: 'Προσωρινό περιεχόμενο.' })}
      </p>
    </section>
  )
}
