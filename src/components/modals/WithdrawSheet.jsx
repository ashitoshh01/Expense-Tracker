import { useState, useRef, useEffect } from 'react'
import { ArrowDownToLine, AlertCircle } from 'lucide-react'
import { formatAmount } from '../../domain/money'

export default function WithdrawSheet({ maxAmount, onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 300)
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
    if (validate()) onSubmit({ amount: Number(amount) })
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <ArrowDownToLine size={24} />
        Withdraw from Savings
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="withdraw-amount">
            Amount (₹) — Available in Savings: ₹{formatAmount(maxAmount)}
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
          {errors.amount && (
            <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>
          )}
        </div>
        <button className="btn-submit indigo" type="submit">
          Withdraw ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}
