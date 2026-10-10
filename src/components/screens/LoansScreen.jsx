import { useState } from 'react'
import { ArrowLeft, Landmark, Plus, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react'
import { formatAmount } from '../../domain/money'
import { formatDate } from './TransactionItem'

const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?')

export default function LoansScreen({ loans, onRepaid, onAddLoan, onNavigate }) {
  const [expandedLoanId, setExpandedLoanId] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'borrowed' | 'lent' | 'repaid'

  const filteredLoans = loans.filter((loan) => {
    if (filter === 'borrowed') return loan.type !== 'lent' && loan.status !== 'repaid'
    if (filter === 'lent') return loan.type === 'lent' && loan.status !== 'repaid'
    if (filter === 'repaid') return loan.status === 'repaid'
    return true
  })

  const toggleExpand = (id) => {
    setExpandedLoanId(expandedLoanId === id ? null : id)
  }

  return (
    <div className="screen">
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-btn" onClick={() => onNavigate('more')}>
            <ArrowLeft size={22} />
          </button>
          <h1 className="page-title">Loans & Debt</h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-pills" style={{ marginBottom: 16 }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'borrowed', label: 'Borrowed' },
          { id: 'lent', label: 'Lent' },
          { id: 'repaid', label: 'Repaid' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`filter-pill ${filter === tab.id ? 'active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredLoans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Landmark />
          </div>
          <div className="empty-state-title">No loans recorded</div>
          <div className="empty-state-sub">You're all clear! 🎉</div>
        </div>
      ) : (
        <div className="loans-list-page" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredLoans.map((loan) => {
            const isBorrowed = loan.type !== 'lent'
            const isRepaid = loan.status === 'repaid' || loan.outstanding <= 0
            const isPartial = loan.status === 'partially_paid' || (loan.outstanding < loan.amount && !isRepaid)
            const isExpanded = expandedLoanId === loan.id

            return (
              <div
                key={loan.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    className="loan-avatar"
                    style={{
                      background: isBorrowed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: isBorrowed ? 'var(--red)' : 'var(--green)',
                    }}
                  >
                    {isBorrowed ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>

                  <div className="loan-info" onClick={() => toggleExpand(loan.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="loan-name">{loan.name}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: isRepaid
                            ? 'rgba(16, 185, 129, 0.1)'
                            : isPartial
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'rgba(99, 102, 241, 0.1)',
                          color: isRepaid ? 'var(--green)' : isPartial ? '#F59E0B' : 'var(--accent)',
                        }}
                      >
                        {isRepaid ? 'Repaid' : isPartial ? 'Partial' : isBorrowed ? 'Borrowed' : 'Lent'}
                      </span>
                    </div>
                    <div className="loan-date">
                      {formatDate(loan.date)} {loan.dueDate ? `• Due ${formatDate(loan.dueDate)}` : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="loan-amount" style={{ color: isBorrowed ? 'var(--red)' : 'var(--green)' }}>
                      ₹{formatAmount(loan.outstanding)}
                    </div>
                    {loan.amount !== loan.outstanding && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        of ₹{formatAmount(loan.amount)}
                      </div>
                    )}
                  </div>

                  {!isRepaid ? (
                    <button
                      className="loan-repaid-btn"
                      onClick={() => onRepaid(loan)}
                      title={isBorrowed ? 'Make a repayment' : 'Record collection'}
                    >
                      {isBorrowed ? 'Repay' : 'Collect'}
                    </button>
                  ) : null}

                  {loan.repayments && loan.repayments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(loan.id)}
                      style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>

                {/* Expanded Repayment History */}
                {isExpanded && loan.repayments && loan.repayments.length > 0 && (
                  <div style={{ background: 'var(--bg)', padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Repayment History ({loan.repayments.length})
                    </div>
                    {loan.repayments.map((r, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          borderBottom: idx < loan.repayments.length - 1 ? '1px dashed var(--border)' : 'none',
                        }}
                      >
                        <span>
                          {formatDate(r.date)} {r.note ? `— ${r.note}` : ''}
                        </span>
                        <strong style={{ color: 'var(--green)' }}>+₹{formatAmount(r.amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="fab-container">
        <button className="fab-btn" onClick={onAddLoan}>
          <Plus size={20} />
          Add Loan
        </button>
      </div>
    </div>
  )
}
