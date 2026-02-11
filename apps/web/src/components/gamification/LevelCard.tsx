import { useI18n } from '../../lib/i18n'
import { getLevelInfo } from './gamification'

type LevelCardProps = {
  name: string
  avatarUrl?: string | null
  totalXp: number
  compact?: boolean
}

export default function LevelCard({
  name,
  avatarUrl,
  totalXp,
  compact = false,
}: LevelCardProps) {
  const { locale, t } = useI18n()
  const levelInfo = getLevelInfo(locale, totalXp)
  const initials = name.trim().charAt(0).toUpperCase() || 'S'
  const remaining = Math.max(0, levelInfo.nextLevelXp - levelInfo.currentXp)

  return (
    <section className={compact ? 'panel-card p-4 space-y-3' : 'glass-card p-5 space-y-4'}>
      <header className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-soft)]">
          <span className="absolute inset-0 grid place-items-center text-sm font-bold text-[var(--text-primary)]">
            {initials}
          </span>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="relative h-11 w-11 rounded-xl object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {t({ en: 'Level', el: '???????' })} {levelInfo.level} ? {levelInfo.title}
          </p>
        </div>
      </header>

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
            style={{ width: `${levelInfo.progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          {levelInfo.progressPercent.toFixed(0)}% {t({ en: 'to next level', el: '??? ?? ??????? ???????' })} ? {remaining} {t({ en: 'XP left', el: 'XP ?????????' })}
        </p>
      </div>
    </section>
  )
}
