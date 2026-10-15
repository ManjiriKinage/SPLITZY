export type SplitType = 'equal' | 'exact' | 'percentage' | 'itemized'

export type SettlementStatus = 'pending' | 'paid' | 'confirmed'

export interface UserProfile {
  id: string
  name: string
  email: string
  upi_id?: string
  avatar_color?: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id?: string
  member_name: string
  email?: string
  role: 'creator' | 'admin' | 'member'
  joined_at: string
}

export interface ExpenseItem {
  id: string
  name: string
  amount_paise: number
  assigned_to: string[] // member names or IDs
}

export interface Expense {
  id: string
  group_id: string
  title: string
  amount_paise: number // Non-negotiable: integer paise
  category: string
  date: string // YYYY-MM-DD
  paid_by: string // member name or user ID
  split_type: SplitType
  splits: Record<string, number> // member -> integer paise share
  itemized_data?: ExpenseItem[]
  notes?: string
  receipt_url?: string
  created_by_id?: string
  created_at: string
  updated_at: string
}

export interface Settlement {
  id: string
  group_id: string
  payer: string // member name
  receiver: string // member name
  amount_paise: number // Non-negotiable: integer paise
  status: SettlementStatus // 'pending' | 'paid' | 'confirmed'
  date: string
  notes?: string
  payer_upi_id?: string
  receiver_upi_id?: string
  upi_ref?: string
  paid_at?: string
  confirmed_at?: string
  created_at: string
}

export interface Group {
  id: string
  code: string
  name: string
  category: string
  icon?: string
  color?: string
  members: string[] // Member names
  created_by: string
  created_by_id?: string
  invite_token?: string
  created_at: string
  updated_at: string
}

export interface ActivityItem {
  id: string
  type: 'expense_created' | 'expense_updated' | 'settlement_initiated' | 'settlement_paid' | 'settlement_confirmed' | 'member_joined'
  groupId: string
  groupName: string
  timestamp: string
  actor: string
  details: string
  amountPaise?: number
}
