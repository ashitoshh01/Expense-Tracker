import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Helpers ────────────────────────────────────────────────
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatAmount = (n) => {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?')

const todayStr = () => {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

const currentYearMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── localStorage persistence ───────────────────────────────
const KEYS = {
  balance: 'et_balance',
  savings: 'et_savings',
  loans: 'et_loans',
  transactions: 'et_transactions',
  lastSalaryMonth: 'et_lastSalaryMonth',
}

const loadState = () => ({
  balance: Number(localStorage.getItem(KEYS.balance)) || 0,
  savings: Number(localStorage.getItem(KEYS.savings)) || 0,
  loans: JSON.parse(localStorage.getItem(KEYS.loans) || '[]'),
  transactions: JSON.parse(localStorage.getItem(KEYS.transactions) || '[]'),
  lastSalaryMonth: localStorage.getItem(KEYS.lastSalaryMonth) || '',
})

const persist = (key, value) => {
  if (typeof value === 'object') {
    localStorage.setItem(KEYS[key], JSON.stringify(value))
  } else {
    localStorage.setItem(KEYS[key], String(value))
  }
}

// ─── Spend categories ───────────────────────────────────────
const SPEND_CATEGORIES = [
  'Outside Food',
  'Material from me/friend',
  'Give friend money',
  'Other',
]

const CATEGORY_ICONS = {
  'Loan': '🤝',
  'Salary': '💰',
  'Savings': '🏦',
  'Outside Food': '🍔',
  'Material from me/friend': '🛒',
  'Give friend money': '💸',
  'Other': '📝',
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [state, setState] = useState(loadState)
  const [modal, setModal] = useState(null) // 'add' | 'spent' | 'withdraw' | null
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const toastTimer = useRef(null)

  // ─── Sync state → localStorage ──────────────────────────────
  const updateState = useCallback((updates) => {
    setState((prev) => {
      const next = { ...prev, ...updates }
      Object.keys(updates).forEach((k) => persist(k, next[k]))
      return next
    })
  }, [])

  // ─── Auto salary logic ──────────────────────────────────────
  useEffect(() => {
    const today = new Date()
    const cm = currentYearMonth()
    if (today.getDate() >= 5 && state.lastSalaryMonth !== cm) {
      const salaryTx = {
        id: genId(),
        type: 'salary',
        category: 'Salary',
        amount: 2000,
        note: '',
        date: todayStr(),
      }
      const savingsTx = {
        id: genId(),
        type: 'auto_save',
        category: 'Savings',
        amount: 500,
        note: 'Auto-saved from salary',
        date: todayStr(),
      }
      const newTransactions = [savingsTx, salaryTx, ...state.transactions]
      updateState({
        balance: state.balance + 2000 - 500,
        savings: state.savings + 500,
        transactions: newTransactions,
        lastSalaryMonth: cm,
      })
      showToast('💰 Salary ₹2,000 credited! ₹500 moved to savings.', 'salary')
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Toast ──────────────────────────────────────────────────
  const showToast = (msg, variant = '') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, variant })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  // ─── Add Amount (Loan) ─────────────────────────────────────
  const handleAdd = ({ amount, from }) => {
    const amt = Number(amount)
    const loan = { id: genId(), name: from, amount: amt, date: todayStr() }
    const tx = {
      id: genId(),
      type: 'add',
      category: 'Loan',
      amount: amt,
      note: from,
      date: todayStr(),
    }
    updateState({
      balance: state.balance + amt,
      loans: [loan, ...state.loans],
      transactions: [tx, ...state.transactions],
    })
    setModal(null)
    showToast(`+₹${formatAmount(amt)} added from ${from}`)
  }

  // ─── Spent ─────────────────────────────────────────────────
  const handleSpent = ({ amount, category, note }) => {
    const amt = Number(amount)
    const tx = {
      id: genId(),
      type: 'spent',
      category,
      amount: amt,
      note: note || '',
      date: todayStr(),
    }
    updateState({
      balance: state.balance - amt,
      transactions: [tx, ...state.transactions],
    })
    setModal(null)
    showToast(`-₹${formatAmount(amt)} spent on ${category}`)
  }

  // ─── Mark loan as repaid ────────────────────────────────────
  const handleRepaid = (loanId) => {
    const loan = state.loans.find((l) => l.id === loanId)
    if (!loan) return
    setConfirm({
      title: 'Mark as Repaid?',
      message: `Remove loan of ₹${formatAmount(loan.amount)} from ${loan.name}?`,
      variant: 'blue',
      onConfirm: () => {
        updateState({
          loans: state.loans.filter((l) => l.id !== loanId),
        })
        setConfirm(null)
        showToast(`Loan from ${loan.name} marked as repaid ✓`)
      },
    })
  }

  // ─── Delete transaction ─────────────────────────────────────
  const handleDeleteTx = (txId) => {
    const tx = state.transactions.find((t) => t.id === txId)
    if (!tx) return
    setConfirm({
      title: 'Delete Transaction?',
      message: `This will remove this ${tx.category} entry of ₹${formatAmount(tx.amount)}. Your balance will NOT be adjusted.`,
      variant: '',
      onConfirm: () => {
        updateState({
          transactions: state.transactions.filter((t) => t.id !== txId),
        })
        setConfirm(null)
        showToast('Transaction deleted')
      },
    })
  }

  // ─── Withdraw from savings ──────────────────────────────────
  const handleWithdraw = ({ amount }) => {
    const amt = Number(amount)
    if (amt > state.savings) {
      showToast('Cannot withdraw more than savings balance')
      return
    }
    updateState({
      balance: state.balance + amt,
      savings: state.savings - amt,
    })
    setModal(null)
    showToast(`₹${formatAmount(amt)} withdrawn from savings`)
  }

  // ─── Export ─────────────────────────────────────────────────
  const exportCSV = () => {
    if (state.transactions.length === 0) {
      showToast('No transactions to export')
      return
    }
    const headers = 'Date,Type,Category,Amount,Note\n'
    const rows = state.transactions
      .map((t) => `${t.date},${t.type},${t.category},${t.amount},"${t.note || ''}"`)
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${todayStr()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV exported ✓')
  }

  const exportJSON = () => {
    if (state.transactions.length === 0) {
      showToast('No transactions to export')
      return
    }
    const data = {
      balance: state.balance,
      savings: state.savings,
      loans: state.loans,
      transactions: state.transactions,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('JSON exported ✓')
  }

  // ─── Monthly summary ───────────────────────────────────────
  const cm = currentYearMonth()
  const monthlyTxs = state.transactions.filter((t) => t.date.startsWith(cm))
  const monthlySpent = monthlyTxs
    .filter((t) => t.type === 'spent')
    .reduce((sum, t) => sum + t.amount, 0)
  const monthlyEarned = monthlyTxs
    .filter((t) => t.type === 'add' || t.type === 'salary')
    .reduce((sum, t) => sum + t.amount, 0)

  // Category breakdown
  const categoryBreakdown = {}
  monthlyTxs
    .filter((t) => t.type === 'spent')
    .forEach((t) => {
      categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount
    })

  // ─── Render ─────────────────────────────────────────────────
  return (
    <>
      {/* ── Header ── */}
      <header className="header">
        <div className="header-icon">₹</div>
        <div>
          <h1>Expense Tracker</h1>
          <div className="header-subtitle">Personal finance manager</div>
        </div>
      </header>

      {/* ── Balance Card ── */}
      <div className="balance-card">
        <div className="balance-label">Available Balance</div>
        <div className={`balance-amount ${state.balance < 0 ? 'negative' : ''}`}>
          <span className="balance-rupee">₹</span>
          {formatAmount(Math.abs(state.balance))}
          {state.balance < 0 && <span style={{ fontSize: '20px', marginLeft: '4px' }}>⚠️</span>}
        </div>
        <div className="balance-date">{formatDate(todayStr())}</div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="action-buttons">
        <button className="btn-action btn-add" id="btn-add-amount" onClick={() => setModal('add')}>
          <span className="btn-icon">+</span>
          Add Amount
        </button>
        <button className="btn-action btn-spent" id="btn-spent" onClick={() => setModal('spent')}>
          <span className="btn-icon">−</span>
          Spent
        </button>
      </div>

      {/* ── Savings Card ── */}
      <div className="savings-card">
        <div className="savings-icon">🏦</div>
        <div className="savings-info">
          <div className="savings-label">Total Savings</div>
          <div className="savings-amount">
            <span className="savings-rupee">₹</span>
            {formatAmount(state.savings)}
          </div>
        </div>
        {state.savings > 0 && (
          <button className="savings-withdraw-btn" onClick={() => setModal('withdraw')}>
            Withdraw
          </button>
        )}
      </div>

      {/* ── Monthly Summary ── */}
      {monthlyTxs.length > 0 && (
        <div className="summary-card">
          <div className="summary-title">
            📊 This Month
          </div>
          <div className="summary-grid">
            <div className="summary-item">
              <div className="summary-item-label">Earned</div>
              <div className="summary-item-value green">₹{formatAmount(monthlyEarned)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-item-label">Spent</div>
              <div className="summary-item-value red">₹{formatAmount(monthlySpent)}</div>
            </div>
            {Object.entries(categoryBreakdown).map(([cat, amt]) => (
              <div className="summary-item" key={cat}>
                <div className="summary-item-label">{cat}</div>
                <div className="summary-item-value red">₹{formatAmount(amt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loans ── */}
      <div className="section-header">
        <div className="section-title">
          🤝 Loans
          {state.loans.length > 0 && (
            <span className="section-badge">{state.loans.length}</span>
          )}
        </div>
      </div>
      <div className="loans-list">
        {state.loans.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div>No active loans</div>
          </div>
        ) : (
          state.loans.map((loan) => (
            <div className="loan-item" key={loan.id}>
              <div className="loan-avatar">{getInitial(loan.name)}</div>
              <div className="loan-info">
                <div className="loan-name">{loan.name}</div>
                <div className="loan-date">{formatDate(loan.date)}</div>
              </div>
              <div className="loan-amount">₹{formatAmount(loan.amount)}</div>
              <button
                className="loan-repaid-btn"
                onClick={() => handleRepaid(loan.id)}
              >
                Repaid
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── Transaction History ── */}
      <div className="section-header">
        <div className="section-title">
          📒 Transactions
          {state.transactions.length > 0 && (
            <span className="section-badge">{state.transactions.length}</span>
          )}
        </div>
      </div>

      {/* ── Export buttons ── */}
      {state.transactions.length > 0 && (
        <div className="export-section">
          <button className="btn-export" onClick={exportCSV}>
            📄 Export CSV
          </button>
          <button className="btn-export" onClick={exportJSON}>
            📋 Export JSON
          </button>
        </div>
      )}

      <div className="transactions-list">
        {state.transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div>No transactions yet</div>
          </div>
        ) : (
          state.transactions.map((tx) => (
            <div className="tx-item" key={tx.id}>
              <div className={`tx-icon-wrap ${tx.type === 'add' ? 'add' : tx.type === 'spent' ? 'spent' : tx.type === 'salary' ? 'salary' : 'savings'}`}>
                {CATEGORY_ICONS[tx.category] || '📝'}
              </div>
              <div className="tx-info">
                <div className="tx-category">
                  {tx.category}
                  {tx.note ? ` — ${tx.note}` : ''}
                </div>
                <div className="tx-meta">
                  <span>{formatDate(tx.date)}</span>
                  <span className="tx-meta-dot" />
                  <span>{tx.type === 'add' ? 'Added' : tx.type === 'spent' ? 'Spent' : tx.type === 'salary' ? 'Salary' : 'Auto Save'}</span>
                </div>
              </div>
              <div className={`tx-amount ${tx.type === 'spent' ? 'negative' : tx.type === 'auto_save' ? 'neutral' : 'positive'}`}>
                {tx.type === 'spent' || tx.type === 'auto_save' ? '−' : '+'}₹{formatAmount(tx.amount)}
              </div>
              <button
                className="tx-delete-btn"
                title="Delete transaction"
                onClick={() => handleDeleteTx(tx.id)}
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── Modals ── */}
      <div className={`overlay ${modal ? 'active' : ''}`} onClick={() => setModal(null)} />

      {modal === 'add' && <AddSheet onSubmit={handleAdd} onClose={() => setModal(null)} />}
      {modal === 'spent' && <SpentSheet onSubmit={handleSpent} onClose={() => setModal(null)} />}
      {modal === 'withdraw' && (
        <WithdrawSheet
          maxAmount={state.savings}
          onSubmit={handleWithdraw}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Confirm Dialog ── */}
      <div className={`overlay ${confirm ? 'active' : ''}`} onClick={() => setConfirm(null)} />
      {confirm && (
        <div className="confirm-dialog active">
          <h3>{confirm.title}</h3>
          <p>{confirm.message}</p>
          <div className="confirm-actions">
            <button className="confirm-cancel" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className={`confirm-ok ${confirm.variant || ''}`}
              onClick={confirm.onConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      <div className={`toast ${toast ? 'show' : ''} ${toast?.variant || ''}`}>
        {toast?.msg}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADD AMOUNT (LOAN) BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function AddSheet({ onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    if (!from.trim()) e.from = 'Enter the person\'s name'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) onSubmit({ amount, from: from.trim() })
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">💰 Add Amount</div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="add-amount">Amount (₹)</label>
          <input
            ref={amountRef}
            id="add-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="e.g. 500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && <div className="form-error">⚠ {errors.amount}</div>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="add-from">From (person's name)</label>
          <input
            id="add-from"
            className={`form-input ${errors.from ? 'error' : ''}`}
            type="text"
            placeholder="e.g. Rahul"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          {errors.from && <div className="form-error">⚠ {errors.from}</div>}
        </div>
        <button className="btn-submit green" type="submit">
          Add ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SPENT BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function SpentSheet({ onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(SPEND_CATEGORIES[0])
  const [otherText, setOtherText] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    if (category === 'Other' && !otherText.trim()) e.other = 'Describe where you spent this'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) {
      onSubmit({
        amount,
        category,
        note: category === 'Other' ? otherText.trim() : '',
      })
    }
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">💸 Record Spending</div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="spent-amount">Amount (₹)</label>
          <input
            ref={amountRef}
            id="spent-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="e.g. 120"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && <div className="form-error">⚠ {errors.amount}</div>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="spent-category">Category</label>
          <select
            id="spent-category"
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {SPEND_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        {category === 'Other' && (
          <div className="form-group" style={{ animation: 'slideIn 0.25s ease' }}>
            <label className="form-label" htmlFor="spent-other">Where did you spend this?</label>
            <input
              id="spent-other"
              className={`form-input ${errors.other ? 'error' : ''}`}
              type="text"
              placeholder="e.g. Bus ticket"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
            />
            {errors.other && <div className="form-error">⚠ {errors.other}</div>}
          </div>
        )}
        <button className="btn-submit red" type="submit">
          Spend ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// WITHDRAW FROM SAVINGS BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function WithdrawSheet({ maxAmount, onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    else if (amt > maxAmount) e.amount = `Maximum withdrawal: ₹${formatAmount(maxAmount)}`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) onSubmit({ amount })
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">🏦 Withdraw from Savings</div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="withdraw-amount">
            Amount (₹) — Available: ₹{formatAmount(maxAmount)}
          </label>
          <input
            ref={amountRef}
            id="withdraw-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder={`Max ₹${formatAmount(maxAmount)}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && <div className="form-error">⚠ {errors.amount}</div>}
        </div>
        <button className="btn-submit blue" type="submit">
          Withdraw ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}
