import { useSplitzyStore } from '@/store/useSplitzyStore'
import { Users, Clock, CreditCard, User, Plus } from 'lucide-react'

export function MobileTabBar() {
  const { activeTab, setActiveTab, setAddExpenseOpen } = useSplitzyStore()

  const tabs = [
    { id: 'groups' as const, label: 'Groups', icon: Users },
    { id: 'activity' as const, label: 'Activity', icon: Clock },
    { id: 'settle' as const, label: 'Settle', icon: CreditCard },
    { id: 'account' as const, label: 'Account', icon: User },
  ]

  const showFab = activeTab === 'groups'

  return (
    <>
      {/* Mobile Extended Floating Action Button on Groups screen */}
      {showFab && (
        <div className="fixed bottom-20 right-4 z-40 lg:hidden">
          <button
            onClick={() => setAddExpenseOpen(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-accent hover:bg-accent-hover active:scale-95 text-white font-semibold text-sm rounded-full shadow-lg shadow-accent/25 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Add expense</span>
          </button>
        </div>
      )}

      {/* 4-Tab Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#121316]/90 backdrop-blur-md border-t border-border-light dark:border-border-dark flex items-center justify-around py-2 px-4 lg:hidden touch-target">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive
                  ? 'text-accent font-semibold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[11px] leading-none">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
