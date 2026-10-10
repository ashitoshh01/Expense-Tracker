/**
 * Centralized Financial Accounting Engine for Wallet FIX.
 *
 * Implements strict double-entry-style invariants, zero-loss transaction reversals,
 * paise integer arithmetic, and robust validation for all financial mutations.
 */

import { toPaise, toRupees, validateAmount, addMoney, subMoney, genId } from './money.js'

export const SCHEMA_VERSION = 2

export const DEFAULT_SETTINGS = {
  salaryAmount: 2000,
  salaryDay: 5,
  autoSaveAmount: 500,
  autoSaveEnabled: true,
  currency: 'INR',
}

/**
 * Normalizes and validates raw or legacy state into a consistent financial state.
 * Fully backward-compatible with legacy storage formats.
 * @param {Object} raw
 * @returns {Object} Cleaned, consistent financial state
 */
export function normalizeState(raw = {}) {
  const balance = typeof raw.balance === 'number' && Number.isFinite(raw.balance) ? raw.balance : 0
  const savings = typeof raw.savings === 'number' && Number.isFinite(raw.savings) ? raw.savings : 0
  const savingsGoal = typeof raw.savingsGoal === 'number' && raw.savingsGoal > 0 ? raw.savingsGoal : 1000
  const lastSalaryMonth = typeof raw.lastSalaryMonth === 'string' ? raw.lastSalaryMonth : ''

  // Normalize loans
  const rawLoans = Array.isArray(raw.loans) ? raw.loans : []
  const loans = rawLoans.map((l) => {
    const originalAmount = typeof l.amount === 'number' && Number.isFinite(l.amount) ? l.amount : 0
    const repayments = Array.isArray(l.repayments) ? l.repayments : []
    const totalRepaid = repayments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
    const outstanding = typeof l.outstanding === 'number' && Number.isFinite(l.outstanding)
      ? l.outstanding
      : Math.max(0, subMoney(originalAmount, totalRepaid))
    const status = l.status || (outstanding <= 0 ? 'repaid' : totalRepaid > 0 ? 'partially_paid' : 'active')
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
  const transactions = rawTxs.map((t) => ({
    id: t.id || genId(),
    type: t.type || 'spent',
    category: t.category || (t.type === 'spent' ? 'Other' : 'General'),
    amount: typeof t.amount === 'number' && Number.isFinite(t.amount) ? t.amount : 0,
    note: t.note || '',
    date: t.date || new Date().toISOString().split('T')[0],
    loanId: t.loanId || undefined,
    reversalOf: t.reversalOf || undefined,
    isReversed: Boolean(t.isReversed),
    createdAt: t.createdAt || new Date().toISOString(),
  }))

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(raw.settings || {}),
  }

  return {
    balance: Math.max(0, balance),
    savings: Math.max(0, savings),
    loans,
    transactions,
    savingsGoal,
    lastSalaryMonth,
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

  if (txType === 'income' || txType === 'salary' || (txType === 'add' && tx.category !== 'Loan')) {
    // Reversing income reduces balance
    if (toPaise(nextBalance) < toPaise(amt)) {
      throw new Error(`Cannot delete income: current balance (₹${nextBalance.toFixed(2)}) is less than transaction amount ₹${amt.toFixed(2)}`)
    }
    nextBalance = subMoney(nextBalance, amt)
  } else if (txType === 'spent' || txType === 'expense') {
    // Reversing expense refunds balance
    nextBalance = addMoney(nextBalance, amt)
  } else if (txType === 'savings_deposit' || txType === 'auto_save') {
    // Reversing savings deposit: refund cash, reduce savings
    if (toPaise(nextSavings) < toPaise(amt)) {
      throw new Error(`Cannot delete savings deposit: savings balance (₹${nextSavings.toFixed(2)}) is less than deposit amount ₹${amt.toFixed(2)}`)
    }
    nextSavings = subMoney(nextSavings, amt)
    nextBalance = addMoney(nextBalance, amt)
  } else if (txType === 'savings_withdraw') {
    // Reversing savings withdrawal: refund savings, reduce cash
    if (toPaise(nextBalance) < toPaise(amt)) {
      throw new Error(`Cannot delete savings withdrawal: cash balance (₹${nextBalance.toFixed(2)}) is less than withdrawal amount ₹${amt.toFixed(2)}`)
    }
    nextBalance = subMoney(nextBalance, amt)
    nextSavings = addMoney(nextSavings, amt)
  } else if (txType === 'loan_repayment') {
    // Reversing a loan repayment: refund cash, increase loan outstanding
    const loan = nextLoans.find((l) => l.id === tx.loanId)
    if (loan) {
      const newOutstanding = addMoney(loan.outstanding, amt)
      const updatedLoan = {
        ...loan,
        outstanding: newOutstanding,
        status: toPaise(newOutstanding) === toPaise(loan.amount) ? 'active' : 'partially_paid',
        repayments: loan.repayments.filter((r) => r.amount !== amt || r.date !== tx.date),
      }
      nextLoans = nextLoans.map((l) => (l.id === loan.id ? updatedLoan : l))
    }
    nextBalance = addMoney(nextBalance, amt)
  } else if (txType === 'loan_borrow' || (txType === 'add' && tx.category === 'Loan')) {
    // Reversing loan borrow: requires deducting borrowed cash from balance
    if (toPaise(nextBalance) < toPaise(amt)) {
      throw new Error(`Cannot delete borrowed loan: current balance (₹${nextBalance.toFixed(2)}) is less than loan amount ₹${amt.toFixed(2)}`)
    }
    // Check if repayments were made
    const loan = nextLoans.find((l) => l.id === tx.loanId || (l.amount === amt && l.name === tx.note))
    if (loan && loan.repayments && loan.repayments.length > 0) {
      throw new Error(`Cannot delete loan that has existing repayments. Please reverse repayments first.`)
    }
    nextBalance = subMoney(nextBalance, amt)
    if (loan) {
      nextLoans = nextLoans.filter((l) => l.id !== loan.id)
    }
  } else if (txType === 'loan_lend') {
    const loan = nextLoans.find((l) => l.id === tx.loanId)
    if (loan && loan.repayments && loan.repayments.length > 0) {
      throw new Error(`Cannot delete lent loan that has repayments.`)
    }
    nextBalance = addMoney(nextBalance, amt)
    if (loan) {
      nextLoans = nextLoans.filter((l) => l.id !== loan.id)
    }
  }

  return {
    ...state,
    balance: nextBalance,
    savings: nextSavings,
    loans: nextLoans,
    transactions: state.transactions.filter((t) => t.id !== txId),
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

  // If amount or type changed, perform atomic rollback and re-apply
  const newAmount = updates.amount !== undefined ? validateAmount(updates.amount) : existingTx.amount
  const newCategory = updates.category !== undefined ? updates.category : existingTx.category
  const newNote = updates.note !== undefined ? updates.note : existingTx.note
  const newDate = updates.date !== undefined ? updates.date : existingTx.date

  if (newAmount === existingTx.amount && (!updates.type || updates.type === existingTx.type)) {
    // Only metadata changed (note, category, date)
    return {
      ...state,
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
 * Process Monthly Salary Automation idempotently.
 *
 * Rules:
 * 1. Checks if current date has reached configured salaryDay.
 * 2. Ensures salary is credited at most once per user per configured month (lastSalaryMonth check).
 * 3. Idempotent across app refreshes, multiple tabs, and delayed sync.
 * 4. Supports user-configured salary amount and auto-save amount.
 */
export function processSalaryAutomation(state, { now = new Date(), force = false } = {}) {
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  if (!force) {
    if (state.lastSalaryMonth === currentMonthKey) {
      return { state, processed: false, reason: 'already_credited' }
    }
    const day = now.getDate()
    const scheduledDay = state.settings?.salaryDay || DEFAULT_SETTINGS.salaryDay
    if (day < scheduledDay) {
      return { state, processed: false, reason: 'scheduled_date_not_reached' }
    }
  }

  const salaryAmt = validateAmount(state.settings?.salaryAmount || DEFAULT_SETTINGS.salaryAmount)
  const autoSaveEnabled = Boolean(state.settings?.autoSaveEnabled)
  const configuredAutoSave = validateAmount(state.settings?.autoSaveAmount || DEFAULT_SETTINGS.autoSaveAmount, true)
  const autoSaveAmt = autoSaveEnabled ? Math.min(salaryAmt, configuredAutoSave) : 0

  const netCashIncrease = subMoney(salaryAmt, autoSaveAmt)
  const todayStr = now.toISOString().split('T')[0]

  const salaryTx = {
    id: genId(),
    type: 'salary',
    category: 'Salary',
    amount: salaryAmt,
    note: 'Monthly Salary Credit',
    date: todayStr,
    createdAt: new Date().toISOString(),
  }

  const newTransactions = [salaryTx]

  if (autoSaveAmt > 0) {
    const autoSaveTx = {
      id: genId(),
      type: 'savings_deposit',
      category: 'Savings',
      amount: autoSaveAmt,
      note: 'Auto-saved from salary',
      date: todayStr,
      createdAt: new Date().toISOString(),
    }
    newTransactions.unshift(autoSaveTx)
  }

  const nextState = {
    ...state,
    balance: addMoney(state.balance, netCashIncrease),
    savings: addMoney(state.savings, autoSaveAmt),
    transactions: [...newTransactions, ...state.transactions],
    lastSalaryMonth: currentMonthKey,
    updatedAt: new Date().toISOString(),
  }

  return {
    state: nextState,
    processed: true,
    creditedAmount: salaryAmt,
    savedAmount: autoSaveAmt,
  }
}
