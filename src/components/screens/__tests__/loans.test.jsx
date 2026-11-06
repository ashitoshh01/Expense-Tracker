import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import LoansScreen from '../LoansScreen'
import { createLoan, repayLoan } from '../../../domain/accounting'

describe('LoansScreen Component Suite (Phase 2.4.3)', () => {
  const mockLoans = [
    {
      id: 'loan-1',
      name: 'Rohan Verma',
      type: 'borrowed',
      amount: 10000,
      outstanding: 6000,
      date: '2026-11-01',
      dueDate: '2026-12-01',
      status: 'partially_paid',
      repayments: [
        {
          id: 'rep-1',
          amount: 4000,
          date: '2026-11-05',
          note: 'First installment',
        },
      ],
    },
    {
      id: 'loan-2',
      name: 'Pooja Singh',
      type: 'lent',
      amount: 5000,
      outstanding: 5000,
      date: '2026-11-02',
      dueDate: '',
      status: 'active',
      repayments: [],
    },
    {
      id: 'loan-3',
      name: 'Amit Kumar',
      type: 'borrowed',
      amount: 3000,
      outstanding: 0,
      date: '2026-10-15',
      dueDate: '',
      status: 'repaid',
      repayments: [
        {
          id: 'rep-2',
          amount: 3000,
          date: '2026-10-25',
          note: 'Cleared in full',
        },
      ],
    },
  ]

  const mockTransactions = [
    {
      id: 'tx-loan-rep',
      type: 'loan_repayment',
      amount: 4000,
      date: '2026-11-05',
    },
  ]

  const defaultProps = {
    loans: mockLoans,
    transactions: mockTransactions,
    onRepaid: vi.fn(),
    onAddLoan: vi.fn(),
    onNavigate: vi.fn(),
  }

  it('renders Loans screen header with title, subtitle, and Add Loan CTA', () => {
    const html = renderToString(<LoansScreen {...defaultProps} />)
    expect(html).toContain('Loans')
    expect(html).toContain('Manage borrowed money, repayments, and money lent.')
    expect(html).toContain('Add Loan')
  })

  it('renders 4-card financial overview accurately', () => {
    const html = renderToString(<LoansScreen {...defaultProps} />)
    // 1. Total Borrowed: only active borrowed (loan-1: 6,000)
    expect(html).toContain('Total Borrowed')
    expect(html).toContain('₹6,000')

    // 2. Total Lent: only active lent (loan-2: 5,000)
    expect(html).toContain('Total Lent')
    expect(html).toContain('₹5,000')

    // 3. Net Position: 5000 - 6000 = -1000
    expect(html).toContain('Net Position')
    expect(html).toContain('-₹1,000')
    expect(html).toContain('Net debt you owe')

    // 4. Repayments this month: 4,000
    expect(html).toContain('Repayments (')
    expect(html).toContain('₹4,000')
  })

  it('renders filter pills including All, Borrowed, Lent, Active, Settled', () => {
    const html = renderToString(<LoansScreen {...defaultProps} />)
    expect(html).toContain('All Loans')
    expect(html).toContain('Borrowed')
    expect(html).toContain('Lent')
    expect(html).toContain('Active')
    expect(html).toContain('Settled')
  })

  it('renders loan cards with person avatars, badges, and progress bars', () => {
    const html = renderToString(<LoansScreen {...defaultProps} />)
    expect(html).toContain('Rohan Verma')
    expect(html).toContain('Pooja Singh')
    expect(html).toContain('Amit Kumar')

    // Badges
    expect(html).toContain('Borrowed')
    expect(html).toContain('Lent')
    expect(html).toContain('Partial')
    expect(html).toContain('Settled')

    // Progress
    expect(html).toContain('progressbar')
    expect(html).toContain('40%') // 4,000 of 10,000 = 40%
    expect(html).toContain('0%')  // 0 of 5,000 = 0%
    expect(html).toContain('100%') // 3,000 of 3,000 = 100%
  })

  it('renders Repay action for active borrowed loans and Collect for active lent loans', () => {
    const html = renderToString(<LoansScreen {...defaultProps} />)
    expect(html).toContain('Repay')
    expect(html).toContain('Collect')
  })

  it('renders EmptyState when user has zero loans recorded', () => {
    const html = renderToString(
      <LoansScreen {...defaultProps} loans={[]} />
    )
    expect(html).toContain('No loans recorded')
    expect(html).toContain('all clear! Track borrowed money or money you lend to friends.')
    expect(html).toContain('Add First Loan')
  })

  it('preserves accounting integrity for loan creation and repayments', () => {
    const initialState = {
      balance: 15000,
      savings: 0,
      loans: [],
      transactions: [],
    }

    // 1. Borrow 5000
    const stateWithBorrow = createLoan(initialState, {
      name: 'Test Lender',
      amount: 5000,
      type: 'borrowed',
    })
    expect(stateWithBorrow.balance).toBe(20000)
    expect(stateWithBorrow.loans[0].outstanding).toBe(5000)
    expect(stateWithBorrow.loans[0].status).toBe('active')

    // 2. Cannot lend more than available balance
    expect(() => {
      createLoan(stateWithBorrow, {
        name: 'Friend',
        amount: 25000,
        type: 'lent',
      })
    }).toThrow(/Insufficient balance/)

    // 3. Partial repayment
    const loanId = stateWithBorrow.loans[0].id
    const stateAfterRepay = repayLoan(stateWithBorrow, {
      loanId,
      amount: 2000,
      note: 'Partial payment',
    })
    expect(stateAfterRepay.balance).toBe(18000)
    expect(stateAfterRepay.loans[0].outstanding).toBe(3000)
    expect(stateAfterRepay.loans[0].status).toBe('partially_paid')
    expect(stateAfterRepay.loans[0].repayments).toHaveLength(1)

    // 4. Cannot repay more than outstanding debt
    expect(() => {
      repayLoan(stateAfterRepay, {
        loanId,
        amount: 3500,
      })
    }).toThrow(/exceeds outstanding debt/)

    // 5. Full repayment settles the loan
    const stateFullySettled = repayLoan(stateAfterRepay, {
      loanId,
      amount: 3000,
      note: 'Full settlement',
    })
    expect(stateFullySettled.balance).toBe(15000)
    expect(stateFullySettled.loans[0].outstanding).toBe(0)
    expect(stateFullySettled.loans[0].status).toBe('repaid')
  })
})
