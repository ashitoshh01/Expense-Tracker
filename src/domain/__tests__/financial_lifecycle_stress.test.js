import { describe, it, expect } from 'vitest'
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
} from '../accounting'
import { toPaise } from '../money'

describe('Section 2 & 4: Financial Accounting & Reversal Stress Suite', () => {
  it('executes the full 8-step dependent financial operation stress lifecycle correctly', () => {
    // 1. Start with ₹0 cash and ₹0 savings
    let state = normalizeState({ balance: 0, savings: 0, loans: [], transactions: [] })
    expect(state.balance).toBe(0)
    expect(state.savings).toBe(0)
    expect(state.loans).toHaveLength(0)

    // 2. Receive ₹10,000 income
    state = recordIncome(state, { amount: 10000, category: 'Salary', note: 'Monthly Paycheck' })
    const incomeTxId = state.transactions[0].id
    expect(state.balance).toBe(10000)
    expect(state.savings).toBe(0)

    // 3. Deposit ₹3,000 into savings
    state = recordSavingsDeposit(state, { amount: 3000, note: 'Emergency Fund' })
    const depositTxId = state.transactions[0].id
    expect(state.balance).toBe(7000)
    expect(state.savings).toBe(3000)

    // 4. Withdraw ₹1,000 from savings
    state = recordSavingsWithdrawal(state, { amount: 1000, note: 'Urgent repair' })
    const withdrawTxId = state.transactions[0].id
    expect(state.balance).toBe(8000)
    expect(state.savings).toBe(2000)

    // 5. Record a ₹2,000 expense
    state = recordExpense(state, { amount: 2000, category: 'Groceries', note: 'Weekly supermarket' })
    const expenseTxId = state.transactions[0].id
    expect(state.balance).toBe(6000)
    expect(state.savings).toBe(2000)

    // 6. Borrow ₹4,000
    state = createLoan(state, { type: 'borrowed', amount: 4000, name: 'Alice' })
    const loanId = state.loans[0].id
    expect(state.balance).toBe(10000)
    expect(state.loans[0].outstanding).toBe(4000)
    expect(state.loans[0].status).toBe('active')

    // 7. Repay ₹1,500 partially
    state = repayLoan(state, { loanId, amount: 1500, note: 'Part 1 repayment' })
    const repayTxId = state.transactions[0].id
    expect(state.balance).toBe(8500)
    expect(state.savings).toBe(2000)
    expect(state.loans[0].outstanding).toBe(2500)
    expect(state.loans[0].status).toBe('partially_paid')
    expect(state.loans[0].repayments).toHaveLength(1)

    // 8. Stress test reversals & deletions:

    // 8a. Reversing the ₹1,500 loan repayment restores outstanding debt and refunds cash
    state = deleteTransaction(state, repayTxId)
    expect(state.balance).toBe(10000) // ₹8,500 + ₹1,500 = ₹10,000
    expect(state.loans[0].outstanding).toBe(4000)
    expect(state.loans[0].status).toBe('active')
    expect(state.loans[0].repayments).toHaveLength(0)

    // 8b. Reversing ₹2,000 expense refunds balance
    state = deleteTransaction(state, expenseTxId)
    expect(state.balance).toBe(12000)

    // 8c. Attempting to delete savings deposit when savings is insufficient:
    // Currently savings is ₹2,000 (after ₹1,000 withdrawal). Deposit was ₹3,000.
    // Deleting ₹3,000 deposit requires ₹3,000 in savings. Must throw error!
    expect(() => {
      deleteTransaction(state, depositTxId)
    }).toThrow(/Cannot delete savings deposit: savings balance .* is less than deposit amount/)

    // 8d. Reversing the ₹1,000 savings withdrawal restores savings to ₹3,000 and cash to ₹11,000
    state = deleteTransaction(state, withdrawTxId)
    expect(state.balance).toBe(11000)
    expect(state.savings).toBe(3000)

    // 8e. Now deleting the ₹3,000 savings deposit succeeds because savings has ₹3,000!
    state = deleteTransaction(state, depositTxId)
    expect(state.balance).toBe(14000) // refunded deposit to cash
    expect(state.savings).toBe(0)

    // 8f. Delete borrowed loan: cancels debt and deducts cash
    const borrowTx = state.transactions.find((t) => t.loanId === loanId || t.note === 'Alice')
    state = deleteTransaction(state, borrowTx.id)
    expect(state.balance).toBe(10000)
    expect(state.loans).toHaveLength(0)

    // 8g. Finally delete initial ₹10,000 income -> balance back to ₹0
    state = deleteTransaction(state, incomeTxId)
    expect(state.balance).toBe(0)
    expect(state.savings).toBe(0)
    expect(state.transactions).toHaveLength(0)
  })

  it('handles lent money lifecycle with partial collections, full collection, and symmetric reversal', () => {
    let state = normalizeState({ balance: 5000, savings: 0, loans: [], transactions: [] })

    // Lend ₹3,000 to Bob
    state = createLoan(state, { type: 'lent', amount: 3000, name: 'Bob' })
    const loanId = state.loans[0].id
    expect(state.balance).toBe(2000) // cash deducted
    expect(state.loans[0].outstanding).toBe(3000)

    // Bob repays ₹1,000 partial
    state = repayLoan(state, { loanId, amount: 1000, note: 'Bob installment 1' })
    const collectionTx1 = state.transactions[0]
    expect(state.balance).toBe(3000) // collected cash added
    expect(state.loans[0].outstanding).toBe(2000)
    expect(state.loans[0].status).toBe('partially_paid')

    // Bob repays remaining ₹2,000 full
    state = repayLoan(state, { loanId, amount: 2000, note: 'Bob installment 2' })
    const collectionTx2 = state.transactions[0]
    expect(state.balance).toBe(5000)
    expect(state.loans[0].outstanding).toBe(0)
    expect(state.loans[0].status).toBe('repaid')

    // Reverse collectionTx2: restores debt to ₹2,000, removes repayment record, deducts ₹2,000 cash
    state = deleteTransaction(state, collectionTx2.id)
    expect(state.balance).toBe(3000)
    expect(state.loans[0].outstanding).toBe(2000)
    expect(state.loans[0].status).toBe('partially_paid')
    expect(state.loans[0].repayments).toHaveLength(1)

    // Reverse collectionTx1: restores debt to ₹3,000, deducts ₹1,000 cash
    state = deleteTransaction(state, collectionTx1.id)
    expect(state.balance).toBe(2000)
    expect(state.loans[0].outstanding).toBe(3000)
    expect(state.loans[0].status).toBe('active')
    expect(state.loans[0].repayments).toHaveLength(0)
  })

  it('rejects editing a transaction when balance invariant would be violated', () => {
    let state = normalizeState({ balance: 1000, savings: 0, loans: [], transactions: [] })
    state = recordExpense(state, { amount: 500, category: 'Food', note: 'Dinner' })
    const expId = state.transactions[0].id
    expect(state.balance).toBe(500)

    // Edit expense amount from ₹500 to ₹2,000. Balance is only ₹1,000 after reversal of 500, so ₹2,000 expense throws!
    expect(() => {
      editTransaction(state, expId, { amount: 2000 })
    }).toThrow(/Insufficient balance/)

    // Edit metadata only works seamlessly
    state = editTransaction(state, expId, { note: 'Dinner with colleagues', category: 'Dining' })
    expect(state.transactions[0].note).toBe('Dinner with colleagues')
    expect(state.transactions[0].category).toBe('Dining')
    expect(state.balance).toBe(500)
  })

  it('ensures atomic rollback: failed operations leave state completely intact', () => {
    const initialState = normalizeState({
      balance: 1000,
      savings: 500,
      loans: [],
      transactions: [{ id: 'tx-1', type: 'income', amount: 1000, date: '2026-10-01' }],
    })

    // Attempt invalid expense exceeding balance
    expect(() => {
      recordExpense(initialState, { amount: 5000, category: 'Shopping' })
    }).toThrow()

    // State is strictly unchanged
    expect(initialState.balance).toBe(1000)
    expect(initialState.savings).toBe(500)
    expect(initialState.transactions).toHaveLength(1)
  })
})
