/**
 * Splitzy Currency & Money Utilities
 * 
 * NON-NEGOTIABLE RULE: Store ALL money as integer paise. Never use floats.
 * 1 Rupee = 100 Paise.
 */

/**
 * Format paise into Indian Rupee currency format (e.g., "₹1,240.50" or "₹1,240")
 * Uses Intl.NumberFormat('en-IN')
 */
export function formatINR(paise: number, forceDecimals = false): string {
  const isNegative = paise < 0
  const absPaise = Math.abs(Math.round(paise))
  const rupees = absPaise / 100

  const hasPaise = absPaise % 100 !== 0
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: forceDecimals || hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })

  const formatted = formatter.format(rupees)
  return isNegative ? `-${formatted}` : formatted
}

/**
 * Converts user input rupees (number or string) to integer paise safely without float precision leaks.
 * E.g., "1240.50" -> 124050, 1800 -> 180000
 */
export function rupeesToPaise(val: number | string): number {
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0
    return Math.round(val * 100)
  }

  const clean = val.trim().replace(/,/g, '')
  if (!clean) return 0

  const num = parseFloat(clean)
  if (isNaN(num) || !isFinite(num)) return 0

  return Math.round(num * 100)
}

/**
 * Converts paise to a displayable rupee float/number.
 */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100
}

/**
 * Distribute remainder paise deterministically so splits always sum exactly to totalPaise.
 * Rule: Distribute remainder paise to the payer first (if in split list), then in member order.
 * 
 * @param totalPaise Total expense in integer paise
 * @param memberIds Array of member IDs involved in the split
 * @param payerId ID of the payer
 * @returns Map of memberId -> paise
 */
export function calculateEqualSplit(
  totalPaise: number,
  memberIds: string[],
  payerId: string
): Record<string, number> {
  const n = memberIds.length
  if (n === 0) return {}
  if (n === 1) return { [memberIds[0]]: totalPaise }

  const baseSplit = Math.floor(totalPaise / n)
  let remainder = totalPaise - baseSplit * n

  const result: Record<string, number> = {}
  for (const id of memberIds) {
    result[id] = baseSplit
  }

  // 1. Give 1 paise to payer if payer is part of the split and remainder > 0
  if (remainder > 0 && memberIds.includes(payerId)) {
    result[payerId] += 1
    remainder -= 1
  }

  // 2. Distribute remaining paise in deterministic member order (skipping payer who already got one)
  for (const id of memberIds) {
    if (remainder <= 0) break
    if (id === payerId) continue
    result[id] += 1
    remainder -= 1
  }

  return result
}

/**
 * Distribute percentage split with integer paise rounding.
 * Remainder paise distributed deterministically to the payer first, then in member order.
 */
export function calculatePercentageSplit(
  totalPaise: number,
  percentages: Record<string, number>, // e.g. { "m1": 50, "m2": 50 } (summing to 100)
  payerId: string
): Record<string, number> {
  const memberIds = Object.keys(percentages)
  if (memberIds.length === 0) return {}

  let allocated = 0
  const result: Record<string, number> = {}

  for (const id of memberIds) {
    const pct = percentages[id] || 0
    const paise = Math.floor((totalPaise * pct) / 100)
    result[id] = paise
    allocated += paise
  }

  let remainder = totalPaise - allocated

  // Distribute remainder paise
  if (remainder > 0 && memberIds.includes(payerId)) {
    result[payerId] += 1
    remainder -= 1
  }

  for (const id of memberIds) {
    if (remainder <= 0) break
    if (id === payerId) continue
    result[id] += 1
    remainder -= 1
  }

  return result
}
