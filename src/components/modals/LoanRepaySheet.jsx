import { useState, useRef, useEffect } from 'react'
import { Landmark, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatAmount } from '../../domain/money'

export default function LoanRepaySheet({ loan, availableBalance, onSubmit, onClose }) {
  const [amount, setAmount] = useState(String(loan.outstanding))
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 300)
  }, [])

  const numAmount = Number(amount) || 0
  const isBorrowed = loan.type !== 'lent'

  const validate = () => {
    const e = {}
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      e.amount = 'Enter a valid repayment amount greater than 0'
    } else if (numAmount > loan.outstanding) {
      e.amount = `Cannot repay more than outstanding amount (₹${formatAmount(loan.outstanding)})`
    } else if (isBorrowed && numAmount > availableBalance) {
      e.amount = `Insufficient available balance (₹${formatAmount(availableBalance)})`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) {
      onSubmit({
        loanId: loan.id,
        amount: numAmount,
        note: note.trim() || (numAmount === loan.outstanding ? 'Full repayment' : 'Partial repayment'),
      })
    }
  }

  const handleSetQuick = (pct) => {
    const calculated = Math.round((loan.outstanding * pct) / 100)
    setAmount(String(calculated))
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Landmark size={24} />
        {isBorrowed ? `Repay ${loan.name}` : `Collect from ${loan.name}`}
      </div>

      <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg)', borderRadius: 12, fontSize: 13, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>Outstanding Debt:</span>
          <strong>₹{formatAmount(loan.outstanding)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Available Balance:</span>
          <strong style={{ color: availableBalance < numAmount ? 'var(--red)' : 'var(--text-primary)' }}>
            ₹{formatAmount(availableBalance)}
          </strong>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="repay-amount">Repayment Amount (₹)</label>
          <input
            ref={amountRef}
            id="repay-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder={`Max ₹${formatAmount(loan.outstanding)}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && (
            <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>
          )}
        </div>

        {/* Quick percentage buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[25, 50, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => handleSetQuick(pct)}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent)',
                cursor: 'pointer',
              }}
            >
              {pct === 100 ? 'Full (100%)' : `${pct}%`}
            </button>
          ))}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="repay-note">Note (optional)</label>
          <input
            id="repay-note"
            className="form-input"
            type="text"
            placeholder="e.g. Paid via UPI"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button className="btn-submit indigo" type="submit">
          Confirm Repayment of ₹{numAmount > 0 ? formatAmount(numAmount) : '0'}
        </button>
      </form>
    </div>
  )
}
