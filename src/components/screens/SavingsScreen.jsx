import { useState, useMemo } from 'react'
import { PiggyBank, Target, ChevronRight, Plus, ArrowDownToLine, TrendingUp } from 'lucide-react'
import { formatAmount } from '../../domain/money'
import { calculateMonthlyBreakdown, calculateSavingsGrowth } from '../../domain/metrics'
import TransactionItem from './TransactionItem'

export default function SavingsScreen({ state, savingsTxs, onUpdateGoal, onAddToSavings, onWithdraw, onNavigate }) {
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalValue, setGoalValue] = useState(String(state.savingsGoal || 0))
  const goalPercent = state.savingsGoal > 0 ? Math.min(100, Math.round((state.savings / state.savingsGoal) * 100)) : 0

  // Current & previous month breakdown for honest metrics
  const now = new Date()
  const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const pm = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`

  const currentMonthData = useMemo(() => calculateMonthlyBreakdown(state.transactions, cm), [state.transactions, cm])
  const prevMonthData = useMemo(() => calculateMonthlyBreakdown(state.transactions, pm), [state.transactions, pm])

  const savingsGrowth = useMemo(() => {
    return calculateSavingsGrowth(currentMonthData.savingsDeposited, prevMonthData.savingsDeposited)
  }, [currentMonthData.savingsDeposited, prevMonthData.savingsDeposited])

  const handleSaveGoal = () => {
    const val = Number(goalValue)
    if (!isNaN(val) && val >= 0) {
      onUpdateGoal(val)
      setEditingGoal(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">Savings</h1>
      </div>

      {/* Main Savings Card */}
      <div className="savings-main-card">
        <div className="savings-icon-big">
          <PiggyBank />
        </div>
        <div className="savings-info">
          <div className="savings-label">Total Savings</div>
          <div className="savings-amount-row">
            <div className="savings-amount">₹{formatAmount(state.savings)}</div>
            {state.savings > 0 && (
              <span className={`savings-change ${!savingsGrowth.isPositive ? 'negative-change' : ''}`}>
                {savingsGrowth.label}
              </span>
            )}
          </div>
          <div className="savings-message">
            {currentMonthData.savingsRate > 0
              ? `You saved ${currentMonthData.savingsRate}% of your income this month! 🌱`
              : state.savings > 0
              ? 'Great job! Keep growing your savings 🌱'
              : 'Start saving today!'}
          </div>
        </div>
      </div>

      {/* Savings Goal Card */}
      <div className="savings-goal-card">
        <div className="goal-header">
          <div className="goal-title">
            <Target size={18} />
            Savings Goal
          </div>
          <span className="goal-arrow"><ChevronRight /></span>
        </div>

        <div className="goal-progress-header">
          <div className="goal-amounts">
            ₹{formatAmount(state.savings)} / <span>{state.savingsGoal > 0 ? `₹${formatAmount(state.savingsGoal)}` : '₹0 (No goal set)'}</span>
          </div>
          <div className="goal-percent">{goalPercent}%</div>
        </div>

        <div className="goal-progress-bar">
          <div className="goal-progress-fill" style={{ width: `${goalPercent}%` }} />
        </div>

        <div className="goal-footer">
          <div className="goal-message">
            {state.savingsGoal === 0
              ? 'Set a savings goal to start tracking milestones! 🎯'
              : goalPercent >= 100
              ? 'Goal reached! 🎉'
              : goalPercent >= 50
              ? "You're halfway there!"
              : 'Keep going!'}
          </div>
          {!editingGoal ? (
            <button className="goal-edit-btn" onClick={() => setEditingGoal(true)}>Edit Goal</button>
          ) : null}
        </div>

        {editingGoal && (
          <div className="goal-input-wrap">
            <input
              className="goal-input"
              type="number"
              inputMode="decimal"
              placeholder="Goal amount"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
              autoFocus
            />
            <button className="goal-save-btn" onClick={handleSaveGoal}>Save</button>
            <button className="goal-cancel-btn" onClick={() => setEditingGoal(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Recent Savings Transactions */}
      {savingsTxs.length > 0 && (
        <div className="recent-savings-section">
          <div className="recent-savings-title">Recent Savings Transfers</div>
          <div className="tx-list">
            {savingsTxs.slice(0, 5).map((tx) => (
              <TransactionItem key={tx.id} tx={tx} showDate />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="fab-container">
        <button className="fab-btn" onClick={onAddToSavings}>
          <Plus size={20} />
          Add to Savings
        </button>
      </div>

      {state.savings > 0 && (
        <div className="fab-container" style={{ paddingTop: 0 }}>
          <button
            className="fab-btn"
            style={{ background: 'var(--surface)', color: 'var(--accent)', border: '1.5px solid var(--accent)', boxShadow: 'none' }}
            onClick={onWithdraw}
          >
            <ArrowDownToLine size={20} />
            Withdraw from Savings
          </button>
        </div>
      )}
    </div>
  )
}
