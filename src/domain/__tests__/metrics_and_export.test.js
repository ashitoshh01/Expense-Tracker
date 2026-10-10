import { describe, it, expect } from 'vitest'
import {
  calculateMonthlyBreakdown,
  calculateSavingsGrowth,
  calculateBalanceChangePercent,
} from '../metrics'
import {
  generateCSV,
  generateBackupJSON,
  validateAndParseImport,
} from '../../services/exportImport'

describe('Domain: Financial Metrics (H1)', () => {
  it('strictly separates external income/expense from internal savings transfers in monthly totals', () => {
    const transactions = [
      { id: '1', date: '2026-10-01', type: 'salary', amount: 5000, category: 'Salary' },
      { id: '2', date: '2026-10-02', type: 'spent', amount: 1200, category: 'Food' },
      // Internal transfer: should NOT increase spent or income
      { id: '3', date: '2026-10-03', type: 'savings_deposit', amount: 1000, category: 'Savings' },
      { id: '4', date: '2026-10-04', type: 'savings_withdraw', amount: 300, category: 'Savings' },
    ]

    const breakdown = calculateMonthlyBreakdown(transactions, '2026-10')
    expect(breakdown.externalIncome).toBe(5000)
    expect(breakdown.externalSpent).toBe(1200)
    expect(breakdown.savingsDeposited).toBe(1000)
    expect(breakdown.savingsWithdrawn).toBe(300)
    expect(breakdown.netSavingsAdded).toBe(700)
    expect(breakdown.savingsRate).toBe(20) // 1000 / 5000 = 20%
  })

  it('replaces hardcoded +100% with honest savings growth comparisons', () => {
    // If no previous baseline
    const initial = calculateSavingsGrowth(500, 0)
    expect(initial.label).toBe('First savings')
    expect(initial.hasBaseline).toBe(false)

    // Positive growth
    const positive = calculateSavingsGrowth(1500, 1000)
    expect(positive.label).toBe('+50%')
    expect(positive.isPositive).toBe(true)

    // Negative growth
    const negative = calculateSavingsGrowth(800, 1000)
    expect(negative.label).toBe('-20%')
    expect(negative.isPositive).toBe(false)

    // Zero current
    const zero = calculateSavingsGrowth(0, 1000)
    expect(zero.label).toBe('0%')
  })

  it('calculates balance change percentage safely without division by zero errors', () => {
    const zeroPrev = calculateBalanceChangePercent(1000, 0)
    expect(zeroPrev.label).toBe('+100%')

    const regular = calculateBalanceChangePercent(3000, 2000)
    expect(regular.label).toBe('+50.0%')
  })
})

describe('Services: Export and Backup (H6)', () => {
  it('generates RFC 4180 compliant CSV escaping special characters and quotes', () => {
    const transactions = [
      { id: 'tx-1', date: '2026-10-01', type: 'spent', category: 'Food, Dining', amount: 250, note: 'Had "special" thali' },
    ]

    const csv = generateCSV(transactions)
    expect(csv).toContain('"Food, Dining"')
    expect(csv).toContain('"Had ""special"" thali"')
  })

  it('creates versioned JSON backup and safely parses and validates imports', () => {
    const state = {
      balance: 10000,
      savings: 4000,
      loans: [{ id: 'l1', name: 'John', amount: 500, outstanding: 500, type: 'borrowed' }],
      transactions: [{ id: 't1', type: 'income', amount: 10000, category: 'Salary', date: '2026-10-01' }],
    }

    const backup = generateBackupJSON(state)
    expect(backup.meta.schemaVersion).toBe(2)
    expect(backup.data.balance).toBe(10000)

    const jsonString = JSON.stringify(backup)
    const result = validateAndParseImport(jsonString)
    expect(result.ok).toBe(true)
    expect(result.data.balance).toBe(10000)
    expect(result.data.loans).toHaveLength(1)
  })

  it('rejects corrupt or invalid import data', () => {
    const malformed = 'Not valid json'
    expect(validateAndParseImport(malformed).ok).toBe(false)

    const invalidSchema = JSON.stringify({ transactions: 'not an array' })
    expect(validateAndParseImport(invalidSchema).ok).toBe(false)
  })
})
