import { useState } from 'react'

type AvatarSize = 'sm' | 'md' | 'lg'

interface AvatarProps {
  url?: string | null
  name?: string | null
  size?: AvatarSize
  online?: boolean
  showRing?: boolean
  className?: string
}

const sizeMap: Record<AvatarSize, { container: string; text: string; online: string }> = {
  sm: { container: 'h-8 w-8', text: 'text-xs', online: 'h-2.5 w-2.5 border' },
  md: { container: 'h-11 w-11', text: 'text-sm', online: 'h-3 w-3 border-2' },
  lg: { container: 'h-14 w-14', text: 'text-lg', online: 'h-3.5 w-3.5 border-2' },
}

export function Avatar({ url, name, size = 'md', online, showRing, className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?'
  const s = sizeMap[size]

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${s.container} flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-400/20 ${showRing ? 'ring-2 ring-[var(--accent)]/40 ring-offset-1 ring-offset-[var(--bg-primary)]' : ''}`}
      >
        <span
          className={`absolute inset-0 flex items-center justify-center font-semibold text-[var(--text-secondary)] ${s.text}`}
        >
          {initial}
        </span>
        {url && !imgError && (
          <img
            src={url}
            alt={name ?? ''}
            onError={() => setImgError(true)}
            className={`relative ${s.container} rounded-full object-cover`}
          />
        )}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 ${s.online} rounded-full border-[var(--bg-primary)] ${online ? 'bg-emerald-400' : 'bg-slate-500'}`}
        />
      )}
    </div>
  )
}
