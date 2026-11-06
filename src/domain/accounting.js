/**
 * Centralized Financial Accounting Engine for Wallet FIX.
 *
 * Implements strict double-entry-style invariants, zero-loss transaction reversals,
 * paise integer arithmetic, and robust validation for all financial mutations.
 */

import { toPaise, toRupees, validateAmount, addMoney, subMoney, genId } from './money.js'

export const SCHEMA_VERSION = 2

export const DEFAULT_SETTINGS = {
  salaryAmount: 0,
  salaryDay: 1,
  autoSaveAmount: 0,
  autoSaveEnabled: false,
  recurringIncomes: [],
  currency: 'INR',
}

/**
 * Prune deletion tombstones to bound memory and storage while preserving
 * synchronization safety across long offline periods.
 * Retention: keeps all tombstones within maxAgeDays (default 90 days),
 * but always preserves at least minKeep (default 500) most recent tombstones.
 *
 * @param {Object} tombstones Object mapping ID to ISO timestamp string
 * @param {Object} [options]
 * @param {number} [options.maxAgeDays=90]
 * @param {number} [options.minKeep=500]
 * @returns {Object} Pruned tombstones object
 */
export function pruneTombstones(tombstones, { maxAgeDays = 90, minKeep = 500 } = {}) {
  if (!tombstones || typeof tombstones !== 'object' || Array.isArray(tombstones)) {
    return {}
  }
  const entries = Object.entries(tombstones)
  if (entries.length <= minKeep) {
    return { ...tombstones }
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  // Sort descending by timestamp so newest are first
  entries.sort((a, b) => {
    const timeA = new Date(a[1] || 0).getTime()
    const timeB = new Date(b[1] || 0).getTime()
    return timeB - timeA
  })

  const pruned = {}
  entries.forEach(([id, timestamp], index) => {
    const time = new Date(timestamp || 0).getTime()
    if (index < minKeep || time > cutoff) {
      pruned[id] = timestamp
    }
  })
  return pruned
}

/**
 * Normalizes and validates raw or legacy state into a consistent financial state.
 * Fully backward-compatible with legacy storage formats.
 * @param {Object} raw
 * @returns {Object} Cleaned, consistent financial state
 */
export function normalizeState(raw = {}) {
  const numBalance = Number(raw.balance)
  const balance = Number.isFinite(numBalance) ? toRupees(toPaise(numBalance)) : 0

  const numSavings = Number(raw.savings)
  const savings = Number.isFinite(numSavings) ? Math.max(0, toRupees(toPaise(numSavings))) : 0

  const numGoal = Number(raw.savingsGoal)
  const savingsGoal = Number.isFinite(numGoal) && numGoal > 0 ? numGoal : 0
  const lastSalaryMonth = typeof raw.lastSalaryMonth === 'string' ? raw.lastSalaryMonth : ''

  // Normalize loans
  const rawLoans = Array.isArray(raw.loans) ? raw.loans : []
  const loans = rawLoans.map((l) => {
    const numAmt = Number(l.amount)
    const originalAmount = Number.isFinite(numAmt) ? toRupees(toPaise(numAmt)) : 0
    const repayments = Array.isArray(l.repayments)
      ? l.repayments.map((r) => ({
          ...r,
          amount: Number.isFinite(Number(r.amount)) ? toRupees(toPaise(Number(r.amount))) : 0,
        }))
      : []
    const totalRepaid = repayments.reduce((sum, r) => addMoney(sum, r.amount), 0)
    const computedOutstanding = Math.max(0, subMoney(originalAmount, totalRepaid))
    const numOutstanding = Number(l.outstanding)
    const outstanding =
      repayments.length > 0 || !Number.isFinite(numOutstanding) || numOutstanding < 0 || numOutstanding > originalAmount
        ? computedOutstanding
        : toRupees(toPaise(numOutstanding))
    const status = toPaise(outstanding) === 0 ? 'repaid' : toPaise(outstanding) === toPaise(originalAmount) ? 'active' : 'partially_paid'
    const type = l.type === 'lent' ? 'lent' : 'borrowed'

    return {
      id: l.id || genId(),
      name: l.name || 'Unknown',
      amount: originalAmount,
      outstanding,
      type,
      date: l.date || new Date().toISOString().split('T')[0],
      dueDate: l.dueDate || '',
      status,
      repayments,
      createdAt: l.createdAt || new Date().toISOString(),
    }
  })

  // Normalize transactions
  const rawTxs = Array.isArray(raw.transactions) ? raw.transactions : []
  const transactions = rawTxs.map((t) => {
    const numTxAmt = Number(t.amount)
    const txAmount = Number.isFinite(numTxAmt) ? toRupees(toPaise(numTxAmt)) : 0
    return {
      id: t.id || genId(),
      type: t.type || 'spent',
      category: t.category || (t.type === 'spent' ? 'Other' : 'General'),
      amount: txAmount,
      note: t.note || '',
      date: t.date || new Date().toISOString().split('T')[0],
      loanId: t.loanId || undefined,
      repaymentId: t.repaymentId || undefined,
      linkedTxId: t.linkedTxId || undefined,
      sourceId: t.sourceId || undefined,
      reversalOf: t.reversalOf || undefined,
      isReversed: Boolean(t.isReversed),
      createdAt: t.createdAt || new Date().toISOString(),
    }
  })

  // Normalize recurring income sources
  const rawRecurring = Array.isArray(raw.settings?.recurringIncomes) ? raw.settings.recurringIncomes : []
  const recurringIncomes = rawRecurring.map((inc) => ({
    id: inc.id || genId(),
    name: String(inc.name || 'Monthly Income').trim(),
    amount: Number.isFinite(Number(inc.amount)) && Number(inc.amount) > 0 ? Number(inc.amount) : 0,
    creditDay:
      Number.isInteger(Number(inc.creditDay)) && Number(inc.creditDay) >= 1 && Number(inc.creditDay) <= 31
        ? Number(inc.creditDay)
        : 1,
    autoSaveAmount:
      Number.isFinite(Number(inc.autoSaveAmount)) && Number(inc.autoSaveAmount) >= 0
        ? Number(inc.autoSaveAmount)
        : 0,
    category: inc.category || 'Salary',
    enabled: inc.enabled !== false,
  }))

  const rawSalaryAmount = Number(raw.settings?.salaryAmount)
  const salaryAmount = Number.isFinite(rawSalaryAmount) && rawSalaryAmount > 0 ? rawSalaryAmount : 0

  const rawAutoSaveAmount = Number(raw.settings?.autoSaveAmount)
  const autoSaveAmount = Number.isFinite(rawAutoSaveAmount) && rawAutoSaveAmount > 0 ? rawAutoSaveAmount : 0

  const autoSaveEnabled = Boolean(raw.settings?.autoSaveEnabled)

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(raw.settings || {}),
    salaryAmount,
    autoSaveAmount,
    autoSaveEnabled,
    recurringIncomes,
  }

  const recurringIncomeHistory =
    typeof raw.recurringIncomeHistory === 'object' && raw.recurringIncomeHistory !== null && !Array.isArray(raw.recurringIncomeHistory)
      ? { ...raw.recurringIncomeHistory }
      : {}

  const rawDeletedTxIds =
    typeof raw.deletedTxIds === 'object' && raw.deletedTxIds !== null && !Array.isArray(raw.deletedTxIds)
      ? raw.deletedTxIds
      : {}
  const rawDeletedLoanIds =
    typeof raw.deletedLoanIds === 'object' && raw.deletedLoanIds !== null && !Array.isArray(raw.deletedLoanIds)
      ? raw.deletedLoanIds
      : {}

  const deletedTxIds = pruneTombstones(rawDeletedTxIds)
  const deletedLoanIds = pruneTombstones(rawDeletedLoanIds)

  return {
    balance,
    savings,
    loans,
    transactions,
    savingsGoal,
    lastSalaryMonth,
    recurringIncomeHistory,
    deletedTxIds,
    deletedLoanIds,
    settings,
    version: SCHEMA_VERSION,
    updatedAt: raw.updatedAt || new Date().toISOString(),
  }
}

/**
 * Record an external Income transaction.
 */
export function recordIncome(state, { amount, category = 'Salary', note = '', date = new Date().toISOString().split('T')[0], id = genId() }) {
  const amt = validateAmount(amount)
  const tx = {
    id,
    type: 'income',
    category: category || 'Income',
    amount: amt,
    note: note || '',
    date,
    createdAt: new Date().toISOString(),
  }

  return {
    ...state,
    balance: addMoney(state.balance, amt),
    transactions: [tx, ...state.transactions],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Record an external Expense transaction.
 */
export function recordExpense(state, { amount, category = 'Other', note = '', date = new Date().toISOString().split('T')[0], id = genId(), allowOverdraft = false }) {
  const amt = validateAmount(amount)
  if (!allowOverdraft && toPaise(state.balance) < toPaise(amt)) {
    throw new Error(`Insufficient balance (₹${state.balance.toFixed(2)}) for expense of ₹${amt.toFixed(2)}`)
  }

  const tx = {
    id,
    type: 'spent',
    category: category || 'Other',
    amount: amt,
    note: note || '',
    date,
    createdAt: new Date().toISOString(),
  }

  return {
    ...state,
    balance: subMoney(state.balance, amt),
    transactions: [tx, ...state.transactions],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Record a Deposit into Savings (transfer cash -> savings).
 * Strict invariant: cash balance drops by amt, savings rises by amt.
 */
export function recordSavingsDeposit(state, { amount, note = 'Transferred to savings', date = new Date().toISOString().split('T')[0], id = genId() }) {
  const amt = validateAmount(amount)
  if (toPaise(state.balance) < toPaise(amt)) {
    throw new Error(`Insufficient cash balance (₹${state.balance.toFixed(2)}) to deposit ₹${amt.toFixed(2)} into savings`)
  }

  const tx = {
    id,
    type: 'savings_deposit',
    category: 'Savings',
    amount: amt,
    note: note || 'Transferred to savings',
    date,
    createdAt: new Date().toISOString(),
  }

  return {
    ...state,
    balance: subMoney(state.balance, amt),
    savings: addMoney(state.savings, amt),
    transactions: [tx, ...state.transactions],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Record a Withdrawal from Savings (transfer savings -> cash).
 * Strict invariant: savings drops by amt, cash balance rises by amt.
 */
export function recordSavingsWithdrawal(state, { amount, note = 'Withdrawn from savings', date = new Date().toISOString().split('T')[0], id = genId() }) {
  const amt = validateAmount(amount)
  if (toPaise(state.savings) < toPaise(amt)) {
    throw new Error(`Insufficient savings balance (₹${state.savings.toFixed(2)}) to withdraw ₹${amt.toFixed(2)}`)
  }

  const tx = {
    id,
    type: 'savings_withdraw',
    category: 'Savings',
    amount: amt,
    note: note || 'Withdrawn from savings',
    date,
    createdAt: new Date().toISOString(),
  }

  return {
    ...state,
    balance: addMoney(state.balance, amt),
    savings: subMoney(state.savings, amt),
    transactions: [tx, ...state.transactions],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Record a new Loan (borrowed from someone or lent to someone).
 * If type === 'borrowed': Cash increases, debt created.
 * If type === 'lent': Cash decreases, receivable asset created.
 */
export function createLoan(state, { name, amount, type = 'borrowed', dueDate = '', note = '', date = new Date().toISOString().split('T')[0], id = genId() }) {
  const amt = validateAmount(amount)
  const trimmedName = (name || '').trim()
  if (!trimmedName) {
    throw new Error('Person name is required for loan')
  }

  const isLent = type === 'lent'
  if (isLent && toPaise(state.balance) < toPaise(amt)) {
    throw new Error(`Insufficient balance (₹${state.balance.toFixed(2)}) to lend ₹${amt.toFixed(2)}`)
  }

  const loan = {
    id,
    name: trimmedName,
    amount: amt,
    outstanding: amt,
    type: isLent ? 'lent' : 'borrowed',
    date,
    dueDate: dueDate || '',
    status: 'active',
    repayments: [],
    createdAt: new Date().toISOString(),
  }

  const tx = {
    id: genId(),
    type: isLent ? 'loan_lend' : 'loan_borrow',
    category: 'Loan',
    amount: amt,
    note: isLent ? `Lent money to ${trimmedName}` : `Borrowed from ${trimmedName}`,
    date,
    loanId: id,
    createdAt: new Date().toISOString(),
  }

  return {
    ...state,
    balance: isLent ? subMoney(state.balance, amt) : addMoney(state.balance, amt),
    loans: [loan, ...state.loans],
    transactions: [tx, ...state.transactions],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Repay a Loan (Full or Partial).
 *
 * Requirements satisfied:
 * 1. Validate loan exists.
 * 2. Validate repayment amount is positive, finite, and <= outstanding.
 * 3. Validate user has sufficient available funds (if borrowed).
 * 4. Deduct repayment amount from available balance (if borrowed) or add to balance (if lent).
 * 5. Record a corresponding repayment transaction in transaction ledger.
 * 6. Update the outstanding loan amount.
 * 7. Mark as fully repaid when outstanding reaches zero.
 * 8. Support partial repayments and record repayment history on the loan object.
 */
export function repayLoan(state, { loanId, amount, note = '', date = new Date().toISOString().split('T')[0], id = genId() }) {
  const loanIndex = state.loans.findIndex((l) => l.id === loanId)
  if (loanIndex === -1) {
    throw new Error(`Loan with ID "${loanId}" not found`)
  }

  const loan = state.loans[loanIndex]
  if (loan.status === 'repaid' || toPaise(loan.outstanding) <= 0) {
    throw new Error(`Loan from "${loan.name}" has already been fully repaid`)
  }

  const amt = validateAmount(amount)
  if (toPaise(amt) > toPaise(loan.outstanding)) {
    throw new Error(`Repayment amount ₹${amt.toFixed(2)} exceeds outstanding debt ₹${loan.outstanding.toFixed(2)}`)
  }

  const isBorrowed = loan.type !== 'lent'
  if (isBorrowed && toPaise(state.balance) < toPaise(amt)) {
    throw new Error(`Insufficient balance (₹${state.balance.toFixed(2)}) to repay ₹${amt.toFixed(2)}`)
  }

  const newOutstanding = subMoney(loan.outstanding, amt)
  const isFullyRepaid = toPaise(newOutstanding) === 0

  const repaymentRecord = {
    id,
    amount: amt,
    date,
    note: note || (isFullyRepaid ? 'Full repayment' : 'Partial repayment'),
    createdAt: new Date().toISOString(),
  }

  const updatedLoan = {
    ...loan,
    outstanding: newOutstanding,
    status: isFullyRepaid ? 'repaid' : 'partially_paid',
    repayments: [...loan.repayments, repaymentRecord],
  }

  const tx = {
    id: genId(),
    type: isBorrowed ? 'loan_repayment' : 'loan_collection',
    category: 'Loan',
    amount: amt,
    note: note || (isBorrowed ? `Repayment to ${loan.name}` : `Repayment received from ${loan.name}`),
    date,
    loanId: loan.id,
    repaymentId: id,
    createdAt: new Date().toISOString(),
  }

  const updatedLoans = [...state.loans]
  updatedLoans[loanIndex] = updatedLoan

  return {
    ...state,
    balance: isBorrowed ? subMoney(state.balance, amt) : addMoney(state.balance, amt),
    loans: updatedLoans,
    transactions: [tx, ...state.transactions],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Delete and safely Reverse a Transaction.
 *
 * Implements strict per-type financial reversal:
 * - Income / Salary: balance -= amount (ensures balance does not drop negative unless allowed)
 * - Expense / Spent: balance += amount (refund)
 * - Savings Deposit: savings -= amount, balance += amount (verifies savings >= amount)
 * - Savings Withdrawal: balance -= amount, savings += amount (verifies balance >= amount)
 * - Loan Repayment: reverses repayment, updates loan outstanding and status, refunds cash balance.
 * - Loan Collection: reverses collection, restores loan outstanding, deducts cash balance.
 * - Loan Borrow: verifies loan has no repayments before reversing, cancels loan liability and balance.
 * - Loan Lend: cancels loan asset, refunds balance.
 */
export function deleteTransaction(state, txId) {
  const tx = state.transactions.find((t) => t.id === txId)
  if (!tx) {
    throw new Error(`Transaction with ID "${txId}" not found`)
  }

  let nextBalance = state.balance
  let nextSavings = state.savings
  let nextLoans = [...state.loans]
  const amt = tx.amount

  const txType = tx.type
  let linkedTxToRemove = null
  let severLinkedTxId = null
  let deletedLoanId = null

  // Check if this transaction is linked to another transaction (e.g., auto-saved recurring income)
  const linkedTx = tx.linkedTxId ? state.transactions.find((t) => t.id === tx.linkedTxId) : null

  if (txType === 'income' || txType === 'salary' || (txType === 'add' && tx.category !== 'Loan')) {
    if (linkedTx && (linkedTx.type === 'savings_deposit' || linkedTx.type === 'auto_save')) {
      // Compound recurring income reversal with auto-save leg
      const savedAmt = linkedTx.amount
      const netCashCredited = subMoney(amt, savedAmt)

      if (toPaise(nextBalance) < toPaise(netCashCredited)) {
        throw new Error(
          `Cannot delete recurring income: current balance (₹${nextBalance.toFixed(2)}) is less than net credited cash ₹${netCashCredited.toFixed(2)}`
        )
      }
      if (toPaise(nextSavings) < toPaise(savedAmt)) {
        throw new Error(
          `Cannot delete recurring income: savings balance (₹${nextSavings.toFixed(2)}) is less than auto-saved amount ₹${savedAmt.toFixed(2)}`
        )
      }

      nextBalance = subMoney(nextBalance, netCashCredited)
      nextSavings = subMoney(nextSavings, savedAmt)
      linkedTxToRemove = linkedTx
    } else {
      // Regular income reversal reduces cash balance
      if (toPaise(nextBalance) < toPaise(amt)) {
        throw new Error(
          `Cannot delete income: current balance (₹${nextBalance.toFixed(2)}) is less than transaction amount ₹${amt.toFixed(2)}`
        )
      }
      nextBalance = subMoney(nextBalance, amt)
    }
  } else if (txType === 'spent' || txType === 'expense') {
    // Reversing expense refunds balance
    nextBalance = addMoney(nextBalance, amt)
  } else if (txType === 'savings_deposit' || txType === 'auto_save') {
    if (toPaise(nextSavings) < toPaise(amt)) {
      throw new Error(
        `Cannot delete savings deposit: savings balance (₹${nextSavings.toFixed(2)}) is less than deposit amount ₹${amt.toFixed(2)}`
      )
    }
    // Reversing savings deposit: refund cash, reduce savings
    nextSavings = subMoney(nextSavings, amt)
    nextBalance = addMoney(nextBalance, amt)

    // If this was an auto-save leg linked to a salary/income, unlink it so parent income can still be deleted later independently
    if (linkedTx && (linkedTx.type === 'income' || linkedTx.type === 'salary')) {
      severLinkedTxId = linkedTx.id
    }
  } else if (txType === 'savings_withdraw') {
    // Reversing savings withdrawal: refund savings, reduce cash
    if (toPaise(nextBalance) < toPaise(amt)) {
      throw new Error(
        `Cannot delete savings withdrawal: cash balance (₹${nextBalance.toFixed(2)}) is less than withdrawal amount ₹${amt.toFixed(2)}`
      )
    }
    nextBalance = subMoney(nextBalance, amt)
    nextSavings = addMoney(nextSavings, amt)
  } else if (txType === 'loan_repayment') {
    // Reversing a loan repayment: refund cash, increase loan outstanding
    const loan = nextLoans.find((l) => l.id === tx.loanId)
    if (loan) {
      const repIndex = loan.repayments.findIndex(
        (r) =>
          (tx.repaymentId && r.id === tx.repaymentId) ||
          (!tx.repaymentId && r.amount === amt && r.date === tx.date)
      )
      const updatedRepayments = repIndex !== -1 ? loan.repayments.filter((_, idx) => idx !== repIndex) : loan.repayments
      const totalRepaid = updatedRepayments.reduce((sum, r) => addMoney(sum, r.amount), 0)
      const newOutstanding = Math.max(0, subMoney(loan.amount, totalRepaid))

      const updatedLoan = {
        ...loan,
        outstanding: newOutstanding,
        status:
          toPaise(newOutstanding) === toPaise(loan.amount)
            ? 'active'
            : toPaise(newOutstanding) === 0
            ? 'repaid'
            : 'partially_paid',
        repayments: updatedRepayments,
      }
      nextLoans = nextLoans.map((l) => (l.id === loan.id ? updatedLoan : l))
    }
    nextBalance = addMoney(nextBalance, amt)
  } else if (txType === 'loan_collection') {
    // Reversing loan collection: deduct collected cash from balance, increase loan outstanding
    if (toPaise(nextBalance) < toPaise(amt)) {
      throw new Error(
        `Cannot delete loan collection: current balance (₹${nextBalance.toFixed(2)}) is less than collection amount ₹${amt.toFixed(2)}`
      )
    }
    const loan = nextLoans.find((l) => l.id === tx.loanId)
    if (loan) {
      const repIndex = loan.repayments.findIndex(
        (r) =>
          (tx.repaymentId && r.id === tx.repaymentId) ||
          (!tx.repaymentId && r.amount === amt && r.date === tx.date)
      )
      const updatedRepayments = repIndex !== -1 ? loan.repayments.filter((_, idx) => idx !== repIndex) : loan.repayments
      const totalRepaid = updatedRepayments.reduce((sum, r) => addMoney(sum, r.amount), 0)
      const newOutstanding = Math.max(0, subMoney(loan.amount, totalRepaid))

      const updatedLoan = {
        ...loan,
        outstanding: newOutstanding,
        status:
          toPaise(newOutstanding) === toPaise(loan.amount)
            ? 'active'
            : toPaise(newOutstanding) === 0
            ? 'repaid'
            : 'partially_paid',
        repayments: updatedRepayments,
      }
      nextLoans = nextLoans.map((l) => (l.id === loan.id ? updatedLoan : l))
    }
    nextBalance = subMoney(nextBalance, amt)
  } else if (txType === 'loan_borrow' || (txType === 'add' && tx.category === 'Loan')) {
    // Reversing loan borrow: requires deducting borrowed cash from balance
    if (toPaise(nextBalance) < toPaise(amt)) {
      throw new Error(
        `Cannot delete borrowed loan: current balance (₹${nextBalance.toFixed(2)}) is less than loan amount ₹${amt.toFixed(2)}`
      )
    }
    // Check if repayments were made
    const loan = nextLoans.find(
      (l) =>
        (tx.loanId && l.id === tx.loanId) ||
        (!tx.loanId &&
          l.amount === amt &&
          (l.name === tx.note ||
            tx.note === `Borrowed from ${l.name}` ||
            (typeof tx.note === 'string' && tx.note.includes(l.name))))
    )
    if (loan && loan.repayments && loan.repayments.length > 0) {
      throw new Error(`Cannot delete loan that has existing repayments. Please reverse repayments first.`)
    }
    nextBalance = subMoney(nextBalance, amt)
    if (loan) {
      deletedLoanId = loan.id
      nextLoans = nextLoans.filter((l) => l.id !== loan.id)
    }
  } else if (txType === 'loan_lend') {
    const loan = nextLoans.find(
      (l) =>
        (tx.loanId && l.id === tx.loanId) ||
        (!tx.loanId &&
          l.amount === amt &&
          (l.name === tx.note ||
            tx.note === `Lent money to ${l.name}` ||
            (typeof tx.note === 'string' && tx.note.includes(l.name))))
    )
    if (loan && loan.repayments && loan.repayments.length > 0) {
      throw new Error(`Cannot delete lent loan that has repayments.`)
    }
    nextBalance = addMoney(nextBalance, amt)
    if (loan) {
      deletedLoanId = loan.id
      nextLoans = nextLoans.filter((l) => l.id !== loan.id)
    }
  }

  let remainingTransactions = state.transactions.filter(
    (t) => t.id !== txId && (!linkedTxToRemove || t.id !== linkedTxToRemove.id)
  )
  if (severLinkedTxId) {
    remainingTransactions = remainingTransactions.map((t) =>
      t.id === severLinkedTxId ? { ...t, linkedTxId: undefined } : t
    )
  }

  const nextDeletedTxIds = {
    ...(state.deletedTxIds || {}),
    [txId]: new Date().toISOString(),
  }
  if (linkedTxToRemove) {
    nextDeletedTxIds[linkedTxToRemove.id] = new Date().toISOString()
  }
  if (tx.repaymentId) {
    nextDeletedTxIds[tx.repaymentId] = new Date().toISOString()
  }

  const nextDeletedLoanIds = { ...(state.deletedLoanIds || {}) }
  if (deletedLoanId) {
    nextDeletedLoanIds[deletedLoanId] = new Date().toISOString()
  }

  return {
    ...state,
    balance: nextBalance,
    savings: nextSavings,
    loans: nextLoans,
    transactions: remainingTransactions,
    deletedTxIds: pruneTombstones(nextDeletedTxIds),
    deletedLoanIds: pruneTombstones(nextDeletedLoanIds),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Edit an existing transaction safely by reversing the old effect and applying the new effect.
 */
export function editTransaction(state, txId, updates) {
  // First verify transaction exists
  const existingTx = state.transactions.find((t) => t.id === txId)
  if (!existingTx) {
    throw new Error(`Transaction with ID "${txId}" not found`)
  }

  const isLoanTx =
    existingTx.type === 'loan_repayment' ||
    existingTx.type === 'loan_collection' ||
    existingTx.type === 'loan_borrow' ||
    existingTx.type === 'loan_lend'

  // If amount or type changed, perform atomic rollback and re-apply
  const newAmount = updates.amount !== undefined ? validateAmount(updates.amount) : existingTx.amount
  const newCategory = updates.category !== undefined ? updates.category : existingTx.category
  const newNote = updates.note !== undefined ? updates.note : existingTx.note
  const newDate = updates.date !== undefined ? updates.date : existingTx.date

  if (isLoanTx && (newAmount !== existingTx.amount || (updates.type && updates.type !== existingTx.type))) {
    throw new Error('Editing the amount or type of a loan transaction is not supported. Please delete the transaction and re-enter it.')
  }

  if (existingTx.linkedTxId && newAmount !== existingTx.amount) {
    throw new Error('Editing the amount of a linked recurring income transaction is not supported. Please delete the transaction to reverse it.')
  }

  if (newAmount === existingTx.amount && (!updates.type || updates.type === existingTx.type)) {
    // Only metadata changed (note, category, date)
    let nextLoans = state.loans
    if ((existingTx.type === 'loan_repayment' || existingTx.type === 'loan_collection') && existingTx.loanId) {
      nextLoans = state.loans.map((l) => {
        if (l.id !== existingTx.loanId) return l
        const updatedRepayments = (l.repayments || []).map((r) => {
          const isMatch =
            (existingTx.repaymentId && r.id === existingTx.repaymentId) ||
            (!existingTx.repaymentId && r.amount === existingTx.amount && r.date === existingTx.date)
          if (isMatch) {
            return {
              ...r,
              date: newDate,
              note: newNote,
            }
          }
          return r
        })
        return {
          ...l,
          repayments: updatedRepayments,
        }
      })
    }

    return {
      ...state,
      loans: nextLoans,
      transactions: state.transactions.map((t) =>
        t.id === txId ? { ...t, category: newCategory, note: newNote, date: newDate } : t
      ),
      updatedAt: new Date().toISOString(),
    }
  }

  // If amount changed: reverse old transaction, then create updated one
  const stateAfterReversal = deleteTransaction(state, txId)
  const targetType = updates.type || existingTx.type

  if (targetType === 'income' || targetType === 'salary' || (targetType === 'add' && newCategory !== 'Loan')) {
    return recordIncome(stateAfterReversal, { amount: newAmount, category: newCategory, note: newNote, date: newDate, id: txId })
  } else if (targetType === 'spent' || targetType === 'expense') {
    return recordExpense(stateAfterReversal, { amount: newAmount, category: newCategory, note: newNote, date: newDate, id: txId })
  } else if (targetType === 'savings_deposit' || targetType === 'auto_save') {
    return recordSavingsDeposit(stateAfterReversal, { amount: newAmount, note: newNote, date: newDate, id: txId })
  } else if (targetType === 'savings_withdraw') {
    return recordSavingsWithdrawal(stateAfterReversal, { amount: newAmount, note: newNote, date: newDate, id: txId })
  }

  throw new Error(`Editing of transaction type "${targetType}" is not supported`)
}

/**
 * Add a new recurring income source.
 */
export function addRecurringIncome(state, { name, category = 'Salary', amount, creditDay = 1, autoSaveAmount = 0, enabled = true }) {
  const amt = validateAmount(amount)
  const asAmt = Number(autoSaveAmount) > 0 ? validateAmount(autoSaveAmount, true) : 0
  const day = Math.max(1, Math.min(31, Math.round(Number(creditDay) || 1)))

  const newSource = {
    id: genId(),
    name: String(name || '').trim() || 'Monthly Income',
    category: category || 'Salary',
    amount: amt,
    creditDay: day,
    autoSaveAmount: asAmt,
    enabled: Boolean(enabled),
    createdAt: new Date().toISOString(),
  }

  const existing = Array.isArray(state.settings?.recurringIncomes) ? state.settings.recurringIncomes : []

  return {
    ...state,
    settings: {
      ...state.settings,
      recurringIncomes: [...existing, newSource],
    },
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Update an existing recurring income source.
 */
export function updateRecurringIncome(state, incomeId, updates) {
  const existing = Array.isArray(state.settings?.recurringIncomes) ? state.settings.recurringIncomes : []
  const nextSources = existing.map((src) => {
    if (src.id !== incomeId) return src
    const amt = updates.amount !== undefined ? validateAmount(updates.amount) : src.amount
    const asAmt = updates.autoSaveAmount !== undefined ? validateAmount(updates.autoSaveAmount, true) : src.autoSaveAmount
    const day =
      updates.creditDay !== undefined
        ? Math.max(1, Math.min(31, Math.round(Number(updates.creditDay) || 1)))
        : src.creditDay
    return {
      ...src,
      name: updates.name !== undefined ? String(updates.name).trim() || src.name : src.name,
      category: updates.category !== undefined ? updates.category : src.category,
      amount: amt,
      creditDay: day,
      autoSaveAmount: asAmt,
      enabled: updates.enabled !== undefined ? Boolean(updates.enabled) : src.enabled,
    }
  })

  return {
    ...state,
    settings: {
      ...state.settings,
      recurringIncomes: nextSources,
    },
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Delete a recurring income source.
 */
export function deleteRecurringIncome(state, incomeId) {
  const existing = Array.isArray(state.settings?.recurringIncomes) ? state.settings.recurringIncomes : []
  return {
    ...state,
    settings: {
      ...state.settings,
      recurringIncomes: existing.filter((src) => src.id !== incomeId),
    },
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Process Monthly Automated Incomes and Recurring Credits idempotently.
 *
 * Rules:
 * 1. Checks all configured recurring income sources in state.settings.recurringIncomes.
 * 2. Checks if current date >= configured creditDay (1 to 31).
 * 3. Checks if each source has already been credited for the current month key ('YYYY-MM').
 * 4. Adds net cash (amount - autoSaveAmount) to cash balance.
 * 5. Adds autoSaveAmount to savings balance.
 * 6. Records ledger transactions for the income credit and for the savings deposit.
 * 7. Also processes legacy single salaryAmount if explicitly configured by the user (> 0).
 * 8. Guarantees zero hardcoded dummy credits: if no sources are configured, no operations occur.
 */
export function processRecurringIncomesAutomation(state, { now = new Date(), force = false } = {}) {
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const todayStr = now.toISOString().split('T')[0]
  const currentDay = now.getDate()

  let nextBalance = state.balance
  let nextSavings = state.savings
  const newTransactions = []
  const updatedHistory = { ...(state.recurringIncomeHistory || {}) }
  const creditedSources = []

  const sources = Array.isArray(state.settings?.recurringIncomes) ? state.settings.recurringIncomes : []

  // 1. Process configured recurring income sources
  for (const src of sources) {
    if (!src.enabled) continue

    const amt = Number(src.amount) || 0
    if (amt <= 0) continue

    const scheduledDay = Number(src.creditDay) || 1
    const historyKey = `${src.id}_${currentMonthKey}`

    if (!force) {
      if (updatedHistory[historyKey]) {
        continue // already credited this month
      }
      if (currentDay < scheduledDay) {
        continue // credit day not yet reached
      }
    }

    const autoSaveAmt = src.autoSaveAmount > 0 ? Math.min(amt, Number(src.autoSaveAmount)) : 0
    const netCashIncrease = subMoney(amt, autoSaveAmt)

    const incomeTxId = genId()
    const autoSaveTxId = autoSaveAmt > 0 ? genId() : null

    const incomeTx = {
      id: incomeTxId,
      type: src.category === 'Salary' ? 'salary' : 'income',
      category: src.category || 'Income',
      amount: amt,
      note: `${src.name || 'Monthly Income'} (Auto-Credit)`,
      date: todayStr,
      sourceId: src.id,
      linkedTxId: autoSaveTxId || undefined,
      createdAt: new Date().toISOString(),
    }
    newTransactions.push(incomeTx)

    if (autoSaveAmt > 0) {
      const autoSaveTx = {
        id: autoSaveTxId,
        type: 'savings_deposit',
        category: 'Savings',
        amount: autoSaveAmt,
        note: `Auto-saved from ${src.name || 'Income'}`,
        date: todayStr,
        sourceId: src.id,
        linkedTxId: incomeTxId,
        createdAt: new Date().toISOString(),
      }
      newTransactions.push(autoSaveTx)
    }

    nextBalance = addMoney(nextBalance, netCashIncrease)
    nextSavings = addMoney(nextSavings, autoSaveAmt)
    updatedHistory[historyKey] = true
    creditedSources.push({
      name: src.name || 'Income',
      amount: amt,
      saved: autoSaveAmt,
    })
  }

  // 2. Process legacy single salary if configured and not covered by recurringIncomes
  let legacyProcessed = false
  let legacySkipReason = null
  const legacySalaryAmt = Number(state.settings?.salaryAmount) || 0
  if (legacySalaryAmt > 0 && (!sources.length || force)) {
    const scheduledDay = state.settings?.salaryDay || 1
    const alreadyCredited = state.lastSalaryMonth === currentMonthKey

    if (!force) {
      if (alreadyCredited) {
        legacySkipReason = 'already_credited'
      } else if (currentDay < scheduledDay) {
        legacySkipReason = 'scheduled_date_not_reached'
      }
    }

    if (force || (!alreadyCredited && currentDay >= scheduledDay)) {
      const autoSaveEnabled = Boolean(state.settings?.autoSaveEnabled)
      const configuredAutoSave = Number(state.settings?.autoSaveAmount) || 0
      const autoSaveAmt = autoSaveEnabled ? Math.min(legacySalaryAmt, configuredAutoSave) : 0
      const netCashIncrease = subMoney(legacySalaryAmt, autoSaveAmt)

      const salaryTxId = genId()
      const autoSaveTxId = autoSaveAmt > 0 ? genId() : null

      const salaryTx = {
        id: salaryTxId,
        type: 'salary',
        category: 'Salary',
        amount: legacySalaryAmt,
        note: 'Monthly Salary Credit',
        date: todayStr,
        linkedTxId: autoSaveTxId || undefined,
        createdAt: new Date().toISOString(),
      }
      newTransactions.push(salaryTx)

      if (autoSaveAmt > 0) {
        const autoSaveTx = {
          id: autoSaveTxId,
          type: 'savings_deposit',
          category: 'Savings',
          amount: autoSaveAmt,
          note: 'Auto-saved from salary',
          date: todayStr,
          linkedTxId: salaryTxId,
          createdAt: new Date().toISOString(),
        }
        newTransactions.push(autoSaveTx)
      }

      nextBalance = addMoney(nextBalance, netCashIncrease)
      nextSavings = addMoney(nextSavings, autoSaveAmt)
      legacyProcessed = true
      creditedSources.push({
        name: 'Salary',
        amount: legacySalaryAmt,
        saved: autoSaveAmt,
      })
    }
  }

  if (newTransactions.length === 0) {
    return {
      state,
      processed: false,
      reason: legacySkipReason || 'no_pending_credits',
      creditedSources: [],
    }
  }

  const nextState = {
    ...state,
    balance: nextBalance,
    savings: nextSavings,
    transactions: [...newTransactions, ...state.transactions],
    recurringIncomeHistory: updatedHistory,
    lastSalaryMonth: legacyProcessed ? currentMonthKey : state.lastSalaryMonth,
    updatedAt: new Date().toISOString(),
  }

  return {
    state: nextState,
    processed: true,
    creditedSources,
    creditedAmount: creditedSources.reduce((sum, s) => addMoney(sum, s.amount), 0),
    savedAmount: creditedSources.reduce((sum, s) => addMoney(sum, s.saved), 0),
  }
}

/**
 * Backward compatibility alias for processSalaryAutomation.
 */
export function processSalaryAutomation(state, options = {}) {
  return processRecurringIncomesAutomation(state, options)
}

/**
 * Reconcile two financial states (e.g., local offline state and incoming remote state).
 *
 * Guarantees zero data loss across concurrent devices or multi-tab edits:
 * 1. Unions transactions by transaction ID to prevent dropped offline transactions.
 * 2. Applies the financial delta of remote-only transactions to cash and savings balances.
 * 3. Merges loan repayment records by repayment ID and recomputes exact outstanding debt.
 * 4. Resolves metadata and settings timestamps without reverting user configurations.
 */
export function reconcileStates(localState, remoteState, { lastSyncedAt = null } = {}) {
  if (!remoteState && !localState) return normalizeState({})
  if (!remoteState) return normalizeState(localState)
  if (!localState) return normalizeState(remoteState)

  const local = normalizeState(localState)
  const remote = normalizeState(remoteState)

  // Merge and prune tombstones across local and remote
  const mergedDeletedTxIds = pruneTombstones({
    ...(remote.deletedTxIds || {}),
    ...(local.deletedTxIds || {}),
  })
  const mergedDeletedLoanIds = pruneTombstones({
    ...(remote.deletedLoanIds || {}),
    ...(local.deletedLoanIds || {}),
  })

  // Index deleted repayment IDs and signatures for safe loan repayment deletion reconciliation
  const deletedRepaymentIds = new Set(Object.keys(mergedDeletedTxIds))
  const deletedRepaymentSignatures = new Set()

  for (const tx of [...(local.transactions || []), ...(remote.transactions || [])]) {
    if (mergedDeletedTxIds[tx.id] && (tx.type === 'loan_repayment' || tx.type === 'loan_collection')) {
      if (tx.repaymentId) {
        deletedRepaymentIds.add(tx.repaymentId)
      }
      if (tx.loanId && tx.date && Number(tx.amount)) {
        deletedRepaymentSignatures.add(`${tx.loanId}_${tx.date}_${tx.amount}`)
      }
    }
  }

  let nextBalance = local.balance
  let nextSavings = local.savings
  const localSurvivingTxs = []

  const remoteTxMap = new Map((remote.transactions || []).map((t) => [t.id, t]))
  const lastSyncTime = lastSyncedAt ? new Date(lastSyncedAt).getTime() : null

  // Check if any local transaction was deleted on remote (either explicitly tombstoned or missing after tombstone pruning)
  for (const tx of local.transactions || []) {
    const isExplicitlyTombstoned = Boolean(mergedDeletedTxIds[tx.id])
    const isMissingFromRemote = !remoteTxMap.has(tx.id)
    const txCreatedTime = tx.createdAt ? new Date(tx.createdAt).getTime() : 0
    // If a transaction existed before the last sync with remote, but is now missing from remote,
    // it was deleted on remote while this device was offline (even if the tombstone was pruned)
    const isPrunedRemoteDeletion =
      !isExplicitlyTombstoned &&
      isMissingFromRemote &&
      lastSyncTime !== null &&
      txCreatedTime > 0 &&
      txCreatedTime <= lastSyncTime

    if (isExplicitlyTombstoned || isPrunedRemoteDeletion) {
      if (isPrunedRemoteDeletion) {
        mergedDeletedTxIds[tx.id] = new Date().toISOString()
      }
      // If deleted on remote but not locally known as deleted, reverse its balance impact on local
      if (!local.deletedTxIds?.[tx.id]) {
        const amt = tx.amount || 0
        const txType = tx.type
        if (txType === 'income' || txType === 'salary' || (txType === 'add' && tx.category !== 'Loan')) {
          nextBalance = subMoney(nextBalance, amt)
        } else if (txType === 'spent' || txType === 'expense') {
          nextBalance = addMoney(nextBalance, amt)
        } else if (txType === 'savings_deposit' || txType === 'auto_save') {
          nextBalance = addMoney(nextBalance, amt)
          nextSavings = subMoney(nextSavings, amt)
        } else if (txType === 'savings_withdraw') {
          nextBalance = subMoney(nextBalance, amt)
          nextSavings = addMoney(nextSavings, amt)
        } else if (txType === 'loan_borrow') {
          nextBalance = subMoney(nextBalance, amt)
        } else if (txType === 'loan_lend') {
          nextBalance = addMoney(nextBalance, amt)
        } else if (txType === 'loan_repayment') {
          nextBalance = addMoney(nextBalance, amt)
        } else if (txType === 'loan_collection') {
          nextBalance = subMoney(nextBalance, amt)
        }
      }
    } else {
      localSurvivingTxs.push(tx)
    }
  }

  const localTxMap = new Map(localSurvivingTxs.map((t) => [t.id, t]))
  // Remote-only transactions that are NOT in mergedDeletedTxIds
  const remoteOnlyTxs = (remote.transactions || []).filter(
    (t) => !localTxMap.has(t.id) && !mergedDeletedTxIds[t.id]
  )

  // If remote has new transactions not present in local, calculate their financial delta
  for (const tx of remoteOnlyTxs) {
    const amt = tx.amount || 0
    const txType = tx.type

    if (txType === 'income' || txType === 'salary' || (txType === 'add' && tx.category !== 'Loan')) {
      nextBalance = addMoney(nextBalance, amt)
    } else if (txType === 'spent' || txType === 'expense') {
      nextBalance = subMoney(nextBalance, amt)
    } else if (txType === 'savings_deposit' || txType === 'auto_save') {
      nextBalance = subMoney(nextBalance, amt)
      nextSavings = addMoney(nextSavings, amt)
    } else if (txType === 'savings_withdraw') {
      nextBalance = addMoney(nextBalance, amt)
      nextSavings = subMoney(nextSavings, amt)
    } else if (txType === 'loan_borrow') {
      nextBalance = addMoney(nextBalance, amt)
    } else if (txType === 'loan_lend') {
      nextBalance = subMoney(nextBalance, amt)
    } else if (txType === 'loan_repayment') {
      nextBalance = subMoney(nextBalance, amt)
    } else if (txType === 'loan_collection') {
      nextBalance = addMoney(nextBalance, amt)
    }
  }

  // Union transactions preserving reverse chronological order
  const allTxs = [...localSurvivingTxs, ...remoteOnlyTxs]
  allTxs.sort((a, b) => {
    const dateComp = (b.date || '').localeCompare(a.date || '')
    if (dateComp !== 0) return dateComp
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })

  // Reconcile Loans (skipping deleted loans and filtering deleted repayments)
  const isRepDeleted = (loanId, r) =>
    (r.id && deletedRepaymentIds.has(r.id)) ||
    (r.date && r.amount && deletedRepaymentSignatures.has(`${loanId}_${r.date}_${r.amount}`))

  const remoteLoanMap = new Map((remote.loans || []).map((l) => [l.id, l]))

  const localLoanMap = new Map()
  for (const l of local.loans || []) {
    const isExplicitlyTombstoned = Boolean(mergedDeletedLoanIds[l.id])
    const isMissingFromRemote = !remoteLoanMap.has(l.id)
    const lCreatedTime = l.createdAt ? new Date(l.createdAt).getTime() : 0
    const isPrunedRemoteDeletion =
      !isExplicitlyTombstoned &&
      isMissingFromRemote &&
      lastSyncTime !== null &&
      lCreatedTime > 0 &&
      lCreatedTime <= lastSyncTime

    if (isExplicitlyTombstoned || isPrunedRemoteDeletion) {
      if (isPrunedRemoteDeletion) {
        mergedDeletedLoanIds[l.id] = new Date().toISOString()
      }
      continue
    }

    const survivingReps = (l.repayments || []).filter((r) => !isRepDeleted(l.id, r))
    const totalRepaid = survivingReps.reduce((sum, r) => addMoney(sum, r.amount), 0)
    const newOutstanding = Math.max(0, subMoney(l.amount, totalRepaid))
    localLoanMap.set(l.id, {
      ...l,
      repayments: survivingReps,
      outstanding: newOutstanding,
      status:
        toPaise(newOutstanding) === 0
          ? 'repaid'
          : toPaise(newOutstanding) === toPaise(l.amount)
          ? 'active'
          : 'partially_paid',
    })
  }

  for (const rLoan of remote.loans || []) {
    if (mergedDeletedLoanIds[rLoan.id]) continue

    if (!localLoanMap.has(rLoan.id)) {
      const survivingReps = (rLoan.repayments || []).filter((r) => !isRepDeleted(rLoan.id, r))
      const totalRepaid = survivingReps.reduce((sum, r) => addMoney(sum, r.amount), 0)
      const newOutstanding = Math.max(0, subMoney(rLoan.amount, totalRepaid))
      localLoanMap.set(rLoan.id, {
        ...rLoan,
        repayments: survivingReps,
        outstanding: newOutstanding,
        status:
          toPaise(newOutstanding) === 0
            ? 'repaid'
            : toPaise(newOutstanding) === toPaise(rLoan.amount)
            ? 'active'
            : 'partially_paid',
      })
    } else {
      const existing = localLoanMap.get(rLoan.id)
      const existingRepMap = new Map()
      for (const r of existing.repayments || []) {
        if (!isRepDeleted(existing.id, r)) {
          existingRepMap.set(r.id || `${r.date}_${r.amount}`, r)
        }
      }
      for (const rep of rLoan.repayments || []) {
        if (!isRepDeleted(existing.id, rep)) {
          const key = rep.id || `${rep.date}_${rep.amount}`
          if (!existingRepMap.has(key)) {
            existingRepMap.set(key, rep)
          }
        }
      }
      const mergedRepayments = Array.from(existingRepMap.values())
      const totalRepaid = mergedRepayments.reduce((sum, r) => addMoney(sum, r.amount), 0)
      const newOutstanding = Math.max(0, subMoney(existing.amount, totalRepaid))

      existing.repayments = mergedRepayments
      existing.outstanding = newOutstanding
      existing.status =
        toPaise(newOutstanding) === 0
          ? 'repaid'
          : toPaise(newOutstanding) === toPaise(existing.amount)
          ? 'active'
          : 'partially_paid'
      localLoanMap.set(rLoan.id, existing)
    }
  }

  // Resolve settings and salary month
  const remoteTime = new Date(remote.updatedAt || 0).getTime()
  const localTime = new Date(local.updatedAt || 0).getTime()
  const latestSettings =
    remoteTime > localTime
      ? { ...local.settings, ...remote.settings }
      : { ...remote.settings, ...local.settings }

  // Merge recurring income sources by id
  const localIncomeMap = new Map((local.settings?.recurringIncomes || []).map((i) => [i.id, i]))
  for (const rInc of remote.settings?.recurringIncomes || []) {
    if (!localIncomeMap.has(rInc.id)) {
      localIncomeMap.set(rInc.id, rInc)
    }
  }
  latestSettings.recurringIncomes = Array.from(localIncomeMap.values())

  const lastSalaryMonth =
    (local.lastSalaryMonth || '') > (remote.lastSalaryMonth || '')
      ? local.lastSalaryMonth
      : remote.lastSalaryMonth || local.lastSalaryMonth || ''

  const recurringIncomeHistory = {
    ...(remote.recurringIncomeHistory || {}),
    ...(local.recurringIncomeHistory || {}),
  }

  return {
    balance: nextBalance,
    savings: Math.max(0, nextSavings),
    savingsGoal: remoteTime > localTime ? remote.savingsGoal : local.savingsGoal,
    loans: Array.from(localLoanMap.values()),
    transactions: allTxs,
    lastSalaryMonth,
    recurringIncomeHistory,
    deletedTxIds: mergedDeletedTxIds,
    deletedLoanIds: mergedDeletedLoanIds,
    settings: latestSettings,
    updatedAt: new Date().toISOString(),
  }
}
