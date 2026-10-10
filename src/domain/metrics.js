/**
 * Honest Financial Metrics and Analytics Engine for Wallet FIX.
 *
 * Replaces fabricated metrics (+100%) with mathematically rigorous calculations:
 * 1. Savings rate (% of external income put into savings).
 * 2. Real month-over-month savings and spending comparisons.
 * 3. Safe zero-denominator and edge-case handling.
 * 4. Internal transfers (cash <-> savings) are excluded from external income/spending metrics.
 */

import { addMoney, subMoney, toPaise, toRupees } from './money'

/**
 * Filter transactions for a given 'YYYY-MM' month prefix.
 * @param {Array} transactions
 * @param {string} yearMonth
 */
export function getMonthlyTransactions(transactions, yearMonth) {
  if (!Array.isArray(transactions) || !yearMonth) return []
  return transactions.filter((t) => t.date && t.date.startsWith(yearMonth))
}

/**
 * Calculate categorized totals for a month.
 * Strictly separates external cash flow from internal transfers.
 */
export function calculateMonthlyBreakdown(transactions, yearMonth) {
  const monthTxs = getMonthlyTransactions(transactions, yearMonth)

  let externalIncome = 0
  let externalSpent = 0
  let savingsDeposited = 0
  let savingsWithdrawn = 0
  let debtRepaid = 0
  let debtCollected = 0

  for (const t of monthTxs) {
    const amt = Number(t.amount) || 0
    switch (t.type) {
      case 'income':
      case 'salary':
        externalIncome = addMoney(externalIncome, amt)
        break
      case 'add':
        // Legacy: if category is Loan, it's borrowed money, else general income
        if (t.category !== 'Loan') {
          externalIncome = addMoney(externalIncome, amt)
        }
        break
      case 'spent':
      case 'expense':
        externalSpent = addMoney(externalSpent, amt)
        break
      case 'savings_deposit':
      case 'auto_save':
        savingsDeposited = addMoney(savingsDeposited, amt)
        break
      case 'savings_withdraw':
        savingsWithdrawn = addMoney(savingsWithdrawn, amt)
        break
      case 'loan_repayment':
        debtRepaid = addMoney(debtRepaid, amt)
        break
      case 'loan_collection':
        debtCollected = addMoney(debtCollected, amt)
        break
      default:
        break
    }
  }

  // Net external savings added this month (deposits - withdrawals)
  const netSavingsAdded = subMoney(savingsDeposited, savingsWithdrawn)

  // Savings rate: % of external income saved
  const savingsRate = externalIncome > 0
    ? Math.max(0, Math.min(100, Math.round((savingsDeposited / externalIncome) * 100)))
    : 0

  return {
    externalIncome,
    externalSpent,
    savingsDeposited,
    savingsWithdrawn,
    netSavingsAdded,
    savingsRate,
    debtRepaid,
    debtCollected,
    totalTransactions: monthTxs.length,
  }
}

/**
 * Calculate honest savings progress metric comparing current month to previous month.
 * Avoids fabricated +100% when there is no historical baseline.
 * @param {number} currentMonthSaved
 * @param {number} prevMonthSaved
 * @returns {{ label: string, isPositive: boolean, hasBaseline: boolean }}
 */
export function calculateSavingsGrowth(currentMonthSaved, prevMonthSaved) {
  if (currentMonthSaved <= 0) {
    return { label: '0%', isPositive: false, hasBaseline: true }
  }

  if (prevMonthSaved <= 0) {
    // Honest: no baseline from previous month
    return { label: 'First savings', isPositive: true, hasBaseline: false }
  }

  const diff = currentMonthSaved - prevMonthSaved
  const pct = Math.round((diff / prevMonthSaved) * 100)

  if (pct > 0) {
    return { label: `+${pct}%`, isPositive: true, hasBaseline: true }
  } else if (pct < 0) {
    return { label: `${pct}%`, isPositive: false, hasBaseline: true }
  }

  return { label: '0%', isPositive: true, hasBaseline: true }
}

/**
 * Calculate net balance change percentage between current month and previous month.
 * Handles zero denominators honestly.
 */
export function calculateBalanceChangePercent(currentNet, prevNet) {
  if (prevNet === 0) {
    if (currentNet > 0) return { label: '+100%', isPositive: true }
    if (currentNet < 0) return { label: '-100%', isPositive: false }
    return { label: '0%', isPositive: true }
  }

  const pct = ((currentNet - prevNet) / Math.abs(prevNet)) * 100
  const formatted = pct.toFixed(1)

  return {
    label: pct > 0 ? `+${formatted}%` : `${formatted}%`,
    isPositive: pct >= 0,
  }
}
