import { cn } from '@/lib/utils'
import { formatINR } from '@/utils/money'

export interface AmountTextProps {
  paise: number
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl'
  sentiment?: 'auto' | 'positive' | 'negative' | 'neutral'
  showSign?: boolean
  forceDecimals?: boolean
  className?: string
}

export function AmountText({
  paise,
  size = 'base',
  sentiment = 'auto',
  showSign = false,
  forceDecimals = false,
  className,
}: AmountTextProps) {
  const isPositive = paise > 0
  const isNegative = paise < 0
  const isZero = paise === 0

  // Resolve color strictly adhering to fintech rule:
  // Green and Red ONLY for money amounts / balance sentiments
  let colorClass = 'text-zinc-900 dark:text-zinc-100'
  if (sentiment === 'positive' || (sentiment === 'auto' && isPositive)) {
    colorClass = 'text-positive dark:text-positive-dark'
  } else if (sentiment === 'negative' || (sentiment === 'auto' && isNegative)) {
    colorClass = 'text-negative dark:text-negative-dark'
  } else if (sentiment === 'neutral' || isZero) {
    colorClass = 'text-zinc-700 dark:text-zinc-300'
  }

  // Font scale: 12 / 14 / 16 / 20 / 28 / 40
  const sizeClasses = {
    xs: 'text-xs font-semibold',       // 12px
    sm: 'text-sm font-semibold',       // 14px
    base: 'text-base font-semibold',   // 16px
    lg: 'text-lg font-bold',           // 20px
    xl: 'text-xl font-bold tracking-tight', // 28px
    '2xl': 'text-2xl font-extrabold tracking-tight', // 40px
  }

  const formatted = formatINR(paise, forceDecimals)
  const displaySign = showSign && isPositive ? '+' : ''

  return (
    <span
      className={cn(
        'tabular-nums inline-block select-text',
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {displaySign}
      {formatted}
    </span>
  )
}
