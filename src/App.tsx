import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSplitzyStore } from '@/store/useSplitzyStore'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { GroupDetail } from '@/components/group/GroupDetail'
import { ActivityScreen } from '@/components/screens/ActivityScreen'
import { SettleScreen } from '@/components/screens/SettleScreen'
import { AccountScreen } from '@/components/screens/AccountScreen'
import { AddExpenseModal } from '@/components/modals/AddExpenseModal'
import { SettleModal } from '@/components/modals/SettleModal'
import { NewGroupModal } from '@/components/modals/NewGroupModal'
import { AuthModal } from '@/components/auth/AuthModal'
import { Avatar } from '@/components/ui/Avatar'
import { Receipt, LogIn } from 'lucide-react'

const queryClient = new QueryClient()

export function AppContent() {
  const {
    activeTab,
    setActiveTab,
    groups,
    selectedGroupId,
    setSelectedGroupId,
    theme,
    currentUser,
    isAuthenticated,
    login,
    setAuthModalOpen,
  } = useSplitzyStore()

  // Sync theme with html root class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Realtime Supabase Auth state synchronization
  useEffect(() => {
    const client = supabase
    if (isSupabaseConfigured && client) {
      const { data: authListener } = client.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            // Load user profile from Supabase
            const { data: profile } = await client
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()

            login({
              id: session.user.id,
              name: profile?.name || session.user.email?.split('@')[0] || 'User',
              email: session.user.email || '',
              upi_id: profile?.upi_id || '',
            })
          }
        }
      )

      return () => {
        authListener.subscription.unsubscribe()
      }
    }
  }, [login])

  // Handle shareable invite link query parameters (?invite=...)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const inviteParam = urlParams.get('invite')
    if (inviteParam) {
      const matchedGroup = groups.find(
        (g) => g.invite_token === inviteParam || g.id === inviteParam
      )
      if (matchedGroup) {
        setSelectedGroupId(matchedGroup.id)
        setActiveTab('groups')
      }
    }
  }, [groups, setSelectedGroupId, setActiveTab])

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || groups[0]

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-zinc-900 dark:text-zinc-100 flex flex-col lg:flex-row antialiased">
      {/* Desktop Left Sidebar (>=1024px) */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Top Navigation Header (<1024px) */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/80 dark:bg-[#121316]/80 backdrop-blur-md border-b border-border-light dark:border-border-dark px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center shadow-xs">
            <Receipt className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold text-accent dark:text-accent-light">
            Splitzy
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'groups' && selectedGroup && (
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 outline-none"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}

          {/* User profile avatar or Sign in button */}
          {isAuthenticated ? (
            <button
              onClick={() => setActiveTab('account')}
              className="p-0.5 rounded-full ring-1 ring-border-light dark:ring-border-dark"
              title="Account"
            >
              <Avatar name={currentUser.name} size="xs" />
            </button>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-accent text-white"
            >
              <LogIn className="w-3 h-3" />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Pane */}
      <main className="flex-1 pb-24 lg:pb-8 overflow-y-auto">
        {activeTab === 'groups' && <GroupDetail />}
        {activeTab === 'activity' && <ActivityScreen />}
        {activeTab === 'settle' && <SettleScreen />}
        {activeTab === 'account' && <AccountScreen />}
      </main>

      {/* Mobile Bottom Tab Bar (<1024px) */}
      <MobileTabBar />

      {/* Modals & Dialogs */}
      <AddExpenseModal />
      <SettleModal />
      <NewGroupModal />
      <AuthModal />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
