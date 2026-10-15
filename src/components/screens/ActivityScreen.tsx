import { useState } from 'react'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { Card } from '@/components/ui/Card'
import { formatINR } from '@/utils/money'
import { EmptyState } from '@/components/ui/EmptyState'
import { Clock, ArrowRight, PlusCircle, CheckCircle, UserCheck } from 'lucide-react'

export function ActivityScreen() {
  const { activities, groups } = useSplitzyStore()
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all')

  const filteredActivities = activities.filter((act) => {
    if (selectedGroupFilter === 'all') return true
    return act.groupId === selectedGroupFilter
  })

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'expense_created':
        return <PlusCircle className="w-4 h-4 text-accent" />
      case 'settlement_initiated':
        return <ArrowRight className="w-4 h-4 text-amber-500" />
      case 'settlement_paid':
      case 'settlement_confirmed':
        return <CheckCircle className="w-4 h-4 text-positive" />
      case 'member_joined':
        return <UserCheck className="w-4 h-4 text-zinc-500" />
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />
    }
  }

  const formatActivityTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Recent Activity
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Realtime audit log of expenses, settlements, and member changes
          </p>
        </div>

        {/* Group Filter */}
        <select
          value={selectedGroupFilter}
          onChange={(e) => setSelectedGroupFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 outline-none"
        >
          <option value="all">All Groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {filteredActivities.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="No activity yet"
          description="When you or your group members add expenses or make UPI settlements, they will appear here in chronological order."
        />
      ) : (
        <Card className="p-0 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {filteredActivities.map((act) => (
            <div
              key={act.id}
              className="flex items-center justify-between p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  {getActivityIcon(act.type)}
                </div>
                <div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {act.actor}
                    </span>{' '}
                    {act.details}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                    <span className="font-medium text-accent">{act.groupName}</span>
                    <span>•</span>
                    <span>{formatActivityTime(act.timestamp)}</span>
                  </div>
                </div>
              </div>

              {act.amountPaise && (
                <div className="text-right">
                  <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatINR(act.amountPaise)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
