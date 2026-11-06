import { useState, useMemo } from 'react'
import {
  Landmark,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Calendar,
  CheckCircle2,
  DollarSign,
  Clock,
} from 'lucide-react'
import { formatAmount, addMoney } from '../../domain/money'
import { formatDate } from './TransactionItem'
import { EmptyState, Badge, Button } from '../ui'

const getInitial = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?')

export default function LoansScreen({
  loans = [],
  transactions = [],
  onRepaid,
  onAddLoan,
  onNavigate,
}) {
  const [filter, setFilter] = useState('all') // 'all' | 'borrowed' | 'lent' | 'active' | 'settled'
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedLoanId, setExpandedLoanId] = useState(null)

  // 1. Total Borrowed: Active money owed to others
  const activeBorrowed = useMemo(() => {
    return (loans || []).filter(
      (l) => l.type !== 'lent' && l.status !== 'repaid' && Number(l.outstanding) > 0
    )
  }, [loans])

  const totalBorrowed = useMemo(() => {
    return activeBorrowed.reduce(
      (sum, l) => addMoney(sum, Number(l.outstanding) || 0),
      0
    )
  }, [activeBorrowed])

  // 2. Total Lent: Active money owed to the user
  const activeLent = useMemo(() => {
    return (loans || []).filter(
      (l) => l.type === 'lent' && l.status !== 'repaid' && Number(l.outstanding) > 0
    )
  }, [loans])

  const totalLent = useMemo(() => {
    return activeLent.reduce(
      (sum, l) => addMoney(sum, Number(l.outstanding) || 0),
      0
    )
  }, [activeLent])

  // 3. Net Loan Position (Lent - Borrowed)
  const netPosition = totalLent - totalBorrowed

  // 4. Repayments Activity this month
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentMonthShort = now.toLocaleDateString('en-IN', { month: 'short' })

  const monthlyRepayments = useMemo(() => {
    let repaid = 0
    let collected = 0

    if (Array.isArray(transactions) && transactions.length > 0) {
      for (const t of transactions) {
        if (t.date && t.date.startsWith(currentMonthKey)) {
          const amt = Number(t.amount) || 0
          if (t.type === 'loan_repayment') repaid = addMoney(repaid, amt)
          if (t.type === 'loan_collection') collected = addMoney(collected, amt)
        }
      }
    } else {
      for (const l of loans || []) {
        const isLent = l.type === 'lent'
        for (const r of l.repayments || []) {
          if (r.date && r.date.startsWith(currentMonthKey)) {
            const amt = Number(r.amount) || 0
            if (isLent) collected = addMoney(collected, amt)
            else repaid = addMoney(repaid, amt)
          }
        }
      }
    }

    return {
      repaid,
      collected,
      total: addMoney(repaid, collected),
    }
  }, [transactions, loans, currentMonthKey])

  // Filter & Search composition
  const filteredLoans = useMemo(() => {
    let list = Array.isArray(loans) ? [...loans] : []

    // Search query matches person name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((l) => {
        const name = (l.name || '').toLowerCase()
        const note = (l.note || '').toLowerCase()
        return name.includes(q) || note.includes(q)
      })
    }

    // Tab filter
    switch (filter) {
      case 'borrowed':
        list = list.filter((l) => l.type !== 'lent')
        break
      case 'lent':
        list = list.filter((l) => l.type === 'lent')
        break
      case 'active':
        list = list.filter(
          (l) => l.status !== 'repaid' && Number(l.outstanding) > 0
        )
        break
      case 'settled':
        list = list.filter(
          (l) => l.status === 'repaid' || Number(l.outstanding) <= 0
        )
        break
      default:
        break
    }

    // Sort: active first, then newest date
    list.sort((a, b) => {
      const aSettled = a.status === 'repaid' || Number(a.outstanding) <= 0
      const bSettled = b.status === 'repaid' || Number(b.outstanding) <= 0
      if (aSettled !== bSettled) {
        return aSettled ? 1 : -1
      }
      const dateA = a.date || ''
      const dateB = b.date || ''
      return dateB.localeCompare(dateA)
    })

    return list
  }, [loans, filter, searchQuery])

  const toggleExpand = (id) => {
    setExpandedLoanId((prev) => (prev === id ? null : id))
  }

  const hasActiveFilters = Boolean(searchQuery.trim() || filter !== 'all')

  const handleClearFilters = () => {
    setSearchQuery('')
    setFilter('all')
  }

  return (
    <div className="screen wf-loans-screen">
      {/* ── Screen Header ── */}
      <header className="wf-loans-header">
        <div className="wf-loans-header-left">
          <h1 className="wf-loans-title">Loans</h1>
          <span className="wf-loans-subtitle">
            Manage borrowed money, repayments, and money lent.
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={onAddLoan}
        >
          Add Loan
        </Button>
      </header>

      {/* ── 4-Card Financial Overview ── */}
      <section className="wf-loans-overview" aria-label="Loans overview summary">
        {/* Total Borrowed */}
        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">Total Borrowed</span>
            <div className="wf-stat-icon-wrap expense" aria-hidden="true">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div
            className="wf-stat-value"
            style={{ color: totalBorrowed > 0 ? 'var(--wf-expense-600)' : 'var(--wf-text-primary)' }}
          >
            {`₹${formatAmount(totalBorrowed)}`}
          </div>
          <div className="wf-stat-sub">Active debt owed to others</div>
        </div>

        {/* Total Lent */}
        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">Total Lent</span>
            <div className="wf-stat-icon-wrap income" aria-hidden="true">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div
            className="wf-stat-value"
            style={{ color: totalLent > 0 ? 'var(--wf-income-600)' : 'var(--wf-text-primary)' }}
          >
            {`₹${formatAmount(totalLent)}`}
          </div>
          <div className="wf-stat-sub">Active credit owed to you</div>
        </div>

        {/* Net Loan Position */}
        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">Net Position</span>
            <div
              className={`wf-stat-icon-wrap ${
                netPosition > 0 ? 'income' : netPosition < 0 ? 'expense' : 'neutral'
              }`}
              aria-hidden="true"
            >
              <Landmark size={16} />
            </div>
          </div>
          <div
            className="wf-stat-value"
            style={{
              color:
                netPosition > 0
                  ? 'var(--wf-income-600)'
                  : netPosition < 0
                  ? 'var(--wf-expense-600)'
                  : 'var(--wf-text-primary)',
            }}
          >
            {netPosition === 0
              ? '₹0'
              : `${netPosition > 0 ? '+' : '-'}₹${formatAmount(Math.abs(netPosition))}`}
          </div>
          <div className="wf-stat-sub">
            {netPosition > 0
              ? 'Net balance owed to you'
              : netPosition < 0
              ? 'Net debt you owe'
              : 'Debts and credits balanced'}
          </div>
        </div>

        {/* Repayments This Month */}
        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">{`Repayments (${currentMonthShort})`}</span>
            <div className="wf-stat-icon-wrap savings" aria-hidden="true">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="wf-stat-value">{`₹${formatAmount(monthlyRepayments.total)}`}</div>
          <div className="wf-stat-sub">
            {monthlyRepayments.total > 0
              ? `₹${formatAmount(monthlyRepayments.repaid)} paid, ₹${formatAmount(
                  monthlyRepayments.collected
                )} collected`
              : 'No repayments this month'}
          </div>
        </div>
      </section>

      {/* ── Search & Filter Controls ── */}
      <section className="wf-loans-controls" aria-label="Filter loans">
        <div className="wf-loans-search-bar">
          <Search size={16} color="var(--wf-text-muted)" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search person or loan note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search loans by person or note"
          />
          {searchQuery && (
            <button
              type="button"
              className="wf-loans-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search input"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="wf-loans-filter-row" role="tablist" aria-label="Filter loans by category">
          {[
            { id: 'all', label: 'All Loans' },
            { id: 'borrowed', label: 'Borrowed' },
            { id: 'lent', label: 'Lent' },
            { id: 'active', label: 'Active' },
            { id: 'settled', label: 'Settled' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`wf-loans-filter-pill ${filter === tab.id ? 'active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <div className="wf-tx-active-bar">
            <div className="wf-tx-active-chips">
              <span>Active filters:</span>
              {searchQuery && (
                <span className="wf-tx-filter-tag">{`Query: "${searchQuery}"`}</span>
              )}
              {filter !== 'all' && (
                <span className="wf-tx-filter-tag">{`Tab: ${filter}`}</span>
              )}
            </div>
            <button
              type="button"
              className="wf-tx-clear-btn"
              onClick={handleClearFilters}
              aria-label="Reset all filters"
            >
              Reset all
            </button>
          </div>
        )}
      </section>

      {/* ── Loan Content Grid ── */}
      {loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans recorded"
          description="You're all clear! Track borrowed money or money you lend to friends."
          action={
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={onAddLoan}
            >
              Add First Loan
            </Button>
          }
        />
      ) : filteredLoans.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching loans"
          description="No loans match your current search or filter criteria."
          action={
            <Button
              variant="secondary"
              size="md"
              icon={X}
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div className="wf-loans-grid">
          {filteredLoans.map((loan) => {
            const isBorrowed = loan.type !== 'lent'
            const isRepaid =
              loan.status === 'repaid' || Number(loan.outstanding) <= 0
            const isPartial =
              !isRepaid &&
              (loan.status === 'partially_paid' ||
                Number(loan.outstanding) < Number(loan.amount))
            const isExpanded = expandedLoanId === loan.id
            const repaidAmount = Math.max(
              0,
              (Number(loan.amount) || 0) - (Number(loan.outstanding) || 0)
            )
            const progressPercent =
              loan.amount > 0
                ? Math.min(
                    100,
                    Math.max(
                      0,
                      Math.round((repaidAmount / Number(loan.amount)) * 100)
                    )
                  )
                : 0

            return (
              <div key={loan.id} className="wf-loan-card">
                {/* Top: Person & Badges */}
                <div className="wf-loan-card-top">
                  <div className="wf-loan-person">
                    <div
                      className={`wf-loan-avatar ${
                        isRepaid ? 'settled' : isBorrowed ? 'borrowed' : 'lent'
                      }`}
                      aria-hidden="true"
                    >
                      {getInitial(loan.name)}
                    </div>
                    <div className="wf-loan-name-block">
                      <span className="wf-loan-name">{loan.name}</span>
                      <span className="wf-loan-dates">
                        {loan.date ? formatDate(loan.date) : 'Undated'}
                        {loan.dueDate ? ` • Due ${formatDate(loan.dueDate)}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="wf-loan-badges">
                    <Badge
                      variant={isBorrowed ? 'expense' : 'income'}
                      size="sm"
                    >
                      {isBorrowed ? 'Borrowed' : 'Lent'}
                    </Badge>
                    <Badge
                      variant={
                        isRepaid
                          ? 'income'
                          : isPartial
                          ? 'warning'
                          : 'brand'
                      }
                      size="sm"
                    >
                      {isRepaid ? 'Settled' : isPartial ? 'Partial' : 'Active'}
                    </Badge>
                  </div>
                </div>

                {/* Middle: Financials & Repayment Progress */}
                <div className="wf-loan-financials">
                  <div className="wf-loan-amount-row">
                    <span className="wf-loan-outstanding-label">
                      {isRepaid
                        ? 'Fully Settled'
                        : isBorrowed
                        ? 'Outstanding Debt'
                        : 'Outstanding Credit'}
                    </span>
                    <span
                      className={`wf-loan-outstanding-val ${
                        isRepaid ? 'settled' : isBorrowed ? 'borrowed' : 'lent'
                      }`}
                    >
                      {`₹${formatAmount(loan.outstanding)}`}
                    </span>
                  </div>

                  <div
                    className="wf-loan-track"
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label={`Repayment progress: ${progressPercent}%`}
                  >
                    <div
                      className={`wf-loan-fill ${
                        isRepaid ? 'settled' : isBorrowed ? 'borrowed' : 'lent'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="wf-loan-sub-row">
                    <span>
                      {isRepaid
                        ? `All ₹${formatAmount(loan.amount)} settled`
                        : `₹${formatAmount(repaidAmount)} of ₹${formatAmount(
                            loan.amount
                          )} cleared`}
                    </span>
                    <span>{`${progressPercent}%`}</span>
                  </div>
                </div>

                {/* Bottom: Action Buttons */}
                <div className="wf-loan-actions">
                  <div>
                    {loan.repayments && loan.repayments.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={isExpanded ? ChevronUp : ChevronDown}
                        onClick={() => toggleExpand(loan.id)}
                        aria-expanded={isExpanded}
                      >
                        {`${loan.repayments.length} Repayment${
                          loan.repayments.length === 1 ? '' : 's'
                        }`}
                      </Button>
                    )}
                  </div>

                  {!isRepaid && (
                    <Button
                      variant={isBorrowed ? 'danger' : 'income'}
                      size="sm"
                      icon={isBorrowed ? ArrowDownLeft : ArrowUpRight}
                      onClick={() => onRepaid?.(loan)}
                    >
                      {isBorrowed ? 'Repay' : 'Collect'}
                    </Button>
                  )}
                </div>

                {/* Expanded Repayment History Drawer */}
                {isExpanded && loan.repayments && loan.repayments.length > 0 && (
                  <div className="wf-loan-history-drawer">
                    <div className="wf-loan-history-title">
                      {`Repayment History (${loan.repayments.length})`}
                    </div>
                    {loan.repayments.map((r, idx) => (
                      <div key={r.id || idx} className="wf-loan-history-item">
                        <span>
                          {formatDate(r.date)} {r.note ? `— ${r.note}` : ''}
                        </span>
                        <strong style={{ color: 'var(--wf-income-600)' }}>
                          {`+₹${formatAmount(r.amount)}`}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
