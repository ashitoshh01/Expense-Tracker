import { describe, it, expect } from 'vitest'
import { toPaise, toRupees, addMoney, subMoney, formatAmount, validateAmount } from '../money'
import {
  normalizeState,
  recordIncome,
  recordExpense,
  recordSavingsDeposit,
  recordSavingsWithdrawal,
  createLoan,
  repayLoan,
  deleteTransaction,
  editTransaction,
  processSalaryAutomation,
  DEFAULT_SETTINGS,
  pruneTombstones,
} from '../accounting'

describe('Domain: Money Math & Validation', () => {
  it('converts between rupees and paise accurately without floating point error', () => {
    expect(toPaise(100.55)).toBe(10055)
    expect(toPaise('250.75')).toBe(25075)
    expect(toRupees(10055)).toBe(100.55)
    // Classic IEEE-754 problem: 0.1 + 0.2 = 0.30000000000000004
    expect(addMoney(0.1, 0.2)).toBe(0.3)
    expect(subMoney(0.3, 0.1)).toBe(0.2)
  })

  it('rejects invalid, negative, or infinite amounts', () => {
    expect(() => validateAmount(-50)).toThrow('Amount must be greater than zero')
    expect(() => validateAmount(0)).toThrow('Amount must be greater than zero')
    expect(() => validateAmount('abc')).toThrow('Amount must be a finite number')
    expect(() => validateAmount(Infinity)).toThrow('Amount must be a finite number')
    expect(() => validateAmount('')).toThrow('Amount is required')
  })

  it('formats INR amounts cleanly', () => {
    expect(formatAmount(1000)).toBe('1,000')
    expect(formatAmount(100000)).toBe('1,00,000')
    expect(formatAmount(50.5)).toBe('50.50')
  })
})

describe('Domain: Critical Accounting Mutations', () => {
  const getInitialState = (overrides = {}) =>
    normalizeState({
      balance: 5000,
      savings: 2000,
      loans: [],
      transactions: [],
      savingsGoal: 10000,
      lastSalaryMonth: '2026-09',
      settings: { ...DEFAULT_SETTINGS },
      ...overrides,
    })

  describe('C1: Loan Repayment Accounting', () => {
    it('creates a borrowed loan, increasing cash and setting debt', () => {
      const state = getInitialState()
      const next = createLoan(state, {
        name: 'Rahul',
        amount: 3000,
        type: 'borrowed',
      })
      expect(next.balance).toBe(8000) // 5000 + 3000
      expect(next.loans).toHaveLength(1)
      expect(next.loans[0].amount).toBe(3000)
      expect(next.loans[0].outstanding).toBe(3000)
      expect(next.loans[0].status).toBe('active')
      expect(next.transactions[0].type).toBe('loan_borrow')
      expect(next.transactions[0].amount).toBe(3000)
    })

    it('performs full repayment: deducts balance, updates loan to repaid, and logs repayment tx', () => {
      let state = getInitialState({ balance: 5000 })
      state = createLoan(state, { name: 'Rahul', amount: 3000, type: 'borrowed' })
      const loanId = state.loans[0].id

      // Repay full 3000
      const repaid = repayLoan(state, { loanId, amount: 3000, note: 'Cleared in full' })

      expect(repaid.balance).toBe(5000) // 8000 - 3000
      const loan = repaid.loans.find((l) => l.id === loanId)
      expect(loan.outstanding).toBe(0)
      expect(loan.status).toBe('repaid')
      expect(loan.repayments).toHaveLength(1)
      expect(loan.repayments[0].amount).toBe(3000)

      // Repayment transaction in ledger
      const tx = repaid.transactions[0]
      expect(tx.type).toBe('loan_repayment')
      expect(tx.amount).toBe(3000)
      expect(tx.loanId).toBe(loanId)
    })

    it('supports partial repayments and maintains remaining outstanding debt', () => {
      let state = getInitialState({ balance: 1000 })
      state = createLoan(state, { name: 'Pooja', amount: 4000, type: 'borrowed' })
      const loanId = state.loans[0].id
      expect(state.balance).toBe(5000)

      // Partial repayment of 1500
      const step1 = repayLoan(state, { loanId, amount: 1500, note: 'Part 1' })
      expect(step1.balance).toBe(3500) // 5000 - 1500
      expect(step1.loans[0].outstanding).toBe(2500)
      expect(step1.loans[0].status).toBe('partially_paid')
      expect(step1.loans[0].repayments).toHaveLength(1)

      // Second partial repayment of 2500
      const step2 = repayLoan(step1, { loanId, amount: 2500, note: 'Part 2' })
      expect(step2.balance).toBe(1000) // 3500 - 2500
      expect(step2.loans[0].outstanding).toBe(0)
      expect(step2.loans[0].status).toBe('repaid')
      expect(step2.loans[0].repayments).toHaveLength(2)
    })

    it('prevents repayment when user has insufficient cash balance', () => {
      let state = getInitialState({ balance: 500 })
      state = createLoan(state, { name: 'Vikram', amount: 2000, type: 'borrowed' })
      // Now balance is 2500, spend 2200 to leave 300
      state = recordExpense(state, { amount: 2200, category: 'Food' })
      expect(state.balance).toBe(300)

      const loanId = state.loans[0].id
      expect(() => repayLoan(state, { loanId, amount: 1000 })).toThrow(/Insufficient balance/)
    })

    it('prevents repayment exceeding outstanding debt or on an already repaid loan', () => {
      let state = getInitialState({ balance: 10000 })
      state = createLoan(state, { name: 'Anita', amount: 1000, type: 'borrowed' })
      const loanId = state.loans[0].id

      expect(() => repayLoan(state, { loanId, amount: 1500 })).toThrow(/exceeds outstanding debt/)

      const fullyRepaid = repayLoan(state, { loanId, amount: 1000 })
      expect(() => repayLoan(fullyRepaid, { loanId, amount: 100 })).toThrow(/already been fully repaid/)
    })
  })

  describe('C2: Transaction Deletion and Safe Reversal', () => {
    it('deleting an income transaction deducts its amount from balance', () => {
      let state = getInitialState({ balance: 5000 })
      state = recordIncome(state, { amount: 2000, category: 'Freelance' })
      expect(state.balance).toBe(7000)
      const txId = state.transactions[0].id

      const reversed = deleteTransaction(state, txId)
      expect(reversed.balance).toBe(5000)
      expect(reversed.transactions).toHaveLength(0)
    })

    it('prevents deleting income if doing so would drive balance negative', () => {
      let state = getInitialState({ balance: 500 })
      state = recordIncome(state, { amount: 1000, category: 'Bonus' }) // balance = 1500
      state = recordExpense(state, { amount: 1200, category: 'Rent' }) // balance = 300
      const incomeTxId = state.transactions.find((t) => t.type === 'income').id

      // Trying to reverse 1000 when balance is only 300 must fail
      expect(() => deleteTransaction(state, incomeTxId)).toThrow(/current balance .* is less than/)
    })

    it('deleting an expense transaction refunds the amount back to balance', () => {
      let state = getInitialState({ balance: 5000 })
      state = recordExpense(state, { amount: 800, category: 'Groceries' })
      expect(state.balance).toBe(4200)
      const txId = state.transactions[0].id

      const reversed = deleteTransaction(state, txId)
      expect(reversed.balance).toBe(5000)
      expect(reversed.transactions).toHaveLength(0)
    })

    it('deleting a savings deposit reverses both savings and cash balance', () => {
      let state = getInitialState({ balance: 5000, savings: 1000 })
      state = recordSavingsDeposit(state, { amount: 2000 })
      expect(state.balance).toBe(3000)
      expect(state.savings).toBe(3000)
      const txId = state.transactions[0].id

      const reversed = deleteTransaction(state, txId)
      expect(reversed.balance).toBe(5000)
      expect(reversed.savings).toBe(1000)
      expect(reversed.transactions).toHaveLength(0)
    })

    it('deleting a savings withdrawal reverses both savings and cash balance', () => {
      let state = getInitialState({ balance: 2000, savings: 5000 })
      state = recordSavingsWithdrawal(state, { amount: 1500 })
      expect(state.balance).toBe(3500)
      expect(state.savings).toBe(3500)
      const txId = state.transactions[0].id

      const reversed = deleteTransaction(state, txId)
      expect(reversed.balance).toBe(2000)
      expect(reversed.savings).toBe(5000)
      expect(reversed.transactions).toHaveLength(0)
    })

    it('deleting a loan repayment restores outstanding loan amount and refunds cash', () => {
      let state = getInitialState({ balance: 5000 })
      state = createLoan(state, { name: 'Neha', amount: 3000, type: 'borrowed' })
      const loanId = state.loans[0].id
      state = repayLoan(state, { loanId, amount: 1000 })
      expect(state.balance).toBe(7000) // 5000 + 3000 - 1000
      expect(state.loans[0].outstanding).toBe(2000)

      const repaymentTx = state.transactions[0]
      const reversed = deleteTransaction(state, repaymentTx.id)
      expect(reversed.balance).toBe(8000)
      expect(reversed.loans[0].outstanding).toBe(3000)
      expect(reversed.loans[0].status).toBe('active')
    })
  })

  describe('C3: Savings Deposit and Withdrawal History', () => {
    it('records deposit into savings as an internal transfer with full ledger entry', () => {
      const state = getInitialState({ balance: 4000, savings: 1000 })
      const next = recordSavingsDeposit(state, { amount: 1500, note: 'Emergency fund' })
      expect(next.balance).toBe(2500)
      expect(next.savings).toBe(2500)
      expect(next.transactions).toHaveLength(1)
      expect(next.transactions[0].type).toBe('savings_deposit')
      expect(next.transactions[0].category).toBe('Savings')
    })

    it('records withdrawal from savings as an internal transfer with full ledger entry', () => {
      const state = getInitialState({ balance: 1000, savings: 4000 })
      const next = recordSavingsWithdrawal(state, { amount: 2000, note: 'Need cash' })
      expect(next.balance).toBe(3000)
      expect(next.savings).toBe(2000)
      expect(next.transactions).toHaveLength(1)
      expect(next.transactions[0].type).toBe('savings_withdraw')
      expect(next.transactions[0].category).toBe('Savings')
    })

    it('prevents withdrawing more than available savings', () => {
      const state = getInitialState({ balance: 1000, savings: 500 })
      expect(() => recordSavingsWithdrawal(state, { amount: 600 })).toThrow(/Insufficient savings balance/)
    })

    it('prevents depositing more than available cash balance', () => {
      const state = getInitialState({ balance: 800, savings: 1000 })
      expect(() => recordSavingsDeposit(state, { amount: 1000 })).toThrow(/Insufficient cash balance/)
    })
  })

  describe('C7: Monthly Salary Automation & Idempotency', () => {
    it('credits salary and auto-saves once on or after configured salary day', () => {
      const state = getInitialState({
        balance: 1000,
        savings: 500,
        lastSalaryMonth: '2026-09',
        settings: { salaryAmount: 3000, salaryDay: 5, autoSaveAmount: 600, autoSaveEnabled: true },
      })

      const testDate = new Date('2026-10-06T10:00:00Z')
      const result = processSalaryAutomation(state, { now: testDate })
      expect(result.processed).toBe(true)
      expect(result.state.balance).toBe(3400) // 1000 + (3000 - 600)
      expect(result.state.savings).toBe(1100) // 500 + 600
      expect(result.state.lastSalaryMonth).toBe('2026-10')
      expect(result.state.transactions).toHaveLength(2) // salary + auto-save
    })

    it('is strictly idempotent: second call within same month does not credit twice', () => {
      const state = getInitialState({
        balance: 1000,
        savings: 500,
        lastSalaryMonth: '2026-09',
        settings: { salaryAmount: 2000, salaryDay: 5, autoSaveAmount: 500, autoSaveEnabled: true },
      })
      const testDate = new Date('2026-10-06T10:00:00Z')
      const firstRun = processSalaryAutomation(state, { now: testDate })
      expect(firstRun.processed).toBe(true)

      const secondRun = processSalaryAutomation(firstRun.state, { now: testDate })
      expect(secondRun.processed).toBe(false)
      expect(secondRun.reason).toBe('already_credited')
      expect(secondRun.state.balance).toBe(firstRun.state.balance)
      expect(secondRun.state.savings).toBe(firstRun.state.savings)
      expect(secondRun.state.transactions.length).toBe(firstRun.state.transactions.length)
    })

    it('does not credit if scheduled day has not arrived', () => {
      const state = getInitialState({
        balance: 1000,
        lastSalaryMonth: '2026-09',
        settings: { salaryAmount: 2000, salaryDay: 5, autoSaveAmount: 500, autoSaveEnabled: true },
      })
      const testDate = new Date('2026-10-03T10:00:00Z') // Day 3 < Day 5
      const result = processSalaryAutomation(state, { now: testDate })
      expect(result.processed).toBe(false)
      expect(result.reason).toBe('scheduled_date_not_reached')
      expect(result.state.balance).toBe(1000)
    })
  })

  describe('Transaction Editing', () => {
    it('editing amount safely reverses old effect and applies new effect', () => {
      let state = getInitialState({ balance: 5000 })
      state = recordExpense(state, { amount: 500, category: 'Food', note: 'Lunch' })
      expect(state.balance).toBe(4500)
      const txId = state.transactions[0].id

      // Edit amount from 500 to 700
      const edited = editTransaction(state, txId, { amount: 700 })
      expect(edited.balance).toBe(4300) // 5000 - 700
      expect(edited.transactions[0].amount).toBe(700)
    })
  })

  describe('Pristine Zero State for New Users (Zero Hardcoded Defaults)', () => {
    it('initializes raw empty state with 0 values across all metrics', () => {
      const freshState = normalizeState({})
      expect(freshState.balance).toBe(0)
      expect(freshState.savings).toBe(0)
      expect(freshState.savingsGoal).toBe(0)
      expect(freshState.loans).toEqual([])
      expect(freshState.transactions).toEqual([])
      expect(freshState.settings.salaryAmount).toBe(0)
      expect(freshState.settings.autoSaveAmount).toBe(0)
      expect(freshState.settings.autoSaveEnabled).toBe(false)
      expect(freshState.settings.recurringIncomes).toEqual([])
      expect(freshState.deletedTxIds).toEqual({})
      expect(freshState.deletedLoanIds).toEqual({})
    })
  })

  describe('Loan Integrity & Metadata Synchronization (Stage 2)', () => {
    it('restores mathematical consistency when loan outstanding balance is malformed or out of sync', () => {
      const malformed = {
        balance: 10000,
        loans: [
          {
            id: 'loan-sync-1',
            name: 'Debt 1',
            amount: 5000,
            outstanding: 99999, // Corrupted: exceeds original amount
            repayments: [
              { id: 'rep-1', amount: 1500, date: '2026-10-01' },
              { id: 'rep-2', amount: 500, date: '2026-10-05' },
            ],
          },
          {
            id: 'loan-sync-2',
            name: 'Debt 2',
            amount: 3000,
            outstanding: -200, // Corrupted: negative outstanding
            repayments: [],
          },
        ],
      }

      const normalized = normalizeState(malformed)
      // Debt 1: 5000 - (1500 + 500) = 3000
      expect(normalized.loans[0].outstanding).toBe(3000)
      expect(normalized.loans[0].status).toBe('partially_paid')

      // Debt 2: 3000 - 0 = 3000
      expect(normalized.loans[1].outstanding).toBe(3000)
      expect(normalized.loans[1].status).toBe('active')
    })

    it('matches and deletes legacy borrowed loan with note "Borrowed from Alex"', () => {
      const state = normalizeState({
        balance: 5000,
        loans: [
          {
            id: 'legacy-loan-1',
            name: 'Alex',
            type: 'borrowed',
            amount: 2000,
            outstanding: 2000,
            repayments: [],
          },
        ],
        transactions: [
          {
            id: 'tx-legacy-borrow',
            type: 'loan_borrow',
            amount: 2000,
            note: 'Borrowed from Alex', // Legacy note format
            // Notice: no loanId on legacy transaction!
          },
        ],
      })

      const afterDelete = deleteTransaction(state, 'tx-legacy-borrow')
      expect(afterDelete.balance).toBe(3000) // 5000 - 2000
      expect(afterDelete.loans).toHaveLength(0)
      expect(afterDelete.transactions).toHaveLength(0)
      expect(afterDelete.deletedTxIds['tx-legacy-borrow']).toBeDefined()
      expect(afterDelete.deletedLoanIds['legacy-loan-1']).toBeDefined()
    })

    it('updates both the transaction and loan repayment metadata when editing note/date', () => {
      let state = normalizeState({ balance: 10000 })
      state = createLoan(state, { name: 'Bob', amount: 4000, type: 'borrowed' })
      const loanId = state.loans[0].id
      state = repayLoan(state, { loanId, amount: 1000, note: 'Initial installment', date: '2026-10-01' })

      const repaymentTx = state.transactions.find((t) => t.type === 'loan_repayment')
      expect(repaymentTx).toBeDefined()

      // Edit metadata only
      const updated = editTransaction(state, repaymentTx.id, {
        note: 'Updated installment note',
        date: '2026-10-02',
      })

      // Transaction is updated
      const updatedTx = updated.transactions.find((t) => t.id === repaymentTx.id)
      expect(updatedTx.note).toBe('Updated installment note')
      expect(updatedTx.date).toBe('2026-10-02')

      // Loan's repayments array record is also updated
      const updatedLoan = updated.loans.find((l) => l.id === loanId)
      expect(updatedLoan.repayments[0].note).toBe('Updated installment note')
      expect(updatedLoan.repayments[0].date).toBe('2026-10-02')
    })

    it('rejects editing loan transaction amount with a clear validation error', () => {
      let state = normalizeState({ balance: 10000 })
      state = createLoan(state, { name: 'Charlie', amount: 2000, type: 'borrowed' })
      const loanId = state.loans[0].id
      state = repayLoan(state, { loanId, amount: 500 })

      const repaymentTx = state.transactions.find((t) => t.type === 'loan_repayment')

      expect(() => editTransaction(state, repaymentTx.id, { amount: 600 })).toThrow(
        /Editing the amount or type of a loan transaction is not supported/
      )
    })
  })

  describe('Tombstone Pruning & Retention (Stage 4)', () => {
    it('prunes tombstones older than maxAgeDays while preserving minKeep newest entries', () => {
      const now = Date.now()
      const dayMs = 24 * 60 * 60 * 1000

      // Create 10 tombstones: 5 very old (>100 days), 5 recent
      const tombstones = {}
      for (let i = 1; i <= 5; i++) {
        tombstones[`old-${i}`] = new Date(now - (100 + i) * dayMs).toISOString()
      }
      for (let i = 1; i <= 5; i++) {
        tombstones[`recent-${i}`] = new Date(now - i * dayMs).toISOString()
      }

      // If minKeep is 3 and maxAgeDays is 90:
      // The 5 recent ones are kept (age < 90), old ones are pruned
      const pruned = pruneTombstones(tombstones, { maxAgeDays: 90, minKeep: 3 })
      expect(Object.keys(pruned)).toHaveLength(5)
      expect(pruned['recent-1']).toBeDefined()
      expect(pruned['old-1']).toBeUndefined()

      // If minKeep is 8 and maxAgeDays is 90:
      // All 5 recent ones + 3 newest old ones must be kept to satisfy minKeep: 8
      const prunedMinKeep = pruneTombstones(tombstones, { maxAgeDays: 90, minKeep: 8 })
      expect(Object.keys(prunedMinKeep)).toHaveLength(8)
    })
  })
})
