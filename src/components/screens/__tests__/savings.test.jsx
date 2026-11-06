import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import SavingsScreen from '../SavingsScreen'
import { recordSavingsDeposit, recordSavingsWithdrawal } from '../../../domain/accounting'

describe('SavingsScreen Component Suite (Phase 2.4.2)', () => {
  const mockState = {
    balance: 25000,
    savings: 10000,
    savingsGoal: 50000,
    transactions: [
      {
        id: 'tx-s1',
        type: 'savings_deposit',
        amount: 5000,
        category: 'Savings',
        note: 'Transferred to savings',
        date: '2026-11-06',
        createdAt: '2026-11-06T10:00:00.000Z',
      },
      {
        id: 'tx-s2',
        type: 'savings_withdraw',
        amount: 1000,
        category: 'Savings',
        note: 'Withdrawn from savings',
        date: '2026-11-05',
        createdAt: '2026-11-05T12:00:00.000Z',
      },
      {
        id: 'tx-income',
        type: 'salary',
        amount: 50000,
        category: 'Salary',
        date: '2026-11-01',
      },
    ],
  }

  const mockSavingsTxs = [
    mockState.transactions[0],
    mockState.transactions[1],
  ]

  const defaultProps = {
    state: mockState,
    savingsTxs: mockSavingsTxs,
    onUpdateGoal: vi.fn(),
    onAddToSavings: vi.fn(),
    onWithdraw: vi.fn(),
    onNavigate: vi.fn(),
  }

  it('renders Savings Vault header, subtitle, and total vault balance', () => {
    const html = renderToString(<SavingsScreen {...defaultProps} />)
    expect(html).toContain('Savings Vault')
    expect(html).toContain('Secure reserve funds &amp; financial milestone tracking')
    expect(html).toContain('Total Vault Balance')
    expect(html).toContain('10,000')
  })

  it('displays available cash context for deposits accurately', () => {
    const html = renderToString(<SavingsScreen {...defaultProps} />)
    expect(html).toContain('Available Cash for deposit')
    expect(html).toContain('25,000')
  })

  it('renders goal progress bar, target amount, and progress percentage', () => {
    const html = renderToString(<SavingsScreen {...defaultProps} />)
    expect(html).toContain('Target Savings Goal')
    expect(html).toContain('50,000')
    expect(html).toContain('20%') // 10,000 / 50,000 = 20%
    expect(html).toContain('40,000 remaining to reach target')
  })

  it('renders 2x2 monthly performance metrics accurately', () => {
    const html = renderToString(<SavingsScreen {...defaultProps} />)
    expect(html).toContain('Deposited')
    expect(html).toContain('+₹5,000')
    expect(html).toContain('Withdrawn')
    expect(html).toContain('-₹1,000')
    expect(html).toContain('Net Saved')
    expect(html).toContain('+₹4,000')
    expect(html).toContain('Savings Rate')
    expect(html).toContain('10%') // 5,000 / 50,000 = 10%
  })

  it('renders recent savings transfers with TransactionItem components', () => {
    const html = renderToString(<SavingsScreen {...defaultProps} />)
    expect(html).toContain('Recent Vault Activity')
    expect(html).toContain('Transferred to savings')
    expect(html).toContain('Withdrawn from savings')
    expect(html).toContain('View All →')
  })

  it('renders EmptyState when user has zero savings transactions', () => {
    const html = renderToString(
      <SavingsScreen {...defaultProps} savingsTxs={[]} />
    )
    expect(html).toContain('No savings activity yet')
    expect(html).toContain('Deposits and withdrawals from your savings vault will appear here.')
    expect(html).toContain('Make First Deposit')
  })

  it('disables Withdraw button when savings balance is 0', () => {
    const emptyState = { ...mockState, savings: 0 }
    const html = renderToString(
      <SavingsScreen {...defaultProps} state={emptyState} />
    )
    expect(html).toContain('disabled')
  })

  it('enables Withdraw button when savings balance is greater than 0', () => {
    const html = renderToString(<SavingsScreen {...defaultProps} />)
    // Should have Add to Savings and Withdraw buttons
    expect(html).toContain('Add to Savings')
    expect(html).toContain('Withdraw')
  })

  it('adheres to accounting validation rules for deposit and withdrawal', () => {
    // 1. Cannot deposit more than available cash balance
    expect(() => {
      recordSavingsDeposit({ balance: 500, savings: 1000, transactions: [] }, { amount: 600 })
    }).toThrow(/Insufficient cash balance/)

    // 2. Cannot withdraw more than existing savings balance
    expect(() => {
      recordSavingsWithdrawal({ balance: 500, savings: 1000, transactions: [] }, { amount: 1200 })
    }).toThrow(/Insufficient savings balance/)

    // 3. Valid deposit moves funds correctly
    const deposited = recordSavingsDeposit(
      { balance: 1000, savings: 500, transactions: [] },
      { amount: 300 }
    )
    expect(deposited.balance).toBe(700)
    expect(deposited.savings).toBe(800)
    expect(deposited.transactions[0].type).toBe('savings_deposit')

    // 4. Valid withdrawal moves funds correctly
    const withdrawn = recordSavingsWithdrawal(
      { balance: 700, savings: 800, transactions: [] },
      { amount: 400 }
    )
    expect(withdrawn.balance).toBe(1100)
    expect(withdrawn.savings).toBe(400)
    expect(withdrawn.transactions[0].type).toBe('savings_withdraw')
  })
})

