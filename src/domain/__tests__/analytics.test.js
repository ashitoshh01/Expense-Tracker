import { describe, it, expect } from 'vitest'
import {
  calculateAnalyticsOverview,
  calculateCategoryBreakdown,
  calculateMonthlyTrends,
  calculateIncomeBreakdown,
  calculateSafeDelta,
  generateFinancialInsights,
} from '../analytics'

describe('Domain: Analytics Engine (analytics.js)', () => {
  const sampleTransactions = [
    // Income
    { id: 'tx-1', type: 'salary', amount: 50000, category: 'Salary', date: '2026-11-01', sourceId: 'src-1' },
    { id: 'tx-2', type: 'income', amount: 15000, category: 'Freelance', date: '2026-11-05' },
    // Linked auto-save
    { id: 'tx-3', type: 'auto_save', amount: 10000, category: 'Savings', date: '2026-11-01', linkedTxId: 'tx-1' },
    // Expenses
    { id: 'tx-4', type: 'spent', amount: 4500, category: 'Outside Food', date: '2026-11-02' },
    { id: 'tx-5', type: 'expense', amount: 3200, category: 'Groceries', date: '2026-11-03' },
    { id: 'tx-6', type: 'spent', amount: 2000, category: 'Outside Food', date: '2026-11-10' },
    // Savings deposit and withdrawal
    { id: 'tx-7', type: 'savings_deposit', amount: 5000, category: 'Savings', date: '2026-11-12' },
    { id: 'tx-8', type: 'savings_withdraw', amount: 2000, category: 'Savings', date: '2026-11-15' },
    // Loans
    { id: 'tx-9', type: 'loan_borrow', amount: 8000, category: 'Loan', date: '2026-11-04' },
    { id: 'tx-10', type: 'loan_repayment', amount: 3000, category: 'Loan', date: '2026-11-18' },
    { id: 'tx-11', type: 'loan_lend', amount: 4000, category: 'Loan', date: '2026-11-07' },
    { id: 'tx-12', type: 'loan_collection', amount: 1500, category: 'Loan', date: '2026-11-20' },
    // Reversed transaction (must be ignored)
    { id: 'tx-13', type: 'spent', amount: 9999, category: 'Shopping', date: '2026-11-11', isReversed: true },
  ]

  describe('calculateAnalyticsOverview', () => {
    it('accurately aggregates income, expenses, cashflow, and savings rate', () => {
      const overview = calculateAnalyticsOverview(sampleTransactions, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      })

      // Income: 50000 (salary) + 15000 (freelance) = 65000
      expect(overview.totalIncome).toBe(65000)

      // Expenses: 4500 (Food) + 3200 (Groceries) + 2000 (Food) = 9700
      expect(overview.totalExpenses).toBe(9700)

      // Net cashflow: 65000 - 9700 = 55300
      expect(overview.netCashflow).toBe(55300)

      // Savings: deposited = 10000 (auto_save) + 5000 (deposit) = 15000
      expect(overview.savingsDeposited).toBe(15000)
      expect(overview.savingsWithdrawn).toBe(2000)
      expect(overview.netSavings).toBe(13000)

      // Savings rate: 15000 / 65000 = ~23%
      expect(overview.savingsRate).toBe(23)

      // Loans tracked separately
      expect(overview.debtBorrowed).toBe(8000)
      expect(overview.debtRepaid).toBe(3000)
      expect(overview.debtLent).toBe(4000)
      expect(overview.debtCollected).toBe(1500)
    })

    it('strictly excludes loans from consumption expenses and earned income', () => {
      const loanOnlyTxs = [
        { id: 'l1', type: 'loan_borrow', amount: 50000, category: 'Loan', date: '2026-11-01' },
        { id: 'l2', type: 'loan_repayment', amount: 20000, category: 'Loan', date: '2026-11-05' },
        { id: 'l3', type: 'loan_lend', amount: 10000, category: 'Loan', date: '2026-11-06' },
        { id: 'l4', type: 'loan_collection', amount: 5000, category: 'Loan', date: '2026-11-07' },
      ]

      const overview = calculateAnalyticsOverview(loanOnlyTxs, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      })

      expect(overview.totalIncome).toBe(0)
      expect(overview.totalExpenses).toBe(0)
      expect(overview.netCashflow).toBe(0)
      expect(overview.debtBorrowed).toBe(50000)
      expect(overview.debtRepaid).toBe(20000)
      expect(overview.debtLent).toBe(10000)
      expect(overview.debtCollected).toBe(5000)
    })

    it('handles zero income safely with 0% savings rate without NaN', () => {
      const expensesOnly = [
        { id: 'e1', type: 'spent', amount: 500, category: 'Food', date: '2026-11-01' },
        { id: 's1', type: 'savings_deposit', amount: 100, category: 'Savings', date: '2026-11-02' },
      ]
      const overview = calculateAnalyticsOverview(expensesOnly)
      expect(overview.totalIncome).toBe(0)
      expect(overview.totalExpenses).toBe(500)
      expect(overview.netCashflow).toBe(-500)
      expect(overview.savingsRate).toBe(0)
      expect(Number.isFinite(overview.savingsRate)).toBe(true)
    })

    it('excludes tombstoned deleted transactions', () => {
      const deletedTxIds = { 'tx-1': '2026-11-02T00:00:00Z' }
      const overview = calculateAnalyticsOverview(sampleTransactions, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        deletedTxIds,
      })
      // tx-1 (50000 salary) is excluded, leaving 15000 freelance
      expect(overview.totalIncome).toBe(15000)
    })

    it('preserves paise precision in additions and subtractions', () => {
      const centsTxs = [
        { id: 'c1', type: 'income', amount: 100.1, category: 'Freelance', date: '2026-11-01' },
        { id: 'c2', type: 'income', amount: 200.2, category: 'Freelance', date: '2026-11-01' },
        { id: 'c3', type: 'spent', amount: 50.15, category: 'Food', date: '2026-11-01' },
      ]
      const overview = calculateAnalyticsOverview(centsTxs)
      expect(overview.totalIncome).toBe(300.3)
      expect(overview.totalExpenses).toBe(50.15)
      expect(overview.netCashflow).toBe(250.15)
    })
  })

  describe('calculateCategoryBreakdown', () => {
    it('aggregates expenses by category, calculating percentages and sorting descending', () => {
      const categories = calculateCategoryBreakdown(sampleTransactions, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      })

      expect(categories).toHaveLength(2)
      // Outside Food: 4500 + 2000 = 6500 (67%)
      expect(categories[0].category).toBe('Outside Food')
      expect(categories[0].amount).toBe(6500)
      expect(categories[0].count).toBe(2)
      expect(categories[0].percentage).toBe(67)

      // Groceries: 3200 (33%)
      expect(categories[1].category).toBe('Groceries')
      expect(categories[1].amount).toBe(3200)
      expect(categories[1].count).toBe(1)
      expect(categories[1].percentage).toBe(33)
    })

    it('returns empty array when there are zero expenses', () => {
      const incomeOnly = [
        { id: 'i1', type: 'income', amount: 1000, category: 'Salary', date: '2026-11-01' },
      ]
      const categories = calculateCategoryBreakdown(incomeOnly)
      expect(categories).toEqual([])
    })
  })

  describe('calculateMonthlyTrends', () => {
    it('generates multi-month buckets in chronological order including zero months', () => {
      const ref = new Date(2026, 10, 6) // Nov 2026
      const trends = calculateMonthlyTrends(sampleTransactions, 6, ref)

      expect(trends).toHaveLength(6)
      expect(trends[0].yearMonth).toBe('2026-06') // Jun 2026
      expect(trends[5].yearMonth).toBe('2026-11') // Nov 2026

      // Empty month June has 0 values
      expect(trends[0].income).toBe(0)
      expect(trends[0].expenses).toBe(0)
      expect(trends[0].netCashflow).toBe(0)

      // November has aggregated sample values
      expect(trends[5].income).toBe(65000)
      expect(trends[5].expenses).toBe(9700)
      expect(trends[5].netCashflow).toBe(55300)
      expect(trends[5].savings).toBe(15000)
    })

    it('preserves negative cashflow accurately', () => {
      const deficitTxs = [
        { id: 'd1', type: 'spent', amount: 10000, category: 'Food', date: '2026-11-01' },
        { id: 'd2', type: 'income', amount: 2000, category: 'Other', date: '2026-11-02' },
      ]
      const ref = new Date(2026, 10, 6)
      const trends = calculateMonthlyTrends(deficitTxs, 1, ref)
      expect(trends[0].netCashflow).toBe(-8000)
    })
  })

  describe('calculateIncomeBreakdown', () => {
    it('breaks down income by source and classifies recurring vs non-recurring', () => {
      const state = {
        settings: {
          recurringIncomes: [{ id: 'src-1', name: 'Primary Job', amount: 50000 }],
        },
      }

      const breakdown = calculateIncomeBreakdown(sampleTransactions, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      }, state)

      expect(breakdown.totalIncome).toBe(65000)
      expect(breakdown.recurringTotal).toBe(50000)
      expect(breakdown.nonRecurringTotal).toBe(15000)
      expect(breakdown.recurringPercent).toBe(77) // 50000 / 65000

      expect(breakdown.sources).toHaveLength(2)
      expect(breakdown.sources[0].category).toBe('Salary')
      expect(breakdown.sources[0].isRecurring).toBe(true)

      expect(breakdown.sources[1].category).toBe('Freelance')
      expect(breakdown.sources[1].isRecurring).toBe(false)
    })
  })

  describe('calculateSafeDelta and generateFinancialInsights', () => {
    it('calculates safe period deltas avoiding misleading percentages', () => {
      // Normal positive
      const delta1 = calculateSafeDelta(120, 100)
      expect(delta1.label).toBe('+20%')
      expect(delta1.isPositive).toBe(true)

      // Transition from deficit to surplus
      const delta2 = calculateSafeDelta(500, -500)
      expect(delta2.label).toBe('Turned Surplus')
      expect(delta2.isPositive).toBe(true)

      // Transition from surplus to deficit
      const delta3 = calculateSafeDelta(-200, 300)
      expect(delta3.label).toBe('Turned Deficit')
      expect(delta3.isPositive).toBe(false)

      // Zero baseline
      const delta4 = calculateSafeDelta(500, 0)
      expect(delta4.label).toBe('First record')
    })

    it('generates factual insights from active financial data', () => {
      const overview = {
        totalIncome: 65000,
        totalExpenses: 9700,
        netCashflow: 55300,
        savingsRate: 23,
      }
      const categories = [
        { category: 'Outside Food', amount: 6500, percentage: 67 },
      ]
      const state = {
        savings: 45000,
        savingsGoal: 100000,
      }
      const prevOverview = {
        totalExpenses: 12000,
      }

      const insights = generateFinancialInsights(overview, categories, state, prevOverview)
      expect(insights.length).toBeGreaterThanOrEqual(3)

      const topCat = insights.find((i) => i.id === 'top-spending-concentration')
      expect(topCat).toBeDefined()
      expect(topCat.title).toContain('Outside Food')

      const cashflow = insights.find((i) => i.id === 'cashflow-surplus')
      expect(cashflow).toBeDefined()

      const goal = insights.find((i) => i.id === 'savings-goal-progress')
      expect(goal).toBeDefined()
      expect(goal.description).toContain('45%')

      const expReduction = insights.find((i) => i.id === 'expense-reduction')
      expect(expReduction).toBeDefined()
    })
  })
})

