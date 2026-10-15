/**
 * Greedy Two-Pointer Debt Simplification (Max N-1 transfers).
 * 
 * NON-NEGOTIABLE RULE: Do NOT label it "optimal"; call it "Simplified".
 * Pure function: operates strictly on integer paise balances.
 */

export interface SimplifiedTransfer {
  id: string
  from: string // memberId who owes
  to: string   // memberId who is owed
  amountPaise: number // integer paise
}

export interface MemberBalance {
  memberId: string
  netBalancePaise: number // positive = is owed money; negative = owes money
}

/**
 * Calculates simplified payments using greedy two-pointer matching.
 * Guarantees at most N-1 transactions where N is number of members with non-zero balance.
 */
export function calculateSimplifiedSettlements(
  balances: Record<string, number>
): SimplifiedTransfer[] {
  // Creditors (owed money, balance > 0)
  const creditors: { id: string; amount: number }[] = []
  // Debtors (owe money, balance < 0)
  const debtors: { id: string; amount: number }[] = []

  for (const [memberId, balance] of Object.entries(balances)) {
    const rounded = Math.round(balance)
    if (rounded > 0) {
      creditors.push({ id: memberId, amount: rounded })
    } else if (rounded < 0) {
      debtors.push({ id: memberId, amount: rounded }) // amount is negative
    }
  }

  // Sort creditors descending (largest credit first)
  creditors.sort((a, b) => b.amount - a.amount)
  // Sort debtors ascending (largest debt / most negative first)
  debtors.sort((a, b) => a.amount - b.amount)

  const transfers: SimplifiedTransfer[] = []
  let cIdx = 0
  let dIdx = 0

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx]
    const debtor = debtors[dIdx]

    const debtRemaining = -debtor.amount
    const creditRemaining = creditor.amount

    const settlePaise = Math.min(debtRemaining, creditRemaining)

    if (settlePaise > 0) {
      transfers.push({
        id: `transfer-${debtor.id}-${creditor.id}-${transfers.length + 1}`,
        from: debtor.id,
        to: creditor.id,
        amountPaise: settlePaise,
      })

      creditor.amount -= settlePaise
      debtor.amount += settlePaise
    }

    if (creditor.amount === 0) {
      cIdx++
    }
    if (debtor.amount === 0) {
      dIdx++
    }
  }

  return transfers
}

/**
 * Computes net balances for all members given a list of expenses and confirmed/recorded settlements.
 * All in integer paise!
 */
export function calculateNetBalances(
  members: string[],
  expenses: Array<{
    paid_by: string
    amount_paise: number
    splits: Record<string, number>
  }>,
  settlements: Array<{
    payer: string
    receiver: string
    amount_paise: number
    status?: 'pending' | 'paid' | 'confirmed'
  }>
): Record<string, number> {
  const balances: Record<string, number> = {}

  // Initialize all members to 0
  for (const member of members) {
    balances[member] = 0
  }

  // 1. Process expenses
  for (const expense of expenses) {
    const payer = expense.paid_by
    const total = Math.round(expense.amount_paise)

    // Payer is credited the full amount
    balances[payer] = (balances[payer] || 0) + total

    // Each participant is debited their split share
    for (const [participant, share] of Object.entries(expense.splits)) {
      balances[participant] = (balances[participant] || 0) - Math.round(share)
    }
  }

  // 2. Process settlements (only confirmed or paid settlements reduce debt)
  // A settlement transfer of X paise from A to B means A gave B money.
  // So A's balance increases by X (debt reduced) and B's balance decreases by X (credit reduced).
  for (const settlement of settlements) {
    // If status exists, only consider 'paid' or 'confirmed'
    if (settlement.status && settlement.status === 'pending') {
      continue
    }

    const amount = Math.round(settlement.amount_paise)
    balances[settlement.payer] = (balances[settlement.payer] || 0) + amount
    balances[settlement.receiver] = (balances[settlement.receiver] || 0) - amount
  }

  return balances
}
