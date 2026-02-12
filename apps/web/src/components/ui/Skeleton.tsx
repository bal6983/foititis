interface SkeletonProps {
  width?: string
  height?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
  className?: string
}

const roundedMap = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
}

export function Skeleton({ width, height, rounded = 'md', className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-[var(--surface-soft)] ${roundedMap[rounded]} ${className}`}
      style={{ width, height }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="social-card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Skeleton width="44px" height="44px" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton width="40%" height="14px" />
          <Skeleton width="20%" height="12px" />
        </div>
      </div>
      <Skeleton width="100%" height="16px" />
      <Skeleton width="75%" height="16px" />
      <div className="flex gap-4 pt-2">
        <Skeleton width="60px" height="28px" rounded="full" />
        <Skeleton width="60px" height="28px" rounded="full" />
      </div>
    </div>
  )
}
