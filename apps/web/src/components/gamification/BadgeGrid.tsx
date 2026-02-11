import { useI18n } from '../../lib/i18n'
import BadgeComponent from './BadgeComponent'
import { getBadges } from './gamification'

type BadgeGridProps = {
  unlockedBadgeIds: string[]
  lockedReason?: string
}

export default function BadgeGrid({
  unlockedBadgeIds,
  lockedReason,
}: BadgeGridProps) {
  const { locale, t } = useI18n()
  const badges = getBadges(locale)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {t({ en: 'Badges', el: 'Σήματα' })}
        </h3>
        <p className="text-xs text-[var(--text-secondary)]">
          {unlockedBadgeIds.length}/{badges.length} {t({ en: 'unlocked', el: 'ξεκλειδωμένα' })}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => (
          <BadgeComponent
            key={badge.id}
            badge={badge}
            unlocked={unlockedBadgeIds.includes(badge.id)}
            lockedReason={lockedReason}
          />
        ))}
      </div>
    </section>
  )
}
