import { useState, useRef, useEffect } from 'react'
import { Landmark, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { formatAmount } from '../../domain/money'

export default function AddLoanSheet({ availableBalance, onSubmit, onClose }) {
  const [loanType, setLoanType] = useState('borrowed') // 'borrowed' | 'lent'
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 300)
  }, [])

  const numAmount = Number(amount) || 0

  const validate = () => {
    const e = {}
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      e.amount = 'Enter a valid amount greater than 0'
    } else if (loanType === 'lent' && numAmount > availableBalance) {
      e.amount = `Insufficient balance (₹${formatAmount(availableBalance)}) to lend this amount`
    }
    if (!name.trim()) {
      e.name = "Enter the person's name"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) {
      onSubmit({
        type: loanType,
        amount: numAmount,
        name: name.trim(),
        dueDate,
      })
    }
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Landmark size={24} />
        {loanType === 'borrowed' ? 'Borrow Money' : 'Lend Money'}
      </div>

      {/* Loan Type Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--bg)', padding: 4, borderRadius: 12 }}>
        <button
          type="button"
          onClick={() => setLoanType('borrowed')}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: 'none',
            background: loanType === 'borrowed' ? 'var(--surface)' : 'transparent',
            boxShadow: loanType === 'borrowed' ? 'var(--shadow-sm)' : 'none',
            color: loanType === 'borrowed' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <ArrowDownLeft size={16} /> I Borrowed
        </button>
        <button
          type="button"
          onClick={() => setLoanType('lent')}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: 'none',
            background: loanType === 'lent' ? 'var(--surface)' : 'transparent',
            boxShadow: loanType === 'lent' ? 'var(--shadow-sm)' : 'none',
            color: loanType === 'lent' ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <ArrowUpRight size={16} /> I Lent to Friend
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="loan-amount">
            Amount (₹) {loanType === 'lent' && `— Max available: ₹${formatAmount(availableBalance)}`}
          </label>
          <input
            ref={amountRef}
            id="loan-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && (
            <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="loan-name">
            {loanType === 'borrowed' ? 'From (Person / Source)' : 'To (Friend name)'}
          </label>
          <input
            id="loan-name"
            className={`form-input ${errors.name ? 'error' : ''}`}
            type="text"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && (
            <div className="form-error"><AlertCircle size={14} /> {errors.name}</div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="loan-due-date">Optional Due Date</label>
          <input
            id="loan-due-date"
            className="form-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <button className="btn-submit indigo" type="submit">
          {loanType === 'borrowed' ? 'Add Borrowed' : 'Record Lent'} ₹{numAmount > 0 ? formatAmount(numAmount) : '0'}
        </button>
      </form>
    </div>
  )
}
