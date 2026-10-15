import { describe, it, expect } from 'vitest'
import {
  calculateSimplifiedSettlements,
  calculateNetBalances,
} from '../settlement'

describe('Settlement Algorithm (Greedy Two-Pointer Simplified Payments)', () => {
  it('simplifies 3-person cycle Goa trip debt into at most 2 transfers', () => {
    // Balances:
    // Manjiri: +₹1,240 (is owed 124000 paise)
    // Om: -₹1,040 (owes 104000 paise)
    // Aarav: -₹200 (owes 20000 paise)
    const balances = {
      Manjiri: 124000,
      Om: -104000,
      Aarav: -20000,
    }

    const transfers = calculateSimplifiedSettlements(balances)

    // With 3 members, greedy two pointer produces at most N-1 = 2 transfers
    expect(transfers.length).toBeLessThanOrEqual(2)

    // Om owes 104000 to Manjiri
    // Aarav owes 20000 to Manjiri
    expect(transfers).toEqual([
      {
        id: 'transfer-Om-Manjiri-1',
        from: 'Om',
        to: 'Manjiri',
        amountPaise: 104000,
      },
      {
        id: 'transfer-Aarav-Manjiri-2',
        from: 'Aarav',
        to: 'Manjiri',
        amountPaise: 20000,
      },
    ])
  })

  it('simplifies a multi-party circular debt', () => {
    // 4 members: A, B, C, D
    // A: +100
    // B: +200
    // C: -150
    // D: -150
    // Total credits = 300, total debts = 300
    const balances = {
      A: 10000,
      B: 20000,
      C: -15000,
      D: -15000,
    }

    const transfers = calculateSimplifiedSettlements(balances)
    // Max transfers = 4 - 1 = 3
    expect(transfers.length).toBeLessThanOrEqual(3)

    // Total settled must match 30000 paise
    const totalTransferred = transfers.reduce((sum, t) => sum + t.amountPaise, 0)
    expect(totalTransferred).toBe(30000)

    // Each creditor gets exact credit
    const receivedByB = transfers
      .filter((t) => t.to === 'B')
      .reduce((s, t) => s + t.amountPaise, 0)
    expect(receivedByB).toBe(20000)

    const receivedByA = transfers
      .filter((t) => t.to === 'A')
      .reduce((s, t) => s + t.amountPaise, 0)
    expect(receivedByA).toBe(10000)
  })

  it('handles already settled balances gracefully', () => {
    const balances = {
      Manjiri: 0,
      Om: 0,
      Aarav: 0,
    }

    const transfers = calculateSimplifiedSettlements(balances)
    expect(transfers).toEqual([])
  })

  it('calculates net balances from expense feed and confirmed settlements', () => {
    const members = ['Manjiri', 'Om', 'Aarav']
    const expenses = [
      // Beach shack dinner: Om paid ₹900, split 3 ways (₹300 each)
      {
        paid_by: 'Om',
        amount_paise: 90000,
        splits: { Manjiri: 30000, Om: 30000, Aarav: 30000 },
      },
      // Scooter rental: Manjiri paid ₹1,200, split 3 ways (₹400 each)
      {
        paid_by: 'Manjiri',
        amount_paise: 120000,
        splits: { Manjiri: 40000, Om: 40000, Aarav: 40000 },
      },
      // Airport cab: Aarav paid ₹1,500, split 3 ways (₹500 each)
      {
        paid_by: 'Aarav',
        amount_paise: 150000,
        splits: { Manjiri: 50000, Om: 50000, Aarav: 50000 },
      },
    ]

    const settlements = [
      // Om previously paid Manjiri ₹100 confirmed
      {
        payer: 'Om',
        receiver: 'Manjiri',
        amount_paise: 10000,
        status: 'confirmed' as const,
      },
    ]

    const balances = calculateNetBalances(members, expenses, settlements)

    // Manjiri:
    // Paid 120000, split shares: -30000, -40000, -50000 = net 0 from expenses
    // Om paid Manjiri 10000 -> Manjiri's credit decreases by 10000 -> -10000
    expect(balances.Manjiri).toBe(-10000)
  })
})
