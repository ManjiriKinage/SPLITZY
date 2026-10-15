import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Group,
  Expense,
  Settlement,
  UserProfile,
  ActivityItem,
} from '@/types'
import { SimplifiedTransfer } from '@/utils/settlement'

interface SplitzyState {
  // User Profile & Auth
  currentUser: UserProfile
  isAuthenticated: boolean
  isAuthModalOpen: boolean
  setAuthModalOpen: (open: boolean) => void
  login: (user: UserProfile) => void
  logout: () => void
  updateProfile: (profile: Partial<UserProfile>) => void

  // Groups
  groups: Group[]
  selectedGroupId: string
  setSelectedGroupId: (id: string) => void
  createGroup: (name: string, category: string, members: string[]) => Group
  leaveGroup: (groupId: string) => void

  // Expenses
  expenses: Expense[]
  addExpense: (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => Expense
  updateExpense: (id: string, expense: Partial<Expense>) => void
  deleteExpense: (id: string) => void

  // Settlements
  settlements: Settlement[]
  createSettlement: (
    groupId: string,
    payer: string,
    receiver: string,
    amountPaise: number,
    receiverUpiId?: string
  ) => Settlement
  markSettlementPaid: (settlementId: string, upiRef?: string) => void
  confirmSettlementReceived: (settlementId: string) => void

  // Activity Feed
  activities: ActivityItem[]
  addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => void

  // UI state
  activeTab: 'groups' | 'activity' | 'settle' | 'account'
  setActiveTab: (tab: 'groups' | 'activity' | 'settle' | 'account') => void
  groupSegmentTab: 'expenses' | 'balances' | 'insights'
  setGroupSegmentTab: (tab: 'expenses' | 'balances' | 'insights') => void

  // Modals / Sheets
  isAddExpenseOpen: boolean
  setAddExpenseOpen: (open: boolean) => void
  isSettleModalOpen: boolean
  setSettleModalOpen: (open: boolean) => void
  activeSettlement: SimplifiedTransfer | null
  setActiveSettlement: (transfer: SimplifiedTransfer | null) => void
  isNewGroupOpen: boolean
  setNewGroupOpen: (open: boolean) => void

  // Dark Mode Theme
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

// Initial mockup data matching the reference screenshots exactly
const INITIAL_USER: UserProfile = {
  id: 'user-manjiri',
  name: 'Manjiri Kinage',
  email: 'manjiri@splitzy.app',
  upi_id: 'manjirikinage2005@oksbi',
  avatar_color: '#4F46E5',
}

const INITIAL_GROUPS: Group[] = [
  {
    id: 'group-goa',
    code: 'GOA2026',
    name: 'Goa Trip',
    category: 'Travel',
    color: '#4F46E5',
    members: ['Manjiri', 'Om', 'Aarav'],
    created_by: 'Manjiri',
    created_by_id: 'user-manjiri',
    invite_token: 'goa-trip-invite',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'group-flat',
    code: 'FLAT402',
    name: 'Flat 402',
    category: 'Flatmates',
    color: '#0D9488',
    members: ['Manjiri', 'Rohan', 'Pooja'],
    created_by: 'Rohan',
    invite_token: 'flat-402-invite',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'group-lunch',
    code: 'LUNCH10',
    name: 'Office lunch',
    category: 'Work',
    color: '#EA580C',
    members: ['Manjiri', 'Neha', 'Kunal'],
    created_by: 'Neha',
    invite_token: 'office-lunch-invite',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const TODAY_STR = new Date().toISOString().split('T')[0]
const YESTERDAY_STR = new Date(Date.now() - 86400000).toISOString().split('T')[0]

const INITIAL_EXPENSES: Expense[] = [
  // Goa Trip Expenses
  // 1. Scooter rental: Manjiri paid ₹1,200 (120000 paise), split 3 ways (40000 each). Manjiri lent ₹800.
  {
    id: 'exp-scooter',
    group_id: 'group-goa',
    title: 'Scooter rental',
    amount_paise: 120000,
    category: 'Travel',
    date: TODAY_STR,
    paid_by: 'Manjiri',
    split_type: 'equal',
    splits: { Manjiri: 40000, Om: 40000, Aarav: 40000 },
    created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  // 2. Beach shack dinner: Om paid ₹900 (90000 paise). But wait, Om reimburses Manjiri or split custom!
  // To reach Settle up: Om owes Manjiri ₹1,040 and Aarav owes Manjiri ₹200:
  // Scooter: Om owes Manjiri 400, Aarav owes Manjiri 400.
  // Airport cab: Aarav paid 1500 (splits: Manjiri 500, Om 500, Aarav 500). Manjiri owes Aarav 500, Om owes Aarav 500.
  // Beach shack dinner: Manjiri paid ₹900 for Om or Om paid ₹900 for Beach shack dinner:
  // Let's configure exact expenses such that net balances are:
  // Manjiri: +₹1,240, Om: -₹1,040, Aarav: -₹200.
  // (Total net balances: +1240 - 1040 - 200 = 0)
  {
    id: 'exp-beach-shack',
    group_id: 'group-goa',
    title: 'Beach shack dinner',
    amount_paise: 90000,
    category: 'Food',
    date: TODAY_STR,
    paid_by: 'Om',
    split_type: 'equal',
    // Om paid 900, but Manjiri lent 600 or Om owes 1040
    splits: { Manjiri: 0, Om: 90000, Aarav: 0 },
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-villa',
    group_id: 'group-goa',
    title: 'Villa advance booking',
    amount_paise: 387000, // ₹3,870
    category: 'Stay',
    date: TODAY_STR,
    paid_by: 'Manjiri',
    split_type: 'equal',
    splits: { Manjiri: 129000, Om: 129000, Aarav: 129000 },
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-airport-cab',
    group_id: 'group-goa',
    title: 'Airport cab',
    amount_paise: 150000, // ₹1,500
    category: 'Travel',
    date: YESTERDAY_STR,
    paid_by: 'Aarav',
    split_type: 'equal',
    splits: { Manjiri: 50000, Om: 50000, Aarav: 50000 },
    created_at: new Date(Date.now() - 28 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exp-groceries',
    group_id: 'group-goa',
    title: 'Drinks & beach snacks',
    amount_paise: 648000, // ₹6,480
    category: 'Food',
    date: YESTERDAY_STR,
    paid_by: 'Manjiri',
    split_type: 'equal',
    splits: { Manjiri: 216000, Om: 216000, Aarav: 216000 },
    created_at: new Date(Date.now() - 32 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Flat 402 expense (where Manjiri owes ₹860)
  {
    id: 'exp-flat-wifi',
    group_id: 'group-flat',
    title: 'High-speed Fiber WiFi',
    amount_paise: 258000,
    category: 'Bills',
    date: TODAY_STR,
    paid_by: 'Rohan',
    split_type: 'equal',
    splits: { Manjiri: 86000, Rohan: 86000, Pooja: 86000 },
    created_at: new Date(Date.now() - 10 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const INITIAL_SETTLEMENTS: Settlement[] = [
  // Previous confirmed settlement for Goa Trip adjusting Om's balance
  {
    id: 'settle-om-manjiri-prev',
    group_id: 'group-goa',
    payer: 'Om',
    receiver: 'Manjiri',
    amount_paise: 281000,
    status: 'confirmed',
    date: YESTERDAY_STR,
    payer_upi_id: 'om@paytm',
    receiver_upi_id: 'manjirikinage2005@oksbi',
    upi_ref: 'UPI202610149021',
    paid_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    confirmed_at: new Date(Date.now() - 23 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  // Office lunch settled settlement
  {
    id: 'settle-office-lunch',
    group_id: 'group-lunch',
    payer: 'Manjiri',
    receiver: 'Neha',
    amount_paise: 45000,
    status: 'confirmed',
    date: TODAY_STR,
    payer_upi_id: 'manjirikinage2005@oksbi',
    receiver_upi_id: 'neha@icici',
    upi_ref: 'UPI202610150912',
    paid_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
]

const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    type: 'expense_created',
    groupId: 'group-goa',
    groupName: 'Goa Trip',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    actor: 'Om',
    details: 'added "Beach shack dinner"',
    amountPaise: 90000,
  },
  {
    id: 'act-2',
    type: 'expense_created',
    groupId: 'group-goa',
    groupName: 'Goa Trip',
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    actor: 'Manjiri',
    details: 'added "Scooter rental"',
    amountPaise: 120000,
  },
  {
    id: 'act-3',
    type: 'settlement_confirmed',
    groupId: 'group-goa',
    groupName: 'Goa Trip',
    timestamp: new Date(Date.now() - 23 * 3600000).toISOString(),
    actor: 'Manjiri',
    details: 'confirmed ₹2,810 received from Om',
    amountPaise: 281000,
  },
]

export const useSplitzyStore = create<SplitzyState>()(
  persist(
    (set, get) => ({
      currentUser: INITIAL_USER,
      isAuthenticated: true,
      isAuthModalOpen: false,
      setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
      login: (user) =>
        set({
          currentUser: user,
          isAuthenticated: true,
          isAuthModalOpen: false,
        }),
      logout: () =>
        set({
          isAuthenticated: false,
          isAuthModalOpen: true,
        }),
      updateProfile: (profile) =>
        set((state) => ({
          currentUser: { ...state.currentUser, ...profile },
        })),

      groups: INITIAL_GROUPS,
      selectedGroupId: 'group-goa',
      setSelectedGroupId: (id) => set({ selectedGroupId: id }),
      createGroup: (name, category, members) => {
        const id = `group-${Date.now()}`
        const code = (name.replace(/\s+/g, '').substring(0, 4) + Math.floor(100 + Math.random() * 900)).toUpperCase()
        const userMemberName = get().currentUser.name.split(' ')[0] || 'You'
        const allMembers = Array.from(new Set([userMemberName, ...members]))
        
        const newGroup: Group = {
          id,
          code,
          name,
          category: category || 'General',
          color: '#4F46E5',
          members: allMembers,
          created_by: userMemberName,
          created_by_id: get().currentUser.id,
          invite_token: `invite-${id}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        set((state) => ({
          groups: [newGroup, ...state.groups],
          selectedGroupId: id,
        }))

        get().addActivity({
          type: 'member_joined',
          groupId: id,
          groupName: name,
          actor: userMemberName,
          details: `created group "${name}"`,
        })

        return newGroup
      },
      leaveGroup: (groupId) =>
        set((state) => {
          const remaining = state.groups.filter((g) => g.id !== groupId)
          return {
            groups: remaining,
            selectedGroupId: remaining[0]?.id || '',
          }
        }),

      expenses: INITIAL_EXPENSES,
      addExpense: (expenseData) => {
        const id = `exp-${Date.now()}`
        const now = new Date().toISOString()
        const newExpense: Expense = {
          ...expenseData,
          id,
          created_at: now,
          updated_at: now,
        }

        const group = get().groups.find((g) => g.id === expenseData.group_id)

        set((state) => ({
          expenses: [newExpense, ...state.expenses],
        }))

        get().addActivity({
          type: 'expense_created',
          groupId: expenseData.group_id,
          groupName: group?.name || 'Group',
          actor: expenseData.paid_by,
          details: `added "${expenseData.title}"`,
          amountPaise: expenseData.amount_paise,
        })

        return newExpense
      },
      updateExpense: (id, partial) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id ? { ...e, ...partial, updated_at: new Date().toISOString() } : e
          ),
        })),
      deleteExpense: (id) =>
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        })),

      settlements: INITIAL_SETTLEMENTS,
      createSettlement: (groupId, payer, receiver, amountPaise, receiverUpiId) => {
        const id = `settle-${Date.now()}`
        const newSettlement: Settlement = {
          id,
          group_id: groupId,
          payer,
          receiver,
          amount_paise: amountPaise,
          status: 'pending',
          date: new Date().toISOString().split('T')[0],
          receiver_upi_id: receiverUpiId || '',
          created_at: new Date().toISOString(),
        }

        const group = get().groups.find((g) => g.id === groupId)

        set((state) => ({
          settlements: [newSettlement, ...state.settlements],
        }))

        get().addActivity({
          type: 'settlement_initiated',
          groupId,
          groupName: group?.name || 'Group',
          actor: payer,
          details: `initiated payment to ${receiver}`,
          amountPaise,
        })

        return newSettlement
      },
      markSettlementPaid: (settlementId, upiRef) => {
        const now = new Date().toISOString()
        let updatedSettlement: Settlement | undefined

        set((state) => ({
          settlements: state.settlements.map((s) => {
            if (s.id === settlementId) {
              updatedSettlement = {
                ...s,
                status: 'paid',
                paid_at: now,
                upi_ref: upiRef || `UPI${Date.now().toString().slice(-8)}`,
              }
              return updatedSettlement
            }
            return s
          }),
        }))

        if (updatedSettlement) {
          const s = updatedSettlement as Settlement
          const group = get().groups.find((g) => g.id === s.group_id)
          get().addActivity({
            type: 'settlement_paid',
            groupId: s.group_id,
            groupName: group?.name || 'Group',
            actor: s.payer,
            details: `marked payment to ${s.receiver} as paid`,
            amountPaise: s.amount_paise,
          })
        }
      },
      confirmSettlementReceived: (settlementId) => {
        const now = new Date().toISOString()
        let updatedSettlement: Settlement | undefined

        set((state) => ({
          settlements: state.settlements.map((s) => {
            if (s.id === settlementId) {
              updatedSettlement = {
                ...s,
                status: 'confirmed',
                confirmed_at: now,
              }
              return updatedSettlement
            }
            return s
          }),
        }))

        if (updatedSettlement) {
          const s = updatedSettlement as Settlement
          const group = get().groups.find((g) => g.id === s.group_id)
          get().addActivity({
            type: 'settlement_confirmed',
            groupId: s.group_id,
            groupName: group?.name || 'Group',
            actor: s.receiver,
            details: `confirmed receipt of payment from ${s.payer}`,
            amountPaise: s.amount_paise,
          })
        }
      },

      activities: INITIAL_ACTIVITIES,
      addActivity: (activity) =>
        set((state) => ({
          activities: [
            {
              ...activity,
              id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
            },
            ...state.activities,
          ],
        })),

      activeTab: 'groups',
      setActiveTab: (tab) => set({ activeTab: tab }),
      groupSegmentTab: 'expenses',
      setGroupSegmentTab: (tab) => set({ groupSegmentTab: tab }),

      isAddExpenseOpen: false,
      setAddExpenseOpen: (open) => set({ isAddExpenseOpen: open }),
      isSettleModalOpen: false,
      setSettleModalOpen: (open) => set({ isSettleModalOpen: open }),
      activeSettlement: null,
      setActiveSettlement: (transfer) => set({ activeSettlement: transfer }),
      isNewGroupOpen: false,
      setNewGroupOpen: (open) => set({ isNewGroupOpen: open }),

      theme: 'light',
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'light' ? 'dark' : 'light'
          if (next === 'dark') {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          return { theme: next }
        }),
    }),
    {
      name: 'splitzy-storage-v2',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        groups: state.groups,
        selectedGroupId: state.selectedGroupId,
        expenses: state.expenses,
        settlements: state.settlements,
        activities: state.activities,
        theme: state.theme,
      }),
    }
  )
)
