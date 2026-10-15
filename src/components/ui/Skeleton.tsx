import { cn } from '@/lib/utils'

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80',
        className
      )}
      {...props}
    />
  )
}

export function GroupCardSkeleton() {
  return (
    <div className="bg-card-light dark:bg-card-dark rounded-card p-5 border border-border-light dark:border-border-dark space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

export function ExpenseRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-zinc-100 dark:border-zinc-800/60">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="text-right space-y-1.5">
        <Skeleton className="h-3 w-12 ml-auto" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
    </div>
  )
}
