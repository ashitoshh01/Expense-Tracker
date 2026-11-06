/**
 * Domain Analytics Engine for Wallet FIX.
 *
 * Implements pure, mathematically rigorous analytics calculations:
 * 1. Financial Overview KPIs (Income, Expenses, Net Cashflow, Savings Rate).
 * 2. Category Spending Breakdown with colors and percentage distributions.
 * 3. Multi-month cashflow time-series trend aggregation.
 * 4. Income Composition & source analysis (recurring vs variable).
 * 5. Deterministic, factual financial insights without phantom data or budget assumptions.
 *
 * All aggregations preserve minor-unit paise precision using money.js.
 */

import { addMoney, subMoney, toPaise, toRupees } from './money.js'
import { getCategoryMeta } from './categories.js'
import { filterTransactionsByDateRange } from './dateRange.js'

/**
 * Calculate comprehensive financial overview metrics for a given date range.
 *
 * Strictly separates:
 * - External earned income from borrowed debt and savings withdrawals.
 * - Actual consumption expenses from loan disbursements and savings deposits.
 *
 * @param {Array<Object>} transactions
 * @param {{ startDate?: string|null, endDate?: string|null, deletedTxIds?: Object }} [dateRange]
 * @returns {{
 *   totalIncome: number,
 *   totalExpenses: number,
 *   netCashflow: number,
 *   savingsDeposited: number,
 *   savingsWithdrawn: number,
 *   netSavings: number,
 *   savingsRate: number,
 *   debtRepaid: number,
 *   debtCollected: number,
 *   debtBorrowed: number,
 *   debtLent: number,
 *   transactionCount: number
 * }}
 */
export function calculateAnalyticsOverview(transactions = [], dateRange = {}) {
  const filteredTxs = filterTransactionsByDateRange(transactions, dateRange)

  let totalIncome = 0
  let totalExpenses = 0
  let savingsDeposited = 0
  let savingsWithdrawn = 0
  let debtRepaid = 0
  let debtCollected = 0
  let debtBorrowed = 0
  let debtLent = 0

  for (const t of filteredTxs) {
    const amt = Number(t.amount) || 0
    if (amt <= 0) continue

    switch (t.type) {
      case 'income':
      case 'salary':
        totalIncome = addMoney(totalIncome, amt)
        break
      case 'add':
        // Legacy: if category !== 'Loan', it is external earned income
        if (t.category !== 'Loan') {
          totalIncome = addMoney(totalIncome, amt)
        } else {
          debtBorrowed = addMoney(debtBorrowed, amt)
        }
        break
      case 'spent':
      case 'expense':
        totalExpenses = addMoney(totalExpenses, amt)
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
      case 'loan_borrow':
        debtBorrowed = addMoney(debtBorrowed, amt)
        break
      case 'loan_lend':
        debtLent = addMoney(debtLent, amt)
        break
      default:
        break
    }
  }

  const netCashflow = subMoney(totalIncome, totalExpenses)
  const netSavings = subMoney(savingsDeposited, savingsWithdrawn)

  // Savings rate: % of external earned income dedicated to savings deposits
  const savingsRate = totalIncome > 0
    ? Math.max(0, Math.min(100, Math.round((savingsDeposited / totalIncome) * 100)))
    : 0

  return {
    totalIncome,
    totalExpenses,
    netCashflow,
    savingsDeposited,
    savingsWithdrawn,
    netSavings,
    savingsRate,
    debtRepaid,
    debtCollected,
    debtBorrowed,
    debtLent,
    transactionCount: filteredTxs.length,
  }
}

/**
 * Calculate category-wise spending aggregation.
 * Excludes non-consumption transactions and handles zero total expenses safely.
 *
 * @param {Array<Object>} transactions
 * @param {{ startDate?: string|null, endDate?: string|null, deletedTxIds?: Object }} [dateRange]
 * @returns {Array<{
 *   category: string,
 *   amount: number,
 *   percentage: number,
 *   count: number,
 *   color: string,
 *   icon: any
 * }>}
 */
export function calculateCategoryBreakdown(transactions = [], dateRange = {}) {
  const filteredTxs = filterTransactionsByDateRange(transactions, dateRange)

  const categoryMap = {}
  let totalExpenses = 0

  for (const t of filteredTxs) {
    if (t.type !== 'spent' && t.type !== 'expense') continue
    const amt = Number(t.amount) || 0
    if (amt <= 0) continue

    const category = (t.category || 'Other').trim() || 'Other'
    if (!categoryMap[category]) {
      categoryMap[category] = { amount: 0, count: 0 }
    }
    categoryMap[category].amount = addMoney(categoryMap[category].amount, amt)
    categoryMap[category].count += 1
    totalExpenses = addMoney(totalExpenses, amt)
  }

  if (totalExpenses <= 0) {
    return []
  }

  return Object.entries(categoryMap)
    .map(([category, data]) => {
      const meta = getCategoryMeta(category)
      const percentage = Math.round((data.amount / totalExpenses) * 100)
      return {
        category,
        amount: data.amount,
        percentage,
        count: data.count,
        color: meta.color || '#94A3B8',
        icon: meta.icon,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Generate monthly time-series buckets for trend charts.
 *
 * @param {Array<Object>} transactions
 * @param {number} [monthCount=6] Number of calendar months to generate (default 6)
 * @param {Date} [referenceDate=new Date()]
 * @returns {Array<{
 *   yearMonth: string,
 *   label: string,
 *   income: number,
 *   expenses: number,
 *   netCashflow: number,
 *   savings: number,
 *   transactionCount: number
 * }>}
 */
export function calculateMonthlyTrends(transactions = [], monthCount = 6, referenceDate = new Date()) {
  const count = Math.max(1, Math.min(24, Math.round(Number(monthCount) || 6)))
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date()

  const currentYear = ref.getFullYear()
  const currentMonth = ref.getMonth() // 0-indexed

  // Generate ordered monthly buckets chronologically (oldest to newest)
  const buckets = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${y}-${m}`
    const label = d.toLocaleDateString('en-IN', { month: 'short' })
    const fullLabel = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

    buckets.push({
      yearMonth,
      label,
      fullLabel,
      income: 0,
      expenses: 0,
      netCashflow: 0,
      savings: 0,
      transactionCount: 0,
    })
  }

  const bucketMap = new Map(buckets.map((b) => [b.yearMonth, b]))

  if (Array.isArray(transactions) && transactions.length > 0) {
    for (const t of transactions) {
      if (!t || typeof t !== 'object' || t.isReversed) continue
      const rawDate = t.date || (t.createdAt ? t.createdAt.slice(0, 10) : '')
      if (!rawDate || rawDate.length < 7) continue
      const yearMonth = rawDate.slice(0, 7)

      const bucket = bucketMap.get(yearMonth)
      if (!bucket) continue

      const amt = Number(t.amount) || 0
      if (amt <= 0) continue

      bucket.transactionCount += 1

      switch (t.type) {
        case 'income':
        case 'salary':
          bucket.income = addMoney(bucket.income, amt)
          break
        case 'add':
          if (t.category !== 'Loan') {
            bucket.income = addMoney(bucket.income, amt)
          }
          break
        case 'spent':
        case 'expense':
          bucket.expenses = addMoney(bucket.expenses, amt)
          break
        case 'savings_deposit':
        case 'auto_save':
          bucket.savings = addMoney(bucket.savings, amt)
          break
        default:
          break
      }
    }
  }

  // Finalize net cashflow for each bucket
  for (const bucket of buckets) {
    bucket.netCashflow = subMoney(bucket.income, bucket.expenses)
  }

  return buckets
}

/**
 * Calculate income composition grouped by category and source.
 * Classifies recurring vs variable income based on sourceId, linkedTxId, or salary type.
 *
 * @param {Array<Object>} transactions
 * @param {{ startDate?: string|null, endDate?: string|null, deletedTxIds?: Object }} [dateRange]
 * @param {Object} [state]
 * @returns {{
 *   totalIncome: number,
 *   recurringTotal: number,
 *   nonRecurringTotal: number,
 *   recurringPercent: number,
 *   sources: Array<{
 *     category: string,
 *     amount: number,
 *     percentage: number,
 *     count: number,
 *     isRecurring: boolean,
 *     color: string,
 *     icon: any
 *   }>
 * }}
 */
export function calculateIncomeBreakdown(transactions = [], dateRange = {}, state = {}) {
  const filteredTxs = filterTransactionsByDateRange(transactions, dateRange)

  const configuredSourceIds = new Set(
    (state?.settings?.recurringIncomes || []).map((s) => s.id)
  )

  const groupMap = {}
  let totalIncome = 0
  let recurringTotal = 0
  let nonRecurringTotal = 0

  for (const t of filteredTxs) {
    const amt = Number(t.amount) || 0
    if (amt <= 0) continue

    const isExternalIncome =
      t.type === 'income' ||
      t.type === 'salary' ||
      (t.type === 'add' && t.category !== 'Loan')

    if (!isExternalIncome) continue

    const category = (t.category || (t.type === 'salary' ? 'Salary' : 'Income')).trim() || 'Income'

    const isRecurring = Boolean(
      (t.sourceId && configuredSourceIds.has(t.sourceId)) ||
      t.type === 'salary' ||
      t.linkedTxId ||
      (typeof t.note === 'string' && t.note.includes('Auto-Credit'))
    )

    if (!groupMap[category]) {
      groupMap[category] = {
        amount: 0,
        count: 0,
        recurringAmount: 0,
        nonRecurringAmount: 0,
      }
    }

    groupMap[category].amount = addMoney(groupMap[category].amount, amt)
    groupMap[category].count += 1
    totalIncome = addMoney(totalIncome, amt)

    if (isRecurring) {
      groupMap[category].recurringAmount = addMoney(groupMap[category].recurringAmount, amt)
      recurringTotal = addMoney(recurringTotal, amt)
    } else {
      groupMap[category].nonRecurringAmount = addMoney(groupMap[category].nonRecurringAmount, amt)
      nonRecurringTotal = addMoney(nonRecurringTotal, amt)
    }
  }

  const sources = Object.entries(groupMap)
    .map(([category, data]) => {
      const meta = getCategoryMeta(category)
      const percentage = totalIncome > 0 ? Math.round((data.amount / totalIncome) * 100) : 0
      return {
        category,
        amount: data.amount,
        percentage,
        count: data.count,
        isRecurring: data.recurringAmount > data.nonRecurringAmount,
        recurringAmount: data.recurringAmount,
        nonRecurringAmount: data.nonRecurringAmount,
        color: meta.color || '#10B981',
        icon: meta.icon,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  const recurringPercent = totalIncome > 0
    ? Math.round((recurringTotal / totalIncome) * 100)
    : 0

  return {
    totalIncome,
    recurringTotal,
    nonRecurringTotal,
    recurringPercent,
    sources,
  }
}

/**
 * Calculate honest period-over-period percentage delta.
 * Avoids misleading +200% when transitioning from deficit to surplus.
 *
 * @param {number} current
 * @param {number} prev
 * @returns {{ label: string, isPositive: boolean, hasBaseline: boolean }}
 */
export function calculateSafeDelta(current, prev) {
  if (prev === 0 || !Number.isFinite(prev)) {
    if (current > 0) return { label: 'First record', isPositive: true, hasBaseline: false }
    if (current < 0) return { label: 'First deficit', isPositive: false, hasBaseline: false }
    return { label: '0%', isPositive: true, hasBaseline: false }
  }

  if (prev < 0 && current >= 0) {
    return { label: 'Turned Surplus', isPositive: true, hasBaseline: true }
  }

  if (prev >= 0 && current < 0) {
    return { label: 'Turned Deficit', isPositive: false, hasBaseline: true }
  }

  const diff = current - prev
  const pct = Math.round((diff / Math.abs(prev)) * 100)

  if (pct > 0) {
    return { label: `+${pct}%`, isPositive: true, hasBaseline: true }
  } else if (pct < 0) {
    return { label: `${pct}%`, isPositive: false, hasBaseline: true }
  }

  return { label: '0%', isPositive: true, hasBaseline: true }
}

/**
 * Generate deterministic, factual financial insights grounded exclusively in active ledger data.
 * Zero AI hallucinations, zero budget assumptions.
 *
 * @param {Object} overview
 * @param {Array<Object>} categories
 * @param {Object} state
 * @param {Object|null} [prevOverview=null]
 * @returns {Array<{
 *   id: string,
 *   type: 'info'|'positive'|'warning',
 *   title: string,
 *   description: string,
 *   metric?: string
 * }>}
 */
export function generateFinancialInsights(overview = {}, categories = [], state = {}, prevOverview = null) {
  const insights = []

  // 1. Top Spending Category Insight
  if (categories && categories.length > 0) {
    const top = categories[0]
    if (top.percentage >= 40) {
      insights.push({
        id: 'top-spending-concentration',
        type: 'warning',
        title: `High Spending in ${top.category}`,
        description: `${top.category} accounts for ${top.percentage}% of your total expenses in this period.`,
        metric: `${top.percentage}%`,
      })
    } else {
      insights.push({
        id: 'top-spending-category',
        type: 'info',
        title: `Primary Expense: ${top.category}`,
        description: `Your highest expense was ${top.category}, representing ${top.percentage}% of total expenses.`,
        metric: `${top.percentage}%`,
      })
    }
  }

  // 2. Net Cashflow Insight
  if (overview.netCashflow > 0 && overview.totalIncome > 0) {
    const retainedRate = Math.round((overview.netCashflow / overview.totalIncome) * 100)
    insights.push({
      id: 'cashflow-surplus',
      type: 'positive',
      title: 'Healthy Cashflow Surplus',
      description: `You maintained positive cashflow, retaining ${retainedRate}% of your earned income.`,
      metric: `+${retainedRate}%`,
    })
  } else if (overview.netCashflow < 0) {
    insights.push({
      id: 'cashflow-deficit',
      type: 'warning',
      title: 'Net Cashflow Deficit',
      description: 'Your consumption expenses exceeded your earned income during this period.',
      metric: 'Deficit',
    })
  }

  // 3. Savings Goal Milestone Progress
  const savingsGoal = Number(state?.savingsGoal) || 0
  const currentSavings = Number(state?.savings) || 0
  if (savingsGoal > 0) {
    const goalPercent = Math.min(100, Math.round((currentSavings / savingsGoal) * 100))
    if (goalPercent >= 100) {
      insights.push({
        id: 'savings-goal-achieved',
        type: 'positive',
        title: 'Savings Goal Achieved! 🎉',
        description: 'You have reached 100% of your current target savings milestone.',
        metric: '100%',
      })
    } else {
      insights.push({
        id: 'savings-goal-progress',
        type: 'info',
        title: 'Milestone Progress',
        description: `Your reserve vault has achieved ${goalPercent}% of your ₹${savingsGoal.toLocaleString('en-IN')} target.`,
        metric: `${goalPercent}%`,
      })
    }
  } else if (overview.savingsRate > 0) {
    insights.push({
      id: 'savings-rate-insight',
      type: 'positive',
      title: 'Active Savings Habit',
      description: `You set aside ${overview.savingsRate}% of your income into your savings vault.`,
      metric: `${overview.savingsRate}%`,
    })
  }

  // 4. Period Comparison Insight
  if (prevOverview && prevOverview.totalExpenses > 0 && overview.totalExpenses > 0) {
    const expDiff = overview.totalExpenses - prevOverview.totalExpenses
    const expPct = Math.round((expDiff / prevOverview.totalExpenses) * 100)
    if (expPct < 0) {
      insights.push({
        id: 'expense-reduction',
        type: 'positive',
        title: 'Spending Reduced',
        description: `Expenses dropped by ${Math.abs(expPct)}% compared to the previous period.`,
        metric: `${expPct}%`,
      })
    } else if (expPct > 10) {
      insights.push({
        id: 'expense-increase',
        type: 'warning',
        title: 'Spending Increased',
        description: `Expenses rose by ${expPct}% compared to the previous period.`,
        metric: `+${expPct}%`,
      })
    }
  }

  return insights
}

