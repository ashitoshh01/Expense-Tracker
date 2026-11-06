import { describe, it, expect } from 'vitest'
import {
  normalizeState,
  recordIncome,
  recordExpense,
  createLoan,
  repayLoan,
  deleteTransaction,
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

  describe('Sync Deletion Integrity & Zombie Resurrection Prevention (Stage 4)', () => {
    it('prevents resurrection of transactions deleted locally when reconciling with older remote snapshot', () => {
      // Device A and Remote both have tx-1 (₹500 expense)
      const baseState = normalizeState({
        balance: 4500,
        transactions: [{ id: 'tx-1', type: 'spent', amount: 500, note: 'Coffee', date: '2026-10-01' }],
      })

      // Device A deletes tx-1 locally (balance becomes 5000, tx-1 tombstoned in deletedTxIds)
      const stateA = deleteTransaction(baseState, 'tx-1')
      expect(stateA.balance).toBe(5000)
      expect(stateA.transactions).toHaveLength(0)
      expect(stateA.deletedTxIds['tx-1']).toBeDefined()

      // Remote snapshot arrives that still has tx-1 because Remote has not synced yet
      const remoteSnapshot = { ...baseState }

      // Reconcile: Device A local with Remote snapshot
      const reconciled = reconcileStates(stateA, remoteSnapshot)

      // Invariant: tx-1 must NOT be resurrected as a "new remote transaction", balance must remain 5000
      expect(reconciled.transactions).toHaveLength(0)
      expect(reconciled.balance).toBe(5000)
      expect(reconciled.deletedTxIds['tx-1']).toBeDefined()
    })

    it('propagates remote transaction deletion to local state and reverses its financial impact', () => {
      // Base state: balance 4500 with tx-1 (₹500 expense)
      const baseState = normalizeState({
        balance: 4500,
        transactions: [{ id: 'tx-1', type: 'spent', amount: 500, note: 'Coffee', date: '2026-10-01' }],
      })

      // Device B deletes tx-1 remotely
      const remoteState = deleteTransaction(baseState, 'tx-1')
      expect(remoteState.balance).toBe(5000)
      expect(remoteState.deletedTxIds['tx-1']).toBeDefined()

      // Device A still has baseState locally (has tx-1, does not have tx-1 in its deletedTxIds)
      const localState = { ...baseState }

      // Reconcile
      const reconciled = reconcileStates(localState, remoteState)

      // Invariant: tx-1 is removed on Device A, and its balance impact is reversed (+500 back to 5000)
      expect(reconciled.transactions).toHaveLength(0)
      expect(reconciled.balance).toBe(5000)
      expect(reconciled.deletedTxIds['tx-1']).toBeDefined()
    })

    it('prevents resurrection of deleted loans when reconciling with remote snapshot', () => {
      const baseState = normalizeState({
        balance: 10000,
        loans: [{ id: 'loan-1', name: 'Dan', amount: 2000, outstanding: 2000, repayments: [] }],
        transactions: [{ id: 'tx-loan-1', type: 'loan_borrow', amount: 2000, loanId: 'loan-1' }],
      })

      // Device A deletes the loan transaction (which deletes loan-1)
      const stateA = deleteTransaction(baseState, 'tx-loan-1')
      expect(stateA.loans).toHaveLength(0)
      expect(stateA.deletedLoanIds['loan-1']).toBeDefined()
      expect(stateA.deletedTxIds['tx-loan-1']).toBeDefined()

      // Remote still has loan-1
      const remoteState = { ...baseState }

      const reconciled = reconcileStates(stateA, remoteState)
      expect(reconciled.loans).toHaveLength(0)
      expect(reconciled.transactions).toHaveLength(0)
      expect(reconciled.deletedLoanIds['loan-1']).toBeDefined()
    })

    it('prevents loan repayment resurrection when Device A deletes repayment and Device B reconciles', () => {
      // Base state: Loan of 5000 with a 1000 repayment
      let base = normalizeState({ balance: 10000, savings: 0, loans: [], transactions: [] })
      base = createLoan(base, { type: 'borrowed', amount: 5000, name: 'Bank Loan' })
      const loanId = base.loans[0].id
      base = repayLoan(base, { loanId, amount: 1000, note: 'Repayment 1' })
      expect(base.loans[0].outstanding).toBe(4000)
      expect(base.loans[0].repayments).toHaveLength(1)
      const repaymentTx = base.transactions.find((t) => t.type === 'loan_repayment')

      // Device A deletes the repayment (refunds cash, restores outstanding to 5000)
      const stateA = deleteTransaction(base, repaymentTx.id)
      expect(stateA.loans[0].outstanding).toBe(5000)
      expect(stateA.loans[0].repayments).toHaveLength(0)
      expect(stateA.balance).toBe(15000) // 10000 + 5000 borrowed - 1000 repaid + 1000 reversed

      // Device B still has base state (has repayment in loan.repayments and repaymentTx in transactions)
      const stateB = { ...base }

      // Device B reconciles against Device A
      const reconciled = reconcileStates(stateB, stateA)

      // Repayment must stay deleted in Device B's loan.repayments!
      const reconciledLoan = reconciled.loans.find((l) => l.id === loanId)
      expect(reconciledLoan.repayments).toHaveLength(0)
      expect(reconciledLoan.outstanding).toBe(5000)
      expect(reconciledLoan.status).toBe('active')
      expect(reconciled.transactions.find((t) => t.id === repaymentTx.id)).toBeUndefined()
      expect(reconciled.balance).toBe(15000)

      // Repeated reconciliation must NOT resurrect the repayment
      const secondReconcile = reconcileStates(reconciled, stateA)
      const secondLoan = secondReconcile.loans.find((l) => l.id === loanId)
      expect(secondLoan.repayments).toHaveLength(0)
      expect(secondLoan.outstanding).toBe(5000)
      expect(secondReconcile.transactions).toHaveLength(1) // only initial borrow tx
    })

    it('prevents resurrection of transactions after tombstone pruning on stale device reconnect while preserving offline mutations', () => {
      const day1 = '2026-01-01T10:00:00.000Z'
      const day2 = '2026-01-02T10:00:00.000Z'
      const day104 = '2026-04-15T10:00:00.000Z'

      // Transaction tx-old was created on Day 1
      const oldTx = { id: 'tx-old', type: 'spent', amount: 500, note: 'Ancient coffee', createdAt: day1, date: '2026-01-01' }

      // Device B last synced on Day 2 with server
      const lastSyncedAt = day2

      // While offline on Day 104, Device B creates a new genuine offline expense tx-offline
      const offlineTx = { id: 'tx-offline', type: 'spent', amount: 200, note: 'Recent lunch', createdAt: day104, date: '2026-04-15' }

      // Device B local state has both tx-old (from Day 1) and tx-offline (from Day 104)
      const localState = normalizeState({
        balance: 4300, // 5000 - 500 - 200
        transactions: [offlineTx, oldTx],
        updatedAt: day104,
      })

      // Server remote state: tx-old was deleted on Day 3, and by Day 105 (>90 days later),
      // its tombstone was pruned from deletedTxIds!
      const remoteState = normalizeState({
        balance: 5000,
        transactions: [],
        deletedTxIds: {}, // tombstone was pruned!
        updatedAt: '2026-04-16T10:00:00.000Z',
      })

      // Device B reconnects and reconciles with remote, providing lastSyncedAt watermark
      const reconciled = reconcileStates(localState, remoteState, { lastSyncedAt })

      // tx-old (created Day 1 <= lastSyncedAt Day 2, missing from server) must NOT be resurrected!
      expect(reconciled.transactions.find((t) => t.id === 'tx-old')).toBeUndefined()

      // tx-offline (created Day 104 > lastSyncedAt Day 2) MUST be preserved!
      expect(reconciled.transactions.find((t) => t.id === 'tx-offline')).toBeDefined()

      // Balance: remote 5000 - 200 (offlineTx) = 4800 (tx-old's 500 was properly deducted on remote)
      expect(reconciled.balance).toBe(4800)
    })
  })
})
