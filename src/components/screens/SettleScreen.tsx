import { useState } from 'react'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { calculateNetBalances, calculateSimplifiedSettlements } from '@/utils/settlement'
import { formatINR } from '@/utils/money'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { ArrowRight, CheckCircle2, Clock, ShieldCheck, CreditCard } from 'lucide-react'

export function SettleScreen() {
  const {
    groups,
    expenses,
    settlements,
    currentUser,
    setActiveSettlement,
    setSettleModalOpen,
    confirmSettlementReceived,
  } = useSplitzyStore()

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const currentUserName = currentUser.name.split(' ')[0] || 'You'

  // Calculate all transfers across all groups
  const allTransfers: Array<{
    groupId: string
    groupName: string
    from: string
    to: string
    amountPaise: number
    id: string
  }> = []

  let totalNetBalancePaise = 0

  for (const group of groups) {
    const groupExpenses = expenses.filter((e) => e.group_id === group.id)
    const groupSettlements = settlements.filter((s) => s.group_id === group.id)
    const balances = calculateNetBalances(group.members, groupExpenses, groupSettlements)
    const userBal = balances[currentUserName] || 0
    totalNetBalancePaise += userBal

    const simplified = calculateSimplifiedSettlements(balances)
    for (const t of simplified) {
      allTransfers.push({
        ...t,
        groupId: group.id,
        groupName: group.name,
      })
    }
  }

  // Filter transfers where current user is debtor or creditor
  const myPendingTransfers = allTransfers.filter(
    (t) => t.from === currentUserName || t.to === currentUserName
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header & Overall Net Balance */}
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          Settle Up
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Instant UPI payments, payment confirmations, and historical transfers
        </p>

        <div className="pt-2">
          <span className="text-xs font-semibold text-zinc-400 block">Overall balance</span>
          {totalNetBalancePaise > 0 ? (
            <h2 className="text-3xl font-extrabold tracking-tight text-positive dark:text-positive-dark">
              You are owed {formatINR(totalNetBalancePaise)}
            </h2>
          ) : totalNetBalancePaise < 0 ? (
            <h2 className="text-3xl font-extrabold tracking-tight text-negative dark:text-negative-dark">
              You owe {formatINR(Math.abs(totalNetBalancePaise))}
            </h2>
          ) : (
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-700 dark:text-zinc-300">
              All settled up across all groups
            </h2>
          )}
        </div>
      </div>

      {/* Tabs: Action Required vs Payment History */}
      <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl inline-flex items-center">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'pending'
              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          Action Needed ({myPendingTransfers.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'history'
              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400'
          }`}
        >
          Payment History ({settlements.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {myPendingTransfers.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="w-6 h-6 text-positive" />}
              title="You have no pending payments"
              description="All your group balances are cleared. There are no simplified transfers waiting for you."
            />
          ) : (
            <Card className="p-0 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {myPendingTransfers.map((transfer) => {
                const userOwes = transfer.from === currentUserName

                return (
                  <div
                    key={transfer.id}
                    className="flex items-center justify-between p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <Avatar name={transfer.from} size="sm" />
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                      <Avatar name={transfer.to} size="sm" />
                      <div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {userOwes ? 'You pay' : transfer.from} → {userOwes ? transfer.to : 'You'}
                        </div>
                        <span className="text-xs text-accent font-medium">
                          {transfer.groupName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold tabular-nums text-positive dark:text-positive-dark">
                        {formatINR(transfer.amountPaise)}
                      </span>

                      <Button
                        size="sm"
                        variant={userOwes ? 'primary' : 'outline'}
                        className="h-8 px-4 text-xs font-semibold"
                        onClick={() => {
                          setActiveSettlement({
                            id: transfer.id,
                            from: transfer.from,
                            to: transfer.to,
                            amountPaise: transfer.amountPaise,
                          })
                          setSettleModalOpen(true)
                        }}
                      >
                        {userOwes ? 'Pay with UPI' : 'Remind via UPI'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {settlements.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="w-6 h-6" />}
              title="No settlement history"
              description="Completed or pending payments will show up here."
            />
          ) : (
            <Card className="p-0 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {settlements.map((s) => {
                const group = groups.find((g) => g.id === s.group_id)

                let statusBadge = (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                )
                if (s.status === 'paid') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent bg-accent/15 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Paid (Unconfirmed)
                    </span>
                  )
                } else if (s.status === 'confirmed') {
                  statusBadge = (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-positive bg-positive-light px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                    </span>
                  )
                }

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={s.payer} size="sm" />
                      <div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {s.payer} paid {s.receiver}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                          <span>{group?.name || 'Group'}</span>
                          <span>•</span>
                          <span>{s.date}</span>
                          {s.upi_ref && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{s.upi_ref}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100 block">
                          {formatINR(s.amount_paise)}
                        </span>
                        {statusBadge}
                      </div>

                      {s.status === 'paid' && s.receiver === currentUserName && (
                        <Button
                          size="sm"
                          variant="primary"
                          className="h-7 text-xs bg-positive hover:bg-positive-hover text-white"
                          onClick={() => confirmSettlementReceived(s.id)}
                        >
                          Confirm
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
