import { useState } from 'react'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { calculateNetBalances, calculateSimplifiedSettlements } from '@/utils/settlement'
import { formatINR } from '@/utils/money'
import { Avatar, AvatarStack } from '@/components/ui/Avatar'
import { AmountText } from '@/components/ui/AmountText'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { BalancesTab } from './BalancesTab'
import { InsightsTab } from './InsightsTab'
import { InviteModal } from '@/components/modals/InviteModal'
import {
  UserPlus,
  Plus,
  MoreVertical,
  Download,
  Share2,
  LogOut,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react'

export function GroupDetail() {
  const {
    groups,
    selectedGroupId,
    expenses,
    settlements,
    currentUser,
    groupSegmentTab,
    setGroupSegmentTab,
    setAddExpenseOpen,
    setActiveSettlement,
    setSettleModalOpen,
    leaveGroup,
  } = useSplitzyStore()

  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const group = groups.find((g) => g.id === selectedGroupId) || groups[0]
  const currentUserName = currentUser.name.split(' ')[0] || 'You'

  if (!group) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<Receipt className="w-6 h-6" />}
          title="No Group Selected"
          description="Select a group from the sidebar or create a new one to begin tracking expenses."
        />
      </div>
    )
  }

  // Calculate balances & settlements for this group
  const groupExpenses = expenses.filter((e) => e.group_id === group.id)
  const groupSettlements = settlements.filter((s) => s.group_id === group.id)
  const balances = calculateNetBalances(group.members, groupExpenses, groupSettlements)
  const userBalance = balances[currentUserName] || 0
  const simplifiedTransfers = calculateSimplifiedSettlements(balances)

  // Calculate total trip expenditure
  const totalTripPaise = groupExpenses.reduce((sum, e) => sum + e.amount_paise, 0)

  // Calculate category percentage summary for the right rail
  const categoryPaiseMap: Record<string, number> = {}
  for (const exp of groupExpenses) {
    categoryPaiseMap[exp.category] = (categoryPaiseMap[exp.category] || 0) + exp.amount_paise
  }
  const topCategories = Object.entries(categoryPaiseMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, paise]) => {
      const pct = totalTripPaise > 0 ? Math.round((paise / totalTripPaise) * 100) : 0
      return `${cat} ${pct}%`
    })
    .join(' · ')

  // Group expenses by date (TODAY, YESTERDAY, or formatted date)
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const groupedExpenses: Record<string, typeof groupExpenses> = {}
  for (const exp of groupExpenses) {
    let dateLabel = exp.date
    if (exp.date === todayStr) {
      dateLabel = 'TODAY'
    } else if (exp.date === yesterdayStr) {
      dateLabel = 'YESTERDAY'
    }
    if (!groupedExpenses[dateLabel]) {
      groupedExpenses[dateLabel] = []
    }
    groupedExpenses[dateLabel].push(exp)
  }

  // Handle Export CSV
  const handleExportCSV = () => {
    const headers = ['Title', 'Category', 'Date', 'Paid By', 'Amount (INR)', 'Your Share (INR)']
    const rows = groupExpenses.map((exp) => [
      `"${exp.title}"`,
      exp.category,
      exp.date,
      exp.paid_by,
      (exp.amount_paise / 100).toFixed(2),
      ((exp.splits[currentUserName] || 0) / 100).toFixed(2),
    ])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${group.name.replace(/\s+/g, '_')}_expenses.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setShowMenu(false)
  }

  return (
    <div className="flex-1 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Center Pane (8 cols on desktop) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Header: Group Name, Avatars, Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {group.name}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <AvatarStack names={group.members} size="xs" />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {group.members.length} members
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsInviteOpen(true)}
                  className="rounded-full px-4"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Invite
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAddExpenseOpen(true)}
                  className="rounded-full px-5 bg-accent hover:bg-accent-hover"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add expense
                </Button>

                {/* Overflow Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                    aria-label="More options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-zinc-900 shadow-dialog border border-border-light dark:border-border-dark py-1.5 z-30">
                      <button
                        onClick={handleExportCSV}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
                        Export CSV
                      </button>
                      <button
                        onClick={() => {
                          window.print()
                          setShowMenu(false)
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <Download className="w-3.5 h-3.5 text-zinc-400" />
                        Print / PDF Statement
                      </button>
                      <button
                        onClick={() => {
                          const url = `https://wa.me/?text=${encodeURIComponent(`Check our "${group.name}" balance sheet on Splitzy!`)}`
                          window.open(url, '_blank')
                          setShowMenu(false)
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                        WhatsApp Summary
                      </button>
                      <div className="border-t border-border-light dark:border-border-dark my-1" />
                      <button
                        onClick={() => {
                          if (confirm(`Leave ${group.name}?`)) {
                            leaveGroup(group.id)
                          }
                          setShowMenu(false)
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-negative hover:bg-negative-light/20"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Leave group
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Plain-Language Balance Summary Callout */}
            <div className="py-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                Your balance
              </span>
              {userBalance > 0 ? (
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-positive dark:text-positive-dark">
                  You are owed {formatINR(userBalance)}
                </h2>
              ) : userBalance < 0 ? (
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-negative dark:text-negative-dark">
                  You owe {formatINR(Math.abs(userBalance))}
                </h2>
              ) : (
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-700 dark:text-zinc-300">
                  You are all settled up
                </h2>
              )}
            </div>

            {/* Secondary Segmented Control: Expenses | Balances | Insights */}
            <div className="bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl inline-flex items-center">
              {(['expenses', 'balances', 'insights'] as const).map((tab) => {
                const labels = {
                  expenses: 'Expenses',
                  balances: 'Balances',
                  insights: 'Insights',
                }
                const isCurrent = groupSegmentTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setGroupSegmentTab(tab)}
                    className={`px-5 py-2 text-xs font-semibold rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                )
              })}
            </div>

            {/* Tab Views */}
            {groupSegmentTab === 'expenses' && (
              <div className="space-y-6">
                {groupExpenses.length === 0 ? (
                  <EmptyState
                    icon={<Receipt className="w-6 h-6" />}
                    title="No expenses yet"
                    description="Tap 'Add expense' to record your first meal, cab ride, or stay in this group."
                    actionLabel="Add first expense"
                    onAction={() => setAddExpenseOpen(true)}
                  />
                ) : (
                  Object.entries(groupedExpenses).map(([dateLabel, dateExpenses]) => (
                    <div key={dateLabel} className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                        {dateLabel}
                      </div>

                      <div className="bg-white dark:bg-[#17181B] rounded-card shadow-soft border border-border-light dark:border-border-dark divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden">
                        {dateExpenses.map((exp) => {
                          const isPayerMe = exp.paid_by === currentUserName
                          const mySharePaise = exp.splits[currentUserName] || 0
                          const totalPaidPaise = exp.amount_paise

                          // Net share for current user:
                          // If I paid: I lent (totalPaid - myShare)
                          // If someone else paid: I owe myShare
                          const lentPaise = totalPaidPaise - mySharePaise
                          const owePaise = mySharePaise

                          return (
                            <div
                              key={exp.id}
                              className="flex items-center justify-between p-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
                            >
                              <div className="flex items-center gap-3.5">
                                <Avatar name={exp.paid_by} size="md" />
                                <div>
                                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                                    {exp.title}
                                  </h4>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {isPayerMe ? 'You' : exp.paid_by} paid {formatINR(exp.amount_paise)}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                {isPayerMe ? (
                                  lentPaise > 0 ? (
                                    <>
                                      <span className="text-[11px] font-medium text-zinc-400 block">
                                        you lent
                                      </span>
                                      <AmountText
                                        paise={lentPaise}
                                        size="sm"
                                        sentiment="positive"
                                      />
                                    </>
                                  ) : (
                                    <span className="text-xs text-zinc-400">no split</span>
                                  )
                                ) : owePaise > 0 ? (
                                  <>
                                    <span className="text-[11px] font-medium text-zinc-400 block">
                                      you owe
                                    </span>
                                    <AmountText
                                      paise={-owePaise}
                                      size="sm"
                                      sentiment="negative"
                                    />
                                  </>
                                ) : (
                                  <span className="text-xs text-zinc-400">not involved</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {groupSegmentTab === 'balances' && <BalancesTab />}

            {groupSegmentTab === 'insights' && <InsightsTab />}
          </div>

          {/* Right Rail (4 cols on desktop >= 1024px) */}
          <div className="hidden lg:block lg:col-span-4 space-y-6 sticky top-6">
            {/* Settle Up Card */}
            <Card>
              <div className="mb-4">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Settle up
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Simplified to {simplifiedTransfers.length} {simplifiedTransfers.length === 1 ? 'payment' : 'payments'}
                </p>
              </div>

              {simplifiedTransfers.length === 0 ? (
                <p className="text-xs text-zinc-400 py-3 text-center">
                  All debts settled up in this group.
                </p>
              ) : (
                <div className="space-y-3">
                  {simplifiedTransfers.map((transfer) => {
                    const isUserDebtor = transfer.from === currentUserName

                    return (
                      <div
                        key={transfer.id}
                        className="flex items-center justify-between py-1"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={transfer.from} size="sm" />
                          <div>
                            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                              <span className="font-bold">
                                {transfer.from === currentUserName ? 'You' : transfer.from}
                              </span>{' '}
                              pays{' '}
                              <span className="font-bold">
                                {transfer.to === currentUserName ? 'you' : transfer.to}
                              </span>
                            </div>
                            <span className="text-sm font-bold tabular-nums text-positive dark:text-positive-dark">
                              {formatINR(transfer.amountPaise)}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant={isUserDebtor ? 'primary' : 'outline'}
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={() => {
                            setActiveSettlement(transfer)
                            setSettleModalOpen(true)
                          }}
                        >
                          {isUserDebtor ? 'Pay' : 'Remind'}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Trip Total Card */}
            <Card>
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                Trip total
              </span>
              <div className="text-3xl font-extrabold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatINR(totalTripPaise)}
              </div>
              {topCategories && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
                  {topCategories}
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>

      <InviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
    </div>
  )
}
