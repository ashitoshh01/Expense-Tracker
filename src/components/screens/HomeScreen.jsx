import { useState } from 'react'
import {
  Plus, Minus, Wallet, TrendingUp, TrendingDown, Eye,
  Cloud, CloudCheck, CloudOff, RefreshCw, Calendar, ChevronRight, ExternalLink, Edit2
} from 'lucide-react'
import { formatAmount } from '../../domain/money'
import TransactionItem from './TransactionItem'

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

const getShortMonth = () => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

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
  monthlyEarned,
  monthlySpent,
  balanceChangePercent,
  onNavigate,
  onAddMoney,
  onAddExpense,
  cloudStatus,
  onCloudClick,
  onRetryCloud,
  authUser,
  onUpdateName,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(authUser?.displayName || '')
  const recentTxs = state.transactions.slice(0, 5)

  const greetingName = authUser?.displayName?.trim() || authUser?.email?.split('@')[0] || 'Friend'
  const avatarInitials = authUser?.displayName
    ? authUser.displayName.slice(0, 2).toUpperCase()
    : authUser?.email
    ? authUser.email.slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="screen">
      {/* Header */}
      <div className="mobile-header">
        <div className="header-brand" onClick={() => onNavigate('more')} role="button" aria-label="Wallet FIX">
          <img src="/apple-touch-icon.png" alt="Wallet FIX" className="header-brand-logo" />
          <div className="header-brand-title">
            <span className="brand-name-wallet">Wallet</span>
            <span className="brand-name-fix">FIX</span>
          </div>
        </div>
        <div className="mobile-header-right">
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
          <div className="header-avatar" onClick={() => onNavigate('more')} style={{ cursor: 'pointer' }}>
            {avatarInitials}
          </div>
        </div>
      </div>

      {/* Cloud Firestore Setup Notice if not created in Firebase console */}
      {cloudStatus === 'not_created' && (
        <div className="firestore-setup-banner">
          <div className="setup-banner-top">
            <span className="setup-badge">Action Required</span>
            <span className="setup-badge-sub">Firebase Console</span>
          </div>
          <div className="setup-banner-title">Activate Cloud Firestore Database</div>
          <p className="setup-banner-desc">
            Your Firebase project <strong>expense-b7fcb</strong> is connected, but Cloud Firestore database has not been created yet in the Firebase Console.
          </p>
          <div className="setup-banner-steps">
            <div className="setup-step-row">
              <span className="setup-step-num">1</span>
              <span>Open Firebase Console and click <strong>Create database</strong></span>
            </div>
            <div className="setup-step-row">
              <span className="setup-step-num">2</span>
              <span>Choose <strong>Start in test mode</strong> and click Enable</span>
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

      {/* Greeting */}
      <div className="greeting-section">
        <div className="greeting-sub">{getGreeting()}</div>
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (nameInput.trim() && onUpdateName) {
                onUpdateName(nameInput.trim())
              }
              setEditingName(false)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0 8px' }}
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
                border: '1.5px solid var(--accent)',
                fontSize: '1.2rem',
                fontWeight: 700,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                outline: 'none',
                maxWidth: 200,
              }}
            />
            <button
              type="submit"
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="greeting-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{greetingName} 👋</span>
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
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.7,
                }}
                title="Edit name"
                aria-label="Edit name"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        )}
        <div className="greeting-message">Let's make today a great financial day!</div>
      </div>

      {/* Balance Card */}
      <div className="balance-card">
        <div className="balance-left">
          <div className="balance-label">
            <Eye size={14} />
            Available Balance
          </div>
          <div className={`balance-amount ${state.balance < 0 ? 'negative' : ''}`}>
            <span className="balance-rupee">₹</span>
            {formatAmount(Math.abs(state.balance))}
          </div>
          <div className={`balance-change ${balanceChangePercent.isPositive ? '' : 'negative-change'}`}>
            {balanceChangePercent.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {balanceChangePercent.label} from last month
          </div>
        </div>
        <div className="balance-right">
          <Wallet />
        </div>
      </div>

      {/* Action Cards */}
      <div className="action-cards">
        <button className="action-card income" onClick={onAddMoney}>
          <div className="action-card-icon">
            <Plus />
          </div>
          <div>
            <div className="action-card-title">Add Money</div>
            <div className="action-card-sub">Income / Deposit</div>
          </div>
        </button>
        <button className="action-card expense" onClick={onAddExpense}>
          <div className="action-card-icon">
            <Minus />
          </div>
          <div>
            <div className="action-card-title">Add Expense</div>
            <div className="action-card-sub">Track Spending</div>
          </div>
        </button>
      </div>

      {/* This Month */}
      <MonthlySummary earned={monthlyEarned} spent={monthlySpent} />

      {/* Quick Stats */}
      <div className="quick-stats-section">
        <div className="quick-stats-title">Quick Stats</div>
        <div className="quick-stats-grid">
          <div className="quick-stat-item">
            <div className="quick-stat-label">Total Savings</div>
            <div className="quick-stat-value green">₹{formatAmount(state.savings)}</div>
          </div>
          <div className="quick-stat-item">
            <div className="quick-stat-label">Transactions</div>
            <div className="quick-stat-value accent">{state.transactions.length}</div>
          </div>
          <div className="quick-stat-item">
            <div className="quick-stat-label">Active Loans</div>
            <div className="quick-stat-value">
              {state.loans.filter((l) => l.status !== 'repaid' && l.outstanding > 0).length}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {recentTxs.length > 0 && (
        <div className="recent-section">
          <div className="recent-header">
            <div className="recent-title">Recent Transactions</div>
            <button className="recent-view-all" onClick={() => onNavigate('transactions')}>
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="tx-list">
            {recentTxs.map((tx) => (
              <TransactionItem key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
