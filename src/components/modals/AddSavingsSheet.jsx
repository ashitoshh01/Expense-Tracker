import { useState, useRef, useEffect } from 'react'
import { PiggyBank, Wallet, AlertCircle } from 'lucide-react'
import { formatAmount } from '../../domain/money'

export default function AddSavingsSheet({ maxAmount, onSubmit, onClose }) {
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
    else if (amt > maxAmount) e.amount = `Maximum: ₹${formatAmount(maxAmount)} (your available cash balance)`
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
        <PiggyBank size={24} />
        Add to Savings
      </div>
      <form onSubmit={handleSubmit}>
        <div className="add-savings-info">
          <Wallet size={16} />
          Available cash balance: ₹{formatAmount(maxAmount)}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="savings-amount">Amount (₹)</label>
          <input
            ref={amountRef}
            id="savings-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="e.g. 200"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && (
            <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>
          )}
        </div>
        <button className="btn-submit indigo" type="submit">
          Save ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}
