import { useState, useMemo } from 'react'
import {
  PiggyBank,
  Target,
  Plus,
  ArrowDownToLine,
  TrendingUp,
  Wallet,
  Eye,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Percent,
} from 'lucide-react'
import { formatAmount } from '../../domain/money'
import {
  calculateMonthlyBreakdown,
  calculateSavingsGrowth,
} from '../../domain/metrics'
import TransactionItem from './TransactionItem'
import { Button, Badge, SectionHeader, EmptyState, Input } from '../ui'

export default function SavingsScreen({
  state,
  savingsTxs = [],
  onUpdateGoal,
  onAddToSavings,
  onWithdraw,
  onNavigate,
}) {
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalValue, setGoalValue] = useState(String(state?.savingsGoal || 0))
  const [goalError, setGoalError] = useState('')

  // Persistent balance visibility toggle matching Dashboard
  const [showBalance, setShowBalance] = useState(() => {
    try {
      const stored = localStorage.getItem('wf_show_balance')
      return stored !== null ? JSON.parse(stored) : true
    } catch {
      return true
    }
  })

  const toggleShowBalance = () => {
    setShowBalance((prev) => {
      const next = !prev
      try {
        localStorage.setItem('wf_show_balance', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  // Savings Goal calculations
  const savingsBalance = state?.savings || 0
  const savingsGoal = state?.savingsGoal || 0
  const goalPercent =
    savingsGoal > 0
      ? Math.min(100, Math.round((savingsBalance / savingsGoal) * 100))
      : 0
  const remainingToGoal = savingsGoal > savingsBalance ? savingsGoal - savingsBalance : 0

  // Current & previous month breakdown for honest financial metrics
  const now = new Date()
  const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const pm = `${prevMonthDate.getFullYear()}-${String(
    prevMonthDate.getMonth() + 1
  ).padStart(2, '0')}`

  const currentMonthData = useMemo(
    () => calculateMonthlyBreakdown(state?.transactions || [], cm),
    [state?.transactions, cm]
  )
  const prevMonthData = useMemo(
    () => calculateMonthlyBreakdown(state?.transactions || [], pm),
    [state?.transactions, pm]
  )

  const savingsGrowth = useMemo(() => {
    return calculateSavingsGrowth(
      currentMonthData.savingsDeposited,
      prevMonthData.savingsDeposited
    )
  }, [currentMonthData.savingsDeposited, prevMonthData.savingsDeposited])

  const handleSaveGoal = (e) => {
    e?.preventDefault()
    const val = Number(goalValue)
    if (isNaN(val) || val < 0) {
      setGoalError('Please enter a valid target goal amount')
      return
    }
    setGoalError('')
    onUpdateGoal?.(val)
    setEditingGoal(false)
  }

  return (
    <div className="screen wf-savings-screen">
      {/* ── Screen Header ── */}
      <header className="wf-savings-header">
        <div className="wf-savings-header-left">
          <h1 className="wf-savings-title">Savings Vault</h1>
          <span className="wf-savings-subtitle">
            Secure reserve funds & financial milestone tracking
          </span>
        </div>
      </header>

      {/* ── Responsive 2-Column Split Layout ── */}
      <div className="wf-savings-split">
        {/* Left Column: Hero Balance & Target Goal */}
        <div className="wf-savings-col">
          {/* Main Savings Hero Card */}
          <div className="wf-savings-hero">
            <div className="wf-savings-hero-top">
              <div className="wf-savings-hero-label-wrap">
                <div className="wf-savings-icon-wrap" aria-hidden="true">
                  <PiggyBank size={22} />
                </div>
                <div>
                  <div className="wf-savings-hero-label">Total Vault Balance</div>
                  <div className="wf-stat-sub">Reserved capital</div>
                </div>
              </div>

              <button
                type="button"
                className="wf-hero-eye-btn"
                onClick={toggleShowBalance}
                aria-label={showBalance ? 'Hide savings balance' : 'Show savings balance'}
                title={showBalance ? 'Hide savings balance' : 'Show savings balance'}
              >
                {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showBalance ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            <div className="wf-savings-hero-amount-row">
              <div
                className="wf-savings-hero-amount"
                aria-label={`Total Savings: ₹${formatAmount(savingsBalance)}`}
              >
                <span className="wf-hero-rupee">₹</span>
                {showBalance ? formatAmount(savingsBalance) : '••••••'}
              </div>

              {savingsGrowth.hasBaseline ? (
                <Badge
                  variant={savingsGrowth.isPositive ? 'income' : 'expense'}
                  size="md"
                  icon={savingsGrowth.isPositive ? TrendingUp : undefined}
                >
                  {savingsGrowth.label}
                </Badge>
              ) : currentMonthData.savingsRate > 0 ? (
                <Badge variant="income" size="md">
                  {`${currentMonthData.savingsRate}% of income saved`}
                </Badge>
              ) : (
                <Badge variant="neutral" size="md">
                  Reserve Vault
                </Badge>
              )}
            </div>

            {/* Liquid Cash Context */}
            <div className="wf-savings-cash-context">
              <Wallet size={15} aria-hidden="true" />
              <span>
                Available Cash for deposit:{' '}
                <strong>{showBalance ? `₹${formatAmount(state?.balance || 0)}` : '••••••'}</strong>
              </span>
            </div>

            {/* Action Buttons Duo */}
            <div className="wf-savings-actions-duo">
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={onAddToSavings}
                fullWidth
              >
                Add to Savings
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={ArrowDownToLine}
                onClick={onWithdraw}
                fullWidth
                disabled={!savingsBalance || savingsBalance <= 0}
              >
                Withdraw
              </Button>
            </div>
          </div>

          {/* Savings Goal Card */}
          <div className="wf-savings-goal-card">
            <div className="wf-goal-top">
              <div className="wf-goal-title-wrap">
                <Target size={18} color="var(--wf-brand-600)" aria-hidden="true" />
                <span>Target Savings Goal</span>
              </div>
              {!editingGoal && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGoalValue(String(state?.savingsGoal || 0))
                    setEditingGoal(true)
                  }}
                >
                  {savingsGoal > 0 ? 'Edit Target' : 'Set Target'}
                </Button>
              )}
            </div>

            {editingGoal ? (
              <form onSubmit={handleSaveGoal} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Input
                  id="target-goal-input"
                  label="Target Goal Amount (₹)"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 100000"
                  value={goalValue}
                  onChange={(e) => {
                    setGoalValue(e.target.value)
                    if (goalError) setGoalError('')
                  }}
                  error={goalError}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingGoal(false)
                      setGoalValue(String(state?.savingsGoal || 0))
                      setGoalError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Save Target
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="wf-goal-progress-header">
                  <div className="wf-goal-amounts">
                    {showBalance ? `₹${formatAmount(savingsBalance)}` : '••••••'}{' '}
                    <span className="wf-goal-target-label">
                      / {savingsGoal > 0 ? (showBalance ? `₹${formatAmount(savingsGoal)}` : '••••••') : 'No target set'}
                    </span>
                  </div>
                  <Badge variant={goalPercent >= 100 ? 'income' : 'brand'} size="sm">
                    {`${goalPercent}%`}
                  </Badge>
                </div>

                <div
                  className="wf-goal-track"
                  role="progressbar"
                  aria-valuenow={goalPercent}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div className="wf-goal-fill" style={{ width: `${goalPercent}%` }} />
                </div>

                <div className="wf-goal-footer">
                  <span className="wf-goal-status">
                    {savingsGoal === 0
                      ? 'Set a milestone target to track your progress'
                      : goalPercent >= 100
                      ? 'Goal achieved! Congratulations 🎉'
                      : goalPercent >= 50
                      ? `Over halfway! ₹${formatAmount(remainingToGoal)} remaining`
                      : `₹${formatAmount(remainingToGoal)} remaining to reach target`}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Monthly Metrics & Recent Vault Activity */}
        <div className="wf-savings-col">
          {/* Monthly Savings Performance (2x2 Grid) */}
          <div className="wf-savings-metrics-grid" aria-label="Monthly savings performance">
            <div className="wf-stat-card">
              <div className="wf-stat-top">
                <span className="wf-stat-label">Deposited</span>
                <div className="wf-stat-icon-wrap income" aria-hidden="true">
                  <ArrowDownLeft size={16} />
                </div>
              </div>
              <div className="wf-stat-value">
                {showBalance ? `+₹${formatAmount(currentMonthData.savingsDeposited)}` : '••••••'}
              </div>
              <div className="wf-stat-sub">Deposits this month</div>
            </div>

            <div className="wf-stat-card">
              <div className="wf-stat-top">
                <span className="wf-stat-label">Withdrawn</span>
                <div className="wf-stat-icon-wrap expense" aria-hidden="true">
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <div className="wf-stat-value">
                {showBalance ? `-₹${formatAmount(currentMonthData.savingsWithdrawn)}` : '••••••'}
              </div>
              <div className="wf-stat-sub">Withdrawals this month</div>
            </div>

            <div className="wf-stat-card">
              <div className="wf-stat-top">
                <span className="wf-stat-label">Net Saved</span>
                <div
                  className={`wf-stat-icon-wrap ${
                    currentMonthData.netSavingsAdded >= 0 ? 'income' : 'expense'
                  }`}
                  aria-hidden="true"
                >
                  <DollarSign size={16} />
                </div>
              </div>
              <div
                className="wf-stat-value"
                style={{
                  color:
                    currentMonthData.netSavingsAdded > 0
                      ? 'var(--wf-income-600)'
                      : currentMonthData.netSavingsAdded < 0
                      ? 'var(--wf-expense-600)'
                      : 'var(--wf-text-primary)',
                }}
              >
                {showBalance
                  ? `${currentMonthData.netSavingsAdded >= 0 ? '+' : '-'}₹${formatAmount(
                      Math.abs(currentMonthData.netSavingsAdded)
                    )}`
                  : '••••••'}
              </div>
              <div className="wf-stat-sub">Net monthly savings change</div>
            </div>

            <div className="wf-stat-card">
              <div className="wf-stat-top">
                <span className="wf-stat-label">Savings Rate</span>
                <div className="wf-stat-icon-wrap savings" aria-hidden="true">
                  <Percent size={15} />
                </div>
              </div>
              <div className="wf-stat-value">{`${currentMonthData.savingsRate}%`}</div>
              <div className="wf-stat-sub">Share of income saved</div>
            </div>
          </div>

          {/* Recent Vault Activity */}
          <div className="wf-savings-activity">
            <SectionHeader
              title="Recent Vault Activity"
              description="Deposits, withdrawals, and automated savings"
              action={
                savingsTxs.length > 0 ? (
                  <button
                    type="button"
                    className="wf-link-btn"
                    onClick={() => onNavigate?.('transactions')}
                    aria-label="View all transactions"
                  >
                    View All →
                  </button>
                ) : null
              }
            />

            {savingsTxs.length === 0 ? (
              <EmptyState
                icon={PiggyBank}
                title="No savings activity yet"
                description="Deposits and withdrawals from your savings vault will appear here."
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={onAddToSavings}
                  >
                    Make First Deposit
                  </Button>
                }
              />
            ) : (
              <div className="tx-list">
                {savingsTxs.slice(0, 5).map((tx) => (
                  <TransactionItem key={tx.id} tx={tx} showDate />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
