import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-card-light dark:bg-card-dark rounded-card p-5 shadow-soft border border-border-light dark:border-border-dark transition-all duration-200',
          hoverable &&
            'hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export const CardHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props}>
    {children}
  </div>
)

export const CardTitle = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    className={cn(
      'text-base font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-100',
      className
    )}
    {...props}
  >
    {children}
  </h3>
)

export const CardDescription = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn('text-xs text-zinc-500 dark:text-zinc-400 mt-1', className)}
    {...props}
  >
    {children}
  </p>
)
