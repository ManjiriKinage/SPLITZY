import { useSplitzyStore } from '@/store/useSplitzyStore'
import { calculateNetBalances, calculateSimplifiedSettlements } from '@/utils/settlement'
import { formatINR } from '@/utils/money'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ArrowRight, ShieldCheck } from 'lucide-react'

export function BalancesTab() {
  const {
    groups,
    selectedGroupId,
    expenses,
    settlements,
    currentUser,
    setActiveSettlement,
    setSettleModalOpen,
  } = useSplitzyStore()

  const group = groups.find((g) => g.id === selectedGroupId)
  const currentUserName = currentUser.name.split(' ')[0] || 'You'

  if (!group) return null

  const groupExpenses = expenses.filter((e) => e.group_id === group.id)
  const groupSettlements = settlements.filter((s) => s.group_id === group.id)
  const balances = calculateNetBalances(group.members, groupExpenses, groupSettlements)
  const simplifiedTransfers = calculateSimplifiedSettlements(balances)

  return (
    <div className="space-y-6">
      {/* Individual Net Balances */}
      <Card>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
          Member Balances
        </h3>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {group.members.map((member) => {
            const bal = balances[member] || 0
            const isUser = member === currentUserName

            return (
              <div
                key={member}
                className="flex items-center justify-between py-3 px-1"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={member} size="sm" />
                  <div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {isUser ? `${member} (You)` : member}
                    </span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {bal > 0 ? 'Gets back' : bal < 0 ? 'Owes' : 'Settled up'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      bal > 0
                        ? 'text-positive dark:text-positive-dark'
                        : bal < 0
                        ? 'text-negative dark:text-negative-dark'
                        : 'text-zinc-400'
                    }`}
                  >
                    {bal > 0 ? `+${formatINR(bal)}` : bal < 0 ? formatINR(bal) : '₹0'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Simplified Settlement Plan */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Simplified Debt Transfers
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Greedy matching resolves all debts in {simplifiedTransfers.length} transfers
            </p>
          </div>
        </div>

        {simplifiedTransfers.length === 0 ? (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-positive-light/20 text-positive text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            Everyone in this group is fully settled up!
          </div>
        ) : (
          <div className="space-y-2.5">
            {simplifiedTransfers.map((transfer) => {
              const userOwes = transfer.from === currentUserName
              const userIsOwed = transfer.to === currentUserName

              return (
                <div
                  key={transfer.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-border-light dark:border-border-dark"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={transfer.from} size="xs" />
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                    <Avatar name={transfer.to} size="xs" />
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      {transfer.from === currentUserName ? 'You' : transfer.from} pays{' '}
                      {transfer.to === currentUserName ? 'You' : transfer.to}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold tabular-nums text-positive dark:text-positive-dark">
                      {formatINR(transfer.amountPaise)}
                    </span>
                    <Button
                      size="sm"
                      variant={userOwes ? 'primary' : 'outline'}
                      className="text-xs h-8 px-3"
                      onClick={() => {
                        setActiveSettlement(transfer)
                        setSettleModalOpen(true)
                      }}
                    >
                      {userOwes ? 'Pay' : userIsOwed ? 'Remind' : 'View'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
