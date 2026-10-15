import { describe, it, expect } from 'vitest'
import {
  formatINR,
  rupeesToPaise,
  paiseToRupees,
  calculateEqualSplit,
  calculatePercentageSplit,
} from '../money'

describe('Money Utilities (Integer Paise)', () => {
  it('formats positive and negative amounts correctly in Indian numbering system', () => {
    expect(formatINR(124000)).toBe('₹1,240')
    expect(formatINR(124050)).toBe('₹1,240.50')
    expect(formatINR(-86000)).toBe('-₹860')
    expect(formatINR(1245000)).toBe('₹12,450')
    expect(formatINR(0)).toBe('₹0')
  })

  it('converts rupees string and numbers to integer paise safely', () => {
    expect(rupeesToPaise(1800)).toBe(180000)
    expect(rupeesToPaise('1800')).toBe(180000)
    expect(rupeesToPaise('1,240.50')).toBe(124050)
    expect(rupeesToPaise('0.33')).toBe(33)
    expect(rupeesToPaise('')).toBe(0)
  })

  it('converts paise to rupees', () => {
    expect(paiseToRupees(180000)).toBe(1800)
    expect(paiseToRupees(124050)).toBe(1240.5)
  })

  describe('calculateEqualSplit (deterministic remainder distribution)', () => {
    it('distributes remainder paise to the payer first, then member order', () => {
      // 100 paise (₹1.00) split 3 ways between MK (payer), OK, AS
      // 100 / 3 = 33 base, remainder 1
      // MK should get 34, OK get 33, AS get 33
      const splits = calculateEqualSplit(100, ['MK', 'OK', 'AS'], 'MK')
      expect(splits).toEqual({
        MK: 34,
        OK: 33,
        AS: 33,
      })
      // Sum must equal exactly 100
      expect(splits.MK + splits.OK + splits.AS).toBe(100)
    })

    it('distributes 2 remainder paise to payer first, then next member in order', () => {
      // 101 paise split 3 ways between MK (payer), OK, AS
      // 101 / 3 = 33 base, remainder 2
      // MK gets 33 + 1 = 34
      // OK gets 33 + 1 = 34
      // AS gets 33
      const splits = calculateEqualSplit(101, ['MK', 'OK', 'AS'], 'MK')
      expect(splits).toEqual({
        MK: 34,
        OK: 34,
        AS: 33,
      })
      expect(splits.MK + splits.OK + splits.AS).toBe(101)
    })

    it('splits ₹1,800 (180000 paise) equally 3 ways with 0 remainder', () => {
      const splits = calculateEqualSplit(180000, ['MK', 'OK', 'AS'], 'MK')
      expect(splits).toEqual({
        MK: 60000,
        OK: 60000,
        AS: 60000,
      })
      expect(splits.MK + splits.OK + splits.AS).toBe(180000)
    })

    it('handles payer not in split list', () => {
      // Third party payer
      const splits = calculateEqualSplit(100, ['OK', 'AS', 'Bob'], 'MK')
      // Remainder 1 goes to first member in list 'OK'
      expect(splits).toEqual({
        OK: 34,
        AS: 33,
        Bob: 33,
      })
      expect(splits.OK + splits.AS + splits.Bob).toBe(100)
    })
  })

  describe('calculatePercentageSplit', () => {
    it('calculates percentage splits and distributes rounding difference to sum exactly', () => {
      // ₹100 split 33.33% / 33.33% / 33.34% -> 33.33, 33.33, 33.34
      const splits = calculatePercentageSplit(
        10000, // ₹100 = 10000 paise
        { MK: 33.33, OK: 33.33, AS: 33.34 },
        'MK'
      )
      const sum = Object.values(splits).reduce((a, b) => a + b, 0)
      expect(sum).toBe(10000)
    })
  })
})
