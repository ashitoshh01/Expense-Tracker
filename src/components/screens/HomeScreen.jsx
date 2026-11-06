import { useState, useMemo } from 'react'
import {
  Plus,
  Minus,
  Wallet,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Cloud,
  CloudCheck,
  CloudOff,
  RefreshCw,
  Calendar,
  ChevronRight,
  ExternalLink,
  Edit2,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  Landmark,
  Receipt,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { formatAmount } from '../../domain/money'
import { getCategoryMeta } from '../../domain/categories'
import TransactionItem from './TransactionItem'
import { Card, Button, Badge, SectionHeader, EmptyState } from '../ui'

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const getFormattedDate = () => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getShortMonth = () => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/**
 * Backward-compatible MonthlySummary component
 */
export function MonthlySummary({ earned, spent }) {
  return (
    <div className="month-card">
      <div className="month-card-header">
        <div className="month-card-title">
          <Calendar size={18} />
          This Month
        </div>
        <div className="month-card-period">
          {getShortMonth()} <ChevronRight size={14} />
        </div>
      </div>
      <div className="month-stats">
        <div>
          <div className="month-stat-label">Income</div>
          <div className="month-stat-value income">₹{formatAmount(earned)}</div>
        </div>
        <div>
          <div className="month-stat-label">Expenses</div>
          <div className="month-stat-value expense">₹{formatAmount(spent)}</div>
        </div>
      </div>
      {earned >= spent ? (
        <div className="month-message">
          <TrendingUp />
          You're spending less than you earn! 🎉
        </div>
      ) : (
        <div className="month-message warning">
          <TrendingDown />
          You're spending more than you earn!
        </div>
      )}
    </div>
  )
}

export default function HomeScreen({
  state,
  monthlyEarned = 0,
  monthlySpent = 0,
  balanceChangePercent = { label: '0%', isPositive: true },
  onNavigate,
  onAddMoney,
  onAddExpense,
  cloudStatus = 'synced',
  onCloudClick,
  onRetryCloud,
  authUser,
  onUpdateName,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(authUser?.displayName || '')
  const [showBalance, setShowBalance] = useState(() => {
    try {
      return localStorage.getItem('wf_show_balance') !== 'false'
    } catch {
      return true
    }
  })

  const toggleShowBalance = () => {
    setShowBalance((prev) => {
      const next = !prev
      try {
        localStorage.setItem('wf_show_balance', String(next))
      } catch {}
      return next
    })
  }

  const transactions = state?.transactions || []
  const recentTxs = transactions.slice(0, 5)

  const greetingName =
    authUser?.displayName?.trim() || authUser?.email?.split('@')[0] || 'Friend'

  const avatarInitials = authUser?.displayName
    ? authUser.displayName.slice(0, 2).toUpperCase()
    : authUser?.email
    ? authUser.email.slice(0, 2).toUpperCase()
    : 'U'

  // Current Month category-wise spending
  const currentMonthPrefix = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const categorySpending = useMemo(() => {
    if (!transactions.length) return []

    const monthExpenses = transactions.filter(
      (t) =>
        t.date &&
        t.date.startsWith(currentMonthPrefix) &&
        (t.type === 'spent' || t.type === 'expense')
    )

    if (monthExpenses.length === 0) return []

    const map = {}
    let total = 0

    for (const t of monthExpenses) {
      const amt = Number(t.amount) || 0
      if (amt <= 0) continue
      const cat = t.category || 'Other'
      map[cat] = (map[cat] || 0) + amt
      total += amt
    }

    if (total <= 0) return []

    return Object.entries(map)
      .map(([category, amount]) => {
        const meta = getCategoryMeta(category)
        return {
          category,
          amount,
          percentage: Math.round((amount / total) * 100),
          color: meta.color || '#6366F1',
          icon: meta.icon,
        }
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4)
  }, [transactions, currentMonthPrefix])

  // Active loans metric
  const activeLoans = useMemo(() => {
    const loans = state?.loans || []
    return loans.filter((l) => l.status !== 'repaid' && Number(l.outstanding) > 0)
  }, [state?.loans])

  const totalOutstandingDebt = useMemo(() => {
    return activeLoans
      .filter((l) => l.type !== 'lent')
      .reduce((sum, l) => sum + (Number(l.outstanding) || 0), 0)
  }, [activeLoans])

  // Net monthly cash flow
  const netCashFlow = monthlyEarned - monthlySpent
  const isSpendingHealthy = monthlyEarned >= monthlySpent

  return (
    <div className="screen wf-dashboard">
      {/* ── Top Header ── */}
      <header className="wf-dash-top">
        <div className="wf-dash-greeting-wrap">
          <span className="wf-dash-date">{getFormattedDate()}</span>
          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (nameInput.trim() && onUpdateName) {
                  onUpdateName(nameInput.trim())
                }
                setEditingName(false)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0' }}
            >
              <input
                type="text"
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1.5px solid var(--wf-brand-500)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  background: 'var(--wf-surface)',
                  color: 'var(--wf-text-primary)',
                  outline: 'none',
                  maxWidth: 180,
                }}
              />
              <Button type="submit" size="sm" variant="primary">
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditingName(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <h1 className="wf-dash-title">
              <span>
                {getGreeting()}, {greetingName} 👋
              </span>
              {onUpdateName && (
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(authUser?.displayName || '')
                    setEditingName(true)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    color: 'var(--wf-text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    opacity: 0.7,
                  }}
                  title="Edit display name"
                  aria-label="Edit display name"
                >
                  <Edit2 size={15} />
                </button>
              )}
            </h1>
          )}
        </div>

        <div className="wf-dash-actions">
          {/* Cloud Sync Status */}
          <button
            className={`cloud-badge ${cloudStatus || 'synced'}`}
            onClick={onCloudClick}
            aria-label={`Database status: ${cloudStatus}`}
            title={`Firebase Database: ${
              cloudStatus === 'synced'
                ? 'Auto-synced with Cloud Firestore'
                : cloudStatus === 'saving'
                ? 'Auto-saving to Firestore...'
                : cloudStatus === 'connecting'
                ? 'Connecting to cloud...'
                : cloudStatus === 'offline'
                ? 'Offline / Changes Queued'
                : cloudStatus === 'permission_denied'
                ? 'Firestore Rules: Action Required in Firebase Console'
                : 'Connection Notice'
            }`}
          >
            {cloudStatus === 'synced' && <CloudCheck size={16} />}
            {cloudStatus === 'saving' && <RefreshCw size={14} className="spin-icon" />}
            {cloudStatus === 'connecting' && <Cloud size={16} />}
            {cloudStatus === 'offline' && <CloudOff size={16} />}
            {cloudStatus === 'not_created' && <CloudOff size={16} />}
            {cloudStatus === 'permission_denied' && <CloudOff size={16} />}
            {cloudStatus === 'error' && <CloudOff size={16} />}
          </button>

          {/* Profile Avatar Shortcut */}
          <div
            className="header-avatar"
            onClick={() => onNavigate('more')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigate('more')}
            aria-label="Account profile and settings"
            style={{ cursor: 'pointer' }}
          >
            {avatarInitials}
          </div>
        </div>
      </header>

      {/* Cloud Firestore Setup Notice if not created in Firebase console */}
      {cloudStatus === 'not_created' && (
        <div className="firestore-setup-banner">
          <div className="setup-banner-top">
            <span className="setup-badge">Action Required</span>
            <span className="setup-badge-sub">Firebase Console</span>
          </div>
          <div className="setup-banner-title">Activate Cloud Firestore Database</div>
          <p className="setup-banner-desc">
            Your Firebase project <strong>expense-b7fcb</strong> is connected, but Cloud Firestore
            database has not been created yet in the Firebase Console.
          </p>
          <div className="setup-banner-steps">
            <div className="setup-step-row">
              <span className="setup-step-num">1</span>
              <span>
                Open Firebase Console and click <strong>Create database</strong>
              </span>
            </div>
            <div className="setup-step-row">
              <span className="setup-step-num">2</span>
              <span>
                Choose <strong>Start in test mode</strong> and click Enable
              </span>
            </div>
          </div>
          <div className="setup-banner-buttons">
            <a
              href="https://console.firebase.google.com/project/expense-b7fcb/firestore"
              target="_blank"
              rel="noopener noreferrer"
              className="setup-action-link"
            >
              Open Firebase Console <ExternalLink size={14} />
            </a>
            <button className="setup-action-retry" onClick={onRetryCloud}>
              <RefreshCw size={14} /> Test Connection
            </button>
          </div>
        </div>
      )}

      {/* ── Primary Balance Hero ── */}
      <Card variant="default" className="wf-hero-card">
        <div className="wf-hero-top">
          <div className="wf-hero-label">
            <Wallet size={16} aria-hidden="true" />
            <span>Available Balance</span>
          </div>

          <button
            type="button"
            className="wf-hero-eye-btn"
            onClick={toggleShowBalance}
            aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            title={showBalance ? 'Hide balance' : 'Show balance'}
          >
            {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showBalance ? 'Hide' : 'Show'}</span>
          </button>
        </div>

        <div className="wf-hero-amount-row">
          <div
            className={`wf-hero-amount ${state?.balance < 0 ? 'negative' : ''}`}
            aria-label={`Available Balance: ₹${formatAmount(state?.balance || 0)}`}
          >
            <span className="wf-hero-rupee">₹</span>
            {showBalance ? formatAmount(Math.abs(state?.balance || 0)) : '••••••'}
          </div>

          <Badge
            variant={balanceChangePercent.isPositive ? 'income' : 'expense'}
            size="md"
            icon={balanceChangePercent.isPositive ? TrendingUp : TrendingDown}
          >
            {balanceChangePercent.label} vs last month
          </Badge>
        </div>

        {/* Dual Cash Flow Snapshot */}
        <div className="wf-hero-cashflow-pills">
          <div className="wf-hero-cashflow-item">
            <span className="wf-hero-cashflow-label">Earned ({getShortMonth()})</span>
            <span className="wf-hero-cashflow-val income">
              {showBalance ? `+₹${formatAmount(monthlyEarned)}` : '••••••'}
            </span>
          </div>
          <div className="wf-hero-cashflow-item">
            <span className="wf-hero-cashflow-label">Spent ({getShortMonth()})</span>
            <span className="wf-hero-cashflow-val expense">
              {showBalance ? `-₹${formatAmount(monthlySpent)}` : '••••••'}
            </span>
          </div>
          <div className="wf-hero-cashflow-item">
            <span className="wf-hero-cashflow-label">Net Cash Flow</span>
            <span
              className={`wf-hero-cashflow-val ${
                netCashFlow >= 0 ? 'income' : 'expense'
              }`}
            >
              {showBalance
                ? `${netCashFlow >= 0 ? '+' : '-'}₹${formatAmount(Math.abs(netCashFlow))}`
                : '••••••'}
            </span>
          </div>
        </div>

        {/* Quick Action Button Duo */}
        <div className="wf-hero-btn-row">
          <Button
            variant="income"
            size="md"
            icon={Plus}
            onClick={onAddMoney}
            fullWidth
          >
            Add Income
          </Button>
          <Button
            variant="danger"
            size="md"
            icon={Minus}
            onClick={onAddExpense}
            fullWidth
          >
            Add Expense
          </Button>
        </div>
      </Card>

      {/* ── Financial Overview Grid ── */}
      <section className="wf-overview-grid" aria-label="Financial summary">
        {/* Monthly Income Card */}
        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">Income</span>
            <div className="wf-stat-icon-wrap income" aria-hidden="true">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="wf-stat-value">
            {showBalance ? `₹${formatAmount(monthlyEarned)}` : '••••••'}
          </div>
          <div className="wf-stat-sub">This month's earnings</div>
        </div>

        {/* Monthly Expenses Card */}
        <div className="wf-stat-card">
          <div className="wf-stat-top">
            <span className="wf-stat-label">Expenses</span>
            <div className="wf-stat-icon-wrap expense" aria-hidden="true">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="wf-stat-value">
            {showBalance ? `₹${formatAmount(monthlySpent)}` : '••••••'}
          </div>
          <div className="wf-stat-sub">This month's spend</div>
        </div>

        {/* Total Savings Card */}
        <div
          className="wf-stat-card interactive"
          onClick={() => onNavigate('savings')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigate('savings')}
          aria-label="View Savings Vault"
        >
          <div className="wf-stat-top">
            <span className="wf-stat-label">Savings</span>
            <div className="wf-stat-icon-wrap savings" aria-hidden="true">
              <PiggyBank size={16} />
            </div>
          </div>
          <div className="wf-stat-value">
            {showBalance ? `₹${formatAmount(state?.savings || 0)}` : '••••••'}
          </div>
          <div className="wf-stat-sub">
            {state?.savingsGoal > 0 ? (
              <span>
                {Math.min(
                  100,
                  Math.round(((state?.savings || 0) / state.savingsGoal) * 100)
                )}
                % of goal
              </span>
            ) : (
              <span>In savings vault</span>
            )}
            <ChevronRight size={12} />
          </div>
        </div>

        {/* Active Debt / Loans Card */}
        <div
          className="wf-stat-card interactive"
          onClick={() => onNavigate('loans')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onNavigate('loans')}
          aria-label="View Loans and Debt"
        >
          <div className="wf-stat-top">
            <span className="wf-stat-label">Active Loans</span>
            <div className="wf-stat-icon-wrap neutral" aria-hidden="true">
              <Landmark size={16} />
            </div>
          </div>
          <div className="wf-stat-value">
            {activeLoans.length > 0
              ? `${activeLoans.length} active`
              : 'Zero debt 🎉'}
          </div>
          <div className="wf-stat-sub">
            {totalOutstandingDebt > 0 ? (
              <span>₹{formatAmount(totalOutstandingDebt)} borrowed</span>
            ) : (
              <span>All clear</span>
            )}
            <ChevronRight size={12} />
          </div>
        </div>
      </section>

      {/* ── Split Section: Recent Activity + Category Spending ── */}
      <div className="wf-dash-split">
        {/* Left Column: Recent Transactions */}
        <section aria-label="Recent Transactions">
          <SectionHeader
            title="Recent Transactions"
            action={
              recentTxs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconRight={ChevronRight}
                  onClick={() => onNavigate('transactions')}
                >
                  View All
                </Button>
              )
            }
          />

          {recentTxs.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Start tracking your finances by recording your first income or expense."
              action={
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="income" size="sm" onClick={onAddMoney}>
                    Add Income
                  </Button>
                  <Button variant="danger" size="sm" onClick={onAddExpense}>
                    Add Expense
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="tx-list">
              {recentTxs.map((tx) => (
                <TransactionItem key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Spending Health & Top Categories */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Spending Health Indicator */}
          <div
            className={`wf-health-banner ${
              isSpendingHealthy ? 'success' : 'warning'
            }`}
          >
            {isSpendingHealthy ? (
              <>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>You're spending less than you earn this month! 🎉</span>
              </>
            ) : (
              <>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>You're currently spending more than you earn!</span>
              </>
            )}
          </div>

          {/* Top Spending Categories */}
          {categorySpending.length > 0 && (
            <Card variant="default" padding="md">
              <SectionHeader
                title={`Top Spending (${getShortMonth()})`}
                description="Where your money went this month"
              />

              <div className="wf-cat-breakdown">
                {categorySpending.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <div key={cat.category} className="wf-cat-item">
                      <div className="wf-cat-item-top">
                        <div className="wf-cat-item-left">
                          <span
                            className="wf-cat-item-icon"
                            style={{
                              background: `${cat.color}18`,
                              color: cat.color,
                            }}
                          >
                            <Icon size={14} />
                          </span>
                          <span>{cat.category}</span>
                        </div>
                        <div className="wf-cat-item-right">
                          <span className="wf-cat-amount">
                            ₹{formatAmount(cat.amount)}
                          </span>
                          <span className="wf-cat-pct">({cat.percentage}%)</span>
                        </div>
                      </div>

                      <div className="wf-cat-track" aria-hidden="true">
                        <div
                          className="wf-cat-bar"
                          style={{
                            width: `${cat.percentage}%`,
                            background: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}
