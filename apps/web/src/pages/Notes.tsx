import LockedFeature from '../components/LockedFeature'
import { useI18n } from '../lib/i18n'

export default function Notes() {
  const { t } = useI18n()
  return <LockedFeature title={t({ en: 'Notes', el: 'Σημειώσεις' })} />
}
