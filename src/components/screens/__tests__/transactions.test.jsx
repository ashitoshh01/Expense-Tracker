import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import TransactionsScreen, { getDateGroupLabel } from '../TransactionsScreen'
import TransactionItem, { formatDate, formatTimeOrDate } from '../TransactionItem'

describe('TransactionsScreen Component Suite (Phase 2.4.1)', () => {
  const mockTransactions = [
    {
      id: 'tx-1',
      type: 'income',
      amount: 50000,
      category: 'Salary',
      note: 'October Paycheck',
      date: '2026-11-06',
      createdAt: '2026-11-06T10:00:00.000Z',
    },
    {
      id: 'tx-2',
      type: 'spent',
      amount: 450,
      category: 'Outside Food',
      note: 'Dinner with team',
      date: '2026-11-06',
      createdAt: '2026-11-06T20:30:00.000Z',
    },
    {
      id: 'tx-3',
      type: 'spent',
      amount: 1200,
      category: 'Shopping',
      note: 'New shoes',
      date: '2026-11-05',
      createdAt: '2026-11-05T15:00:00.000Z',
    },
    {
      id: 'tx-4',
      type: 'savings_deposit',
      amount: 5000,
      category: 'Savings',
      note: 'Vault deposit',
      date: '2026-10-31',
      createdAt: '2026-10-31T09:00:00.000Z',
    },
  ]

  const defaultProps = {
    transactions: mockTransactions,
    onNavigate: vi.fn(),
    onDeleteTx: vi.fn(),
    onEditTx: vi.fn(),
  }

  it('renders screen header with title, subtitle count, and Add Transaction button', () => {
    const html = renderToString(<TransactionsScreen {...defaultProps} />)
    expect(html).toContain('Transactions')
    expect(html).toContain('4 total recorded transactions')
    expect(html).toContain('Add Transaction')
  })

  it('renders 3-stat overview with monthly income, expenses, and net cash flow', () => {
    const html = renderToString(<TransactionsScreen {...defaultProps} />)
    expect(html).toContain('Income (')
    expect(html).toContain('Spent (')
    expect(html).toContain('Net Cash Flow')
    expect(html).toContain('50,000')
    expect(html).toContain('1,650') // 450 + 1200
  })

  it('groups transactions into chronological date groups', () => {
    const html = renderToString(<TransactionsScreen {...defaultProps} />)
    expect(html).toContain('wf-tx-date-group')
    expect(html).toContain('wf-tx-date-title')
    expect(html).toContain('Salary')
    expect(html).toContain('Outside Food')
    expect(html).toContain('Shopping')
    expect(html).toContain('Savings')
  })

  it('computes correct date group labels via getDateGroupLabel', () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(
      yesterday.getMonth() + 1
    ).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    expect(getDateGroupLabel(todayStr)).toBe('Today')
    expect(getDateGroupLabel(yesterdayStr)).toBe('Yesterday')
    expect(getDateGroupLabel('2026-05-15')).toContain('May 2026')
    expect(getDateGroupLabel('')).toBe('Other')
  })

  it('renders EmptyState when transaction array is completely empty', () => {
    const html = renderToString(
      <TransactionsScreen {...defaultProps} transactions={[]} />
    )
    expect(html).toContain('No transactions yet')
    expect(html).toContain('Start tracking your financial transactions')
    expect(html).toContain('Add First Transaction')
  })

  it('renders filter controls including search bar, type pills, category, and date selects', () => {
    const html = renderToString(<TransactionsScreen {...defaultProps} />)
    expect(html).toContain('Search note, category, or amount...')
    expect(html).toContain('All')
    expect(html).toContain('Income')
    expect(html).toContain('Expenses')
    expect(html).toContain('Savings')
    expect(html).toContain('Loans')
    expect(html).toContain('All Categories')
    expect(html).toContain('All Time')
  })

  it('formats positive and negative transaction amounts accurately', () => {
    const html = renderToString(<TransactionsScreen {...defaultProps} />)
    // Income: +₹50,000
    expect(html).toContain('+₹50,000')
    // Expense: −₹450
    expect(html).toContain('−₹450')
  })

  it('formats dates and times using TransactionItem helper utilities', () => {
    expect(formatDate('2026-11-06')).toContain('Nov 2026')
    expect(formatDate('')).toBe('')
    expect(formatTimeOrDate({ createdAt: '2026-11-06T14:30:00.000Z' })).toBeTruthy()
    expect(formatTimeOrDate({ date: '2026-11-06' })).toContain('Nov 2026')
  })

  it('renders TransactionItem with accessible role, aria-label, and edit/delete actions', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const html = renderToString(
      <TransactionItem
        tx={mockTransactions[1]}
        showDate
        showDelete
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
    expect(html).toContain('role="button"')
    expect(html).toContain('aria-label="Edit Outside Food: ₹450"')
    expect(html).toContain('aria-label="Edit Outside Food"')
    expect(html).toContain('aria-label="Delete Outside Food"')
    expect(html).toContain('−₹450')
  })
})
