import { useSplitzyStore } from '@/store/useSplitzyStore'
import { calculateNetBalances } from '@/utils/settlement'
import { formatINR } from '@/utils/money'
import { Avatar } from '@/components/ui/Avatar'
import {
  Users,
  Clock,
  CreditCard,
  User,
  Plus,
  Receipt,
  LogIn,
  LogOut,
} from 'lucide-react'

export function Sidebar() {
  const {
    groups,
    selectedGroupId,
    setSelectedGroupId,
    activeTab,
    setActiveTab,
    expenses,
    settlements,
    currentUser,
    isAuthenticated,
    setAuthModalOpen,
    logout,
    setNewGroupOpen,
  } = useSplitzyStore()

  const currentUserName = currentUser.name.split(' ')[0] || 'You'

  const navItems = [
    { id: 'groups' as const, label: 'Groups', icon: Users },
    { id: 'activity' as const, label: 'Activity', icon: Clock },
    { id: 'settle' as const, label: 'Settle up', icon: CreditCard },
    { id: 'account' as const, label: 'Account', icon: User },
  ]

  return (
    <aside className="w-64 shrink-0 border-r border-border-light dark:border-border-dark bg-white/70 dark:bg-[#121316]/70 backdrop-blur-md flex flex-col justify-between h-screen sticky top-0 px-4 py-5 select-none">
      <div className="space-y-6 overflow-hidden flex flex-col flex-1">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 px-3">
          <div className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm">
            <Receipt className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight text-accent dark:text-accent-light">
            Splitzy
          </span>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Groups Section */}
        <div className="space-y-2 pt-2 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Your Groups
            </span>
          </div>

          <div className="space-y-1 overflow-y-auto pr-1 flex-1">
            {groups.map((group) => {
              const isSelected = selectedGroupId === group.id && activeTab === 'groups'
              const groupExpenses = expenses.filter((e) => e.group_id === group.id)
              const groupSettlements = settlements.filter((s) => s.group_id === group.id)
              const balances = calculateNetBalances(group.members, groupExpenses, groupSettlements)
              const userBalance = balances[currentUserName] || 0

              let balanceBadge = (
                <span className="text-xs font-medium text-zinc-400">Settled</span>
              )
              if (userBalance > 0) {
                balanceBadge = (
                  <span className="text-xs font-semibold tabular-nums text-positive dark:text-positive-dark">
                    +{formatINR(userBalance)}
                  </span>
                )
              } else if (userBalance < 0) {
                balanceBadge = (
                  <span className="text-xs font-semibold tabular-nums text-negative dark:text-negative-dark">
                    {formatINR(userBalance)}
                  </span>
                )
              }

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroupId(group.id)
                    setActiveTab('groups')
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                    isSelected
                      ? 'bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <span className="truncate pr-2">{group.name}</span>
                  {balanceBadge}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom Area: New Group & User Profile / Login status */}
      <div className="pt-3 border-t border-border-light dark:border-border-dark space-y-2.5 shrink-0">
        <button
          onClick={() => setNewGroupOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm font-semibold text-zinc-800 dark:text-zinc-200 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4 text-zinc-500" />
          <span>New group</span>
        </button>

        {/* User Profile Card */}
        {isAuthenticated ? (
          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-border-light dark:border-border-dark flex items-center justify-between">
            <div
              className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
              onClick={() => setActiveTab('account')}
            >
              <Avatar name={currentUser.name} size="xs" />
              <div className="truncate">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block truncate">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-zinc-400 block truncate font-mono">
                  {currentUser.upi_id || currentUser.email}
                </span>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="p-1.5 text-zinc-400 hover:text-negative rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700/60 transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
    </aside>
  )
}
