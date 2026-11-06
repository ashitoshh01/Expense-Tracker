import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import HomeScreen, { MonthlySummary } from '../HomeScreen'

describe('HomeScreen / Dashboard Redesign (Phase 2.3)', () => {
  const mockState = {
    balance: 50000,
    savings: 20000,
    savingsGoal: 100000,
    loans: [
      { id: 'l1', name: 'John', amount: 5000, outstanding: 5000, type: 'borrowed', status: 'active' },
      { id: 'l2', name: 'Alice', amount: 2000, outstanding: 1000, type: 'lent', status: 'partially_paid' },
    ],
    transactions: [
      {
        id: 'tx1',
        type: 'spent',
        category: 'Outside Food',
        amount: 450,
        date: new Date().toISOString().split('T')[0],
        note: 'Dinner',
      },
      {
        id: 'tx2',
        type: 'income',
        category: 'Salary',
        amount: 50000,
        date: new Date().toISOString().split('T')[0],
        note: 'Monthly credit',
      },
    ],
  }

  const defaultProps = {
    state: mockState,
    monthlyEarned: 50000,
    monthlySpent: 450,
    balanceChangePercent: { label: '+12.5%', isPositive: true },
    onNavigate: vi.fn(),
    onAddMoney: vi.fn(),
    onAddExpense: vi.fn(),
    cloudStatus: 'synced',
    onCloudClick: vi.fn(),
    onRetryCloud: vi.fn(),
    authUser: { displayName: 'Rahul Sharma', email: 'rahul@example.com' },
    onUpdateName: vi.fn(),
  }

  it('renders dashboard with user greeting, date context, and cloud status', () => {
    const html = renderToString(<HomeScreen {...defaultProps} />)
    expect(html).toContain('Rahul Sharma')
    expect(html).toContain('cloud-badge')
    expect(html).toContain('synced')
    expect(html).toContain('Available Balance')
  })

  it('renders available balance formatted in Indian Rupee format', () => {
    const html = renderToString(<HomeScreen {...defaultProps} />)
    expect(html).toContain('50,000')
    expect(html).toContain('₹')
  })

  it('renders monthly income and expense metrics accurately', () => {
    const html = renderToString(<HomeScreen {...defaultProps} />)
    expect(html).toContain('+₹50,000')
    expect(html).toContain('-₹450')
  })

  it('renders top spending category breakdown when expenses exist this month', () => {
    const html = renderToString(<HomeScreen {...defaultProps} />)
    expect(html).toContain('Outside Food')
    expect(html).toContain('450')
    expect(html).toContain('100%')
  })

  it('renders recent transactions list when transactions are present', () => {
    const html = renderToString(<HomeScreen {...defaultProps} />)
    expect(html).toContain('Recent Transactions')
    expect(html).toContain('Dinner')
    expect(html).toContain('Monthly credit')
  })

  it('renders EmptyState when user has zero transactions without errors or NaN', () => {
    const emptyState = {
      balance: 0,
      savings: 0,
      savingsGoal: 0,
      loans: [],
      transactions: [],
    }

    const html = renderToString(
      <HomeScreen
        {...defaultProps}
        state={emptyState}
        monthlyEarned={0}
        monthlySpent={0}
        balanceChangePercent={{ label: '0%', isPositive: true }}
      />
    )

    expect(html).toContain('No transactions yet')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('undefined')
    expect(html).toContain('Add Income')
    expect(html).toContain('Add Expense')
  })

  it('renders MonthlySummary backward-compatible export', () => {
    const html = renderToString(<MonthlySummary earned={10000} spent={3000} />)
    expect(html).toContain('month-card')
    expect(html).toContain('10,000')
    expect(html).toContain('3,000')
    expect(html).toContain("spending less than you earn")
  })
})

