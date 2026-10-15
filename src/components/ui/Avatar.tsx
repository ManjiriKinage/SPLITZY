import { cn, getInitials, getAvatarColor } from '@/lib/utils'

export interface AvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  colorOverride?: { bg: string; text: string }
}

export function Avatar({
  name,
  size = 'md',
  className,
  colorOverride,
}: AvatarProps) {
  const initials = getInitials(name)
  const colors = colorOverride || getAvatarColor(name)

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold',
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium shrink-0 select-none border border-white/60 dark:border-zinc-800',
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
      title={name}
      aria-label={name}
    >
      {initials}
    </div>
  )
}

export function AvatarStack({
  names,
  max = 3,
  size = 'sm',
  className,
}: {
  names: string[]
  max?: number
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const visible = names.slice(0, max)
  const remaining = names.length - max

  return (
    <div className={cn('flex items-center -space-x-2 overflow-hidden', className)}>
      {visible.map((name, idx) => (
        <Avatar
          key={`${name}-${idx}`}
          name={name}
          size={size}
          className="ring-2 ring-white dark:ring-zinc-900"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 ring-2 ring-white dark:ring-zinc-900',
            size === 'xs' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}
