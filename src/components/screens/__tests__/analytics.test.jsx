import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import AnalyticsScreen from '../AnalyticsScreen'
import SidebarNavigation from '../../layout/SidebarNavigation'
import BottomNavigation from '../../layout/BottomNavigation'

describe('AnalyticsScreen (Phase 2.5.1)', () => {
  const mockTransactions = [
    {
      id: 't1',
      type: 'salary',
      amount: 60000,
      category: 'Salary',
      date: new Date().toISOString().split('T')[0],
      sourceId: 'src-1',
    },
    {
      id: 't2',
      type: 'spent',
      amount: 4500,
      category: 'Outside Food',
      date: new Date().toISOString().split('T')[0],
    },
    {
      id: 't3',
      type: 'spent',
      amount: 2500,
      category: 'Groceries',
      date: new Date().toISOString().split('T')[0],
    },
    {
      id: 't4',
      type: 'savings_deposit',
      amount: 15000,
      category: 'Savings',
      date: new Date().toISOString().split('T')[0],
    },
    {
      id: 't5',
      type: 'loan_borrow',
      amount: 10000,
      category: 'Loan',
      date: new Date().toISOString().split('T')[0],
    },
  ]

  const mockState = {
    balance: 55000,
    savings: 15000,
    savingsGoal: 50000,
    loans: [],
    settings: {
      recurringIncomes: [{ id: 'src-1', name: 'Company Salary', amount: 60000 }],
    },
  }

  it('renders Analytics screen header, title, and date-range preset pills', () => {
    const html = renderToString(
      <AnalyticsScreen
        transactions={mockTransactions}
        state={mockState}
        onNavigate={vi.fn()}
      />
    )
    expect(html).toContain('Analytics')
    expect(html).toContain('Understand your income, spending patterns, and cashflow.')
    expect(html).toContain('This Month')
    expect(html).toContain('Last 3 Months')
    expect(html).toContain('All Time')
  })

  it('renders 4 KPI overview cards with accurate rupee amounts and savings rate', () => {
    const html = renderToString(
      <AnalyticsScreen
        transactions={mockTransactions}
        state={mockState}
        onNavigate={vi.fn()}
      />
    )
    expect(html).toContain('Total Income')
    expect(html).toContain('60,000') // Salary
    expect(html).toContain('Total Expenses')
    expect(html).toContain('7,000') // 4500 + 2500
    expect(html).toContain('Net Cashflow')
    expect(html).toContain('+₹53,000') // 60000 - 7000
    expect(html).toContain('Savings Rate')
    expect(html).toContain('25%') // 15000 / 60000 = 25%
  })

  it('renders SVG trends chart, category donut chart, and ranked spending list', () => {
    const html = renderToString(
      <AnalyticsScreen
        transactions={mockTransactions}
        state={mockState}
        onNavigate={vi.fn()}
      />
    )
    expect(html).toContain('Monthly Cashflow Trends')
    expect(html).toContain('Spending by Category')
    expect(html).toContain('Outside Food')
    expect(html).toContain('Groceries')
    expect(html).toContain('64%') // 4500 / 7000 = 64%
    expect(html).toContain('36%') // 2500 / 7000 = 36%
  })

  it('renders income composition breakdown with recurring badges', () => {
    const html = renderToString(
      <AnalyticsScreen
        transactions={mockTransactions}
        state={mockState}
        onNavigate={vi.fn()}
      />
    )
    expect(html).toContain('Income Composition')
    expect(html).toContain('Salary')
    expect(html).toContain('Recurring')
  })

  it('renders deterministic financial insights', () => {
    const html = renderToString(
      <AnalyticsScreen
        transactions={mockTransactions}
        state={mockState}
        onNavigate={vi.fn()}
      />
    )
    expect(html).toContain('Financial Insights')
    expect(html).toContain('Outside Food') // Top spending category
    expect(html).toContain('Healthy Cashflow Surplus')
  })

  it('renders EmptyState when transaction array is empty without throwing errors', () => {
    const html = renderToString(
      <AnalyticsScreen
        transactions={[]}
        state={mockState}
        onNavigate={vi.fn()}
      />
    )
    expect(html).toContain('No financial data recorded yet')
    expect(html).toContain('Go to Transactions')
  })

  it('SidebarNavigation and BottomNavigation include Analytics tab', () => {
    const sidebarHtml = renderToString(
      <SidebarNavigation active="analytics" onNavigate={vi.fn()} authUser={{ email: 'user@example.com' }} />
    )
    expect(sidebarHtml).toContain('Analytics')

    const bottomNavHtml = renderToString(
      <BottomNavigation active="analytics" onNavigate={vi.fn()} />
    )
    expect(bottomNavHtml).toContain('Analytics')
  })
})

