import type { ReactNode } from 'react'

type SectionCardProps = {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}

export default function SectionCard({
  title,
  subtitle,
  action,
  children,
}: SectionCardProps) {
  return (
    <section className="glass-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

