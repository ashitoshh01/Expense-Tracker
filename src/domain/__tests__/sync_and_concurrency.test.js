import { describe, it, expect } from 'vitest'
import {
  normalizeState,
  recordIncome,
  recordExpense,
  createLoan,
  repayLoan,
  processSalaryAutomation,
  reconcileStates,
  DEFAULT_SETTINGS,
} from '../accounting'

describe('Section 5 & 7: Synchronization Concurrency & Multi-Device Authority', () => {
  it('merges disjoint transactions from two devices without losing any updates', () => {
    // Device A and Device B both start from base state S0: ₹10,000 balance
    const baseState = normalizeState({
      balance: 10000,
      savings: 2000,
      loans: [],
      transactions: [{ id: 'tx-base', type: 'income', amount: 10000, date: '2026-10-01' }],
    })

    // Device A offline: spends ₹500 on Food
    const stateA = recordExpense(baseState, { amount: 500, category: 'Food', note: 'Lunch' })
    const txA = stateA.transactions[0]
    expect(stateA.balance).toBe(9500)

    // Device B concurrently: receives ₹2,000 freelance payment
    const stateB = recordIncome(baseState, { amount: 2000, category: 'Freelance', note: 'Design gig' })
    const txB = stateB.transactions[0]
    expect(stateB.balance).toBe(12000)

    // Device A reconnects and reconciles with Device B's remote state
    const reconciled = reconcileStates(stateA, stateB)

    // Expected:
    // Base 10000 - 500 (A) + 2000 (B) = 11,500
    expect(reconciled.balance).toBe(11500)
    expect(reconciled.savings).toBe(2000)

    // Both transactions present in the reconciled state
    const txIds = reconciled.transactions.map((t) => t.id)
    expect(txIds).toContain(txA.id)
    expect(txIds).toContain(txB.id)
    expect(txIds).toContain('tx-base')
  })

  it('merges concurrent loan repayments from different devices and computes accurate outstanding debt', () => {
    // Base state with a ₹5,000 borrowed loan
    let base = normalizeState({ balance: 10000, savings: 0, loans: [], transactions: [] })
    base = createLoan(base, { type: 'borrowed', amount: 5000, name: 'Bank Loan' })
    const loanId = base.loans[0].id

    // Device A repays ₹1,000
    const stateA = repayLoan(base, { loanId, amount: 1000, note: 'Repay Part 1' })
    expect(stateA.loans[0].outstanding).toBe(4000)

    // Device B concurrently repays ₹1,500
    const stateB = repayLoan(base, { loanId, amount: 1500, note: 'Repay Part 2' })
    expect(stateB.loans[0].outstanding).toBe(3500)

    // Reconcile states
    const reconciled = reconcileStates(stateA, stateB)

    // Reconciled loan should reflect BOTH repayments: ₹5,000 - 1,000 - 1,500 = ₹2,500 outstanding
    const loan = reconciled.loans.find((l) => l.id === loanId)
    expect(loan).toBeDefined()
    expect(loan.outstanding).toBe(2500)
    expect(loan.repayments).toHaveLength(2)
    expect(loan.status).toBe('partially_paid')

    // Balance reflects both repayments: ₹15,000 initial cash - 1,000 - 1,500 = ₹12,500
    expect(reconciled.balance).toBe(12500)
  })

  it('prevents double salary crediting when multiple devices or browser tabs process automation', () => {
    const state = normalizeState({
      balance: 5000,
      savings: 1000,
      settings: { ...DEFAULT_SETTINGS, salaryAmount: 25000, salaryDay: 1, autoSaveAmount: 5000, autoSaveEnabled: true },
      lastSalaryMonth: '',
    })

    const fixedDate = new Date('2026-10-05T10:00:00Z')

    // Device A processes salary automation
    const runA = processSalaryAutomation(state, { now: fixedDate })
    expect(runA.processed).toBe(true)
    expect(runA.state.balance).toBe(25000) // 5000 + 20000 net
    expect(runA.state.savings).toBe(6000) // 1000 + 5000
    expect(runA.state.lastSalaryMonth).toBe('2026-10')

    // Device B tries to process salary automation for the exact same month
    const runB = processSalaryAutomation(runA.state, { now: fixedDate })
    expect(runB.processed).toBe(false)
    expect(runB.reason).toBe('already_credited')
    // No duplicate transactions or double balance addition
    expect(runB.state.balance).toBe(25000)
    expect(runB.state.savings).toBe(6000)
  })

  it('safely merges settings changes by preferring most recent updates', () => {
    const stateA = normalizeState({
      balance: 1000,
      settings: { ...DEFAULT_SETTINGS, salaryAmount: 30000 },
      updatedAt: '2026-10-10T12:00:00Z',
    })

    const stateB = normalizeState({
      balance: 1000,
      settings: { ...DEFAULT_SETTINGS, salaryAmount: 40000, autoSaveEnabled: true },
      updatedAt: '2026-10-10T13:00:00Z',
    })

    const reconciled = reconcileStates(stateA, stateB)
    expect(reconciled.settings.salaryAmount).toBe(40000)
    expect(reconciled.settings.autoSaveEnabled).toBe(true)
  })
})
