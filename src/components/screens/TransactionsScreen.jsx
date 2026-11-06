import { useState, useMemo } from 'react'
import {
  Search,
  X,
  Plus,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Filter,
} from 'lucide-react'
import TransactionItem from './TransactionItem'
import { Button, EmptyState } from '../ui'
import { calculateMonthlyBreakdown } from '../../domain/metrics'
import { formatAmount } from '../../domain/money'

export const getMonthName = (date = new Date()) => {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/**
 * Returns formatted group label for date string:
 * 'Today', 'Yesterday', or 'DD MMM YYYY'.
 */
export const getDateGroupLabel = (dateStr) => {
  if (!dateStr) return 'Other'
  const dateOnly = dateStr.slice(0, 10)
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (dateOnly === todayStr) return 'Today'
  if (dateOnly === yesterdayStr) return 'Yesterday'

  const [y, m, d] = dateOnly.split('-').map(Number)
  if (y && m && d) {
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return dateOnly
}

export default function TransactionsScreen({
  transactions = [],
  onNavigate,
  onDeleteTx,
  onEditTx,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  // Current Month Key for overview metrics
  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  // Month Breakdown Metrics
  const monthlyMetrics = useMemo(() => {
    return calculateMonthlyBreakdown(transactions, currentMonthKey)
  }, [transactions, currentMonthKey])

  const monthlyIncome = monthlyMetrics.externalIncome
  const monthlySpent = monthlyMetrics.externalSpent
  const monthlyNet = monthlyIncome - monthlySpent

  // Extract unique categories from current transactions
  const availableCategories = useMemo(() => {
    const cats = new Set()
    for (const t of transactions) {
      if (t.category) {
        cats.add(t.category)
      }
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b))
  }, [transactions])

  // Filtered and Chronologically Sorted Transactions
  const filteredTxs = useMemo(() => {
    let list = Array.isArray(transactions) ? [...transactions] : []

    // 1. Text Search across category, note, amount
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((t) => {
        const cat = (t.category || '').toLowerCase()
        const note = (t.note || '').toLowerCase()
        const amt = String(t.amount || '')
        return cat.includes(q) || note.includes(q) || amt.includes(q)
      })
    }

    // 2. Type Filter
    switch (typeFilter) {
      case 'income':
        list = list.filter(
          (t) =>
            t.type === 'income' ||
            t.type === 'salary' ||
            (t.type === 'add' && t.category !== 'Loan') ||
            t.type === 'loan_collection'
        )
        break
      case 'expenses':
        list = list.filter(
          (t) =>
            t.type === 'spent' ||
            t.type === 'expense' ||
            t.type === 'loan_lend' ||
            t.type === 'loan_repayment'
        )
        break
      case 'savings':
        list = list.filter(
          (t) =>
            t.type === 'savings_deposit' ||
            t.type === 'savings_withdraw' ||
            t.type === 'auto_save'
        )
        break
      case 'loans':
        list = list.filter(
          (t) =>
            t.type === 'loan_borrow' ||
            t.type === 'loan_lend' ||
            t.type === 'loan_repayment' ||
            t.type === 'loan_collection' ||
            (t.type === 'add' && t.category === 'Loan')
        )
        break
      default:
        break
    }

    // 3. Category Filter
    if (categoryFilter !== 'all') {
      list = list.filter(
        (t) => (t.category || '').toLowerCase() === categoryFilter.toLowerCase()
      )
    }

    // 4. Date Range Filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      if (dateFilter === 'this_month') {
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        list = list.filter((t) => t.date && t.date.startsWith(yearMonth))
      } else if (dateFilter === 'last_month') {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const prevYearMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
        list = list.filter((t) => t.date && t.date.startsWith(prevYearMonth))
      } else if (dateFilter === 'last_30_days') {
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(today.getDate() - 30)
        list = list.filter((t) => {
          if (!t.date) return false
          const txDate = new Date(t.date)
          return txDate >= thirtyDaysAgo && txDate <= now
        })
      }
    }

    // Sort chronologically descending (latest date first, then latest createdAt / ID)
    list.sort((a, b) => {
      const dateA = a.date || ''
      const dateB = b.date || ''
      if (dateB !== dateA) {
        return dateB.localeCompare(dateA)
      }
      const createdA = a.createdAt || ''
      const createdB = b.createdAt || ''
      if (createdB && createdA) {
        return createdB.localeCompare(createdA)
      }
      return (b.id || '').localeCompare(a.id || '')
    })

    return list
  }, [transactions, searchQuery, typeFilter, categoryFilter, dateFilter])

  // Group Chronologically Sorted Transactions by Date
  const groupedTxs = useMemo(() => {
    const groups = []
    let currentGroup = null

    for (const tx of filteredTxs) {
      const rawDate = tx.date ? tx.date.slice(0, 10) : 'Undated'

      if (!currentGroup || currentGroup.dateKey !== rawDate) {
        currentGroup = {
          dateKey: rawDate,
          displayTitle: getDateGroupLabel(rawDate),
          items: [],
          daySpent: 0,
          dayEarned: 0,
        }
        groups.push(currentGroup)
      }

      currentGroup.items.push(tx)

      const amt = Number(tx.amount) || 0
      const isIncome =
        tx.type === 'income' ||
        tx.type === 'salary' ||
        (tx.type === 'add' && tx.category !== 'Loan') ||
        tx.type === 'loan_collection'
      const isExpense =
        tx.type === 'spent' ||
        tx.type === 'expense' ||
        tx.type === 'loan_lend' ||
        tx.type === 'loan_repayment'

      if (isIncome) currentGroup.dayEarned += amt
      if (isExpense) currentGroup.daySpent += amt
    }

    return groups
  }, [filteredTxs])

  // Active filter state
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      typeFilter !== 'all' ||
      categoryFilter !== 'all' ||
      dateFilter !== 'all'
  )

  const handleClearFilters = () => {
    setSearchQuery('')
    setTypeFilter('all')
    setCategoryFilter('all')
    setDateFilter('all')
  }

  return (
    <div className="screen wf-tx-screen">
      {/* ── Screen Header ── */}
      <header className="wf-tx-header">
        <div className="wf-tx-header-left">
          <h1 className="wf-tx-title">Transactions</h1>
          <span className="wf-tx-subtitle">
            {transactions.length === 0
              ? 'No transactions yet'
              : `${transactions.length} total recorded transaction${
                  transactions.length === 1 ? '' : 's'
                }`}
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => onNavigate?.('addTx')}
        >
          Add Transaction
        </Button>
      </header>

      {/* ── Summary Overview Grid ── */}
      <section className="wf-tx-overview" aria-label="Monthly overview">
        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">Income ({getMonthName()})</span>
            <div className="wf-stat-icon-wrap income" aria-hidden="true">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="wf-stat-value">{`₹${formatAmount(monthlyIncome)}`}</div>
          <div className="wf-stat-sub">Monthly incoming cash flow</div>
        </div>

        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">Spent ({getMonthName()})</span>
            <div className="wf-stat-icon-wrap expense" aria-hidden="true">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="wf-stat-value">{`₹${formatAmount(monthlySpent)}`}</div>
          <div className="wf-stat-sub">Monthly outgoing expenses</div>
        </div>

        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">Net Cash Flow</span>
            <div
              className={`wf-stat-icon-wrap ${monthlyNet >= 0 ? 'income' : 'expense'}`}
              aria-hidden="true"
            >
              <DollarSign size={16} />
            </div>
          </div>
          <div
            className="wf-stat-value"
            style={{
              color:
                monthlyNet > 0
                  ? 'var(--wf-income-600)'
                  : monthlyNet < 0
                  ? 'var(--wf-expense-600)'
                  : 'var(--wf-text-primary)',
            }}
          >
            {`${monthlyNet >= 0 ? '+' : '-'}₹${formatAmount(Math.abs(monthlyNet))}`}
          </div>
          <div className="wf-stat-sub">
            {monthlyNet >= 0 ? 'Surplus this month' : 'Deficit this month'}
          </div>
        </div>
      </section>

      {/* ── Search & Filter Controls ── */}
      <section className="wf-tx-controls" aria-label="Filter transactions">
        <div className="wf-tx-search-bar">
          <Search size={16} color="var(--wf-text-muted)" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search note, category, or amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search transactions"
          />
          {searchQuery && (
            <button
              type="button"
              className="wf-tx-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search input"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="wf-tx-filter-row">
          {/* Type Filter Pills */}
          <div className="wf-tx-type-pills" role="tablist" aria-label="Filter by type">
            {[
              { id: 'all', label: 'All' },
              { id: 'income', label: 'Income' },
              { id: 'expenses', label: 'Expenses' },
              { id: 'savings', label: 'Savings' },
              { id: 'loans', label: 'Loans' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={typeFilter === tab.id}
                className={`wf-tx-type-pill ${typeFilter === tab.id ? 'active' : ''}`}
                onClick={() => setTypeFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dropdown Filters */}
          <div className="wf-tx-dropdowns">
            {/* Category Dropdown */}
            {availableCategories.length > 0 && (
              <select
                className="wf-tx-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Date Range Dropdown */}
            <select
              className="wf-tx-select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by date range"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_30_days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="wf-tx-active-bar">
            <div className="wf-tx-active-chips">
              <Filter size={13} color="var(--wf-brand-700)" />
              <span>Filters active:</span>
              {searchQuery && (
                <span className="wf-tx-filter-tag">Query: "{searchQuery}"</span>
              )}
              {typeFilter !== 'all' && (
                <span className="wf-tx-filter-tag">Type: {typeFilter}</span>
              )}
              {categoryFilter !== 'all' && (
                <span className="wf-tx-filter-tag">Category: {categoryFilter}</span>
              )}
              {dateFilter !== 'all' && (
                <span className="wf-tx-filter-tag">
                  Date:{' '}
                  {dateFilter === 'this_month'
                    ? 'This Month'
                    : dateFilter === 'last_month'
                    ? 'Last Month'
                    : 'Last 30 Days'}
                </span>
              )}
            </div>
            <button
              type="button"
              className="wf-tx-clear-btn"
              onClick={handleClearFilters}
              aria-label="Clear all active filters"
            >
              Reset all
            </button>
          </div>
        )}
      </section>

      {/* ── Transaction Content ── */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Start tracking your financial transactions, income, and expenses."
          action={
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => onNavigate?.('addTx')}
            >
              Add First Transaction
            </Button>
          }
        />
      ) : filteredTxs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching transactions"
          description="No transactions match your current search and filter criteria."
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
        <div className="wf-tx-groups-container">
          {groupedTxs.map((group) => (
            <div key={group.dateKey} className="wf-tx-date-group">
              <div className="wf-tx-date-header">
                <div className="wf-tx-date-left">
                  <span className="wf-tx-date-title">{group.displayTitle}</span>
                  <span className="wf-tx-date-count">
                    {group.items.length}{' '}
                    {group.items.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {(group.daySpent > 0 || group.dayEarned > 0) && (
                  <span className="wf-tx-date-total">
                    {group.dayEarned > 0 && (
                      <span style={{ color: 'var(--wf-income-600)', marginRight: 6 }}>
                        {`+₹${formatAmount(group.dayEarned)}`}
                      </span>
                    )}
                    {group.daySpent > 0 && (
                      <span style={{ color: 'var(--wf-expense-600)' }}>
                        {`-₹${formatAmount(group.daySpent)}`}
                      </span>
                    )}
                  </span>
                )}
              </div>

              <div className="tx-list">
                {group.items.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    tx={tx}
                    showDate={Boolean(tx.createdAt)}
                    onDelete={onDeleteTx}
                    onEdit={onEditTx}
                    showDelete
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
