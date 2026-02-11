import { useI18n } from '../../lib/i18n'
import { tierClassMap, type BadgeItem } from './gamification'

type BadgeComponentProps = {
  badge: BadgeItem
  unlocked: boolean
  lockedReason?: string
}

export default function BadgeComponent({
  badge,
  unlocked,
  lockedReason,
}: BadgeComponentProps) {
  const { t } = useI18n()
  const classes = tierClassMap[badge.tier]

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3 ${classes} ${
        unlocked ? '' : 'opacity-55'
      }`}
      title={
        unlocked
          ? badge.description
          : lockedReason ?? t({ en: 'Locked badge', el: 'Κλειδωμένο σήμα' })
      }
    >
      {!unlocked ? (
        <div className="absolute inset-0 backdrop-blur-[2px]" aria-hidden="true" />
      ) : null}
      <div className="relative flex items-start gap-2">
        <span className="text-lg">{badge.icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{badge.title}</p>
          <p className="line-clamp-2 text-[11px] opacity-90">
            {unlocked ? badge.description : t({ en: 'Locked', el: 'Κλειδωμένο' })}
          </p>
        </div>
      </div>
    </article>
  )
}
