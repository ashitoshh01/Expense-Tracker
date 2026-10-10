import { useState, useRef, useEffect } from 'react'
import { Wallet, AlertCircle } from 'lucide-react'
import { formatAmount } from '../../domain/money'

export default function AddSheet({ onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 300)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    if (!from.trim()) e.from = "Enter the person or source name"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) onSubmit({ amount: Number(amount), from: from.trim() })
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Wallet size={24} />
        Add Income / Money
      </div>
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
          {errors.amount && (
            <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="add-from">Source / From</label>
          <input
            id="add-from"
            className={`form-input ${errors.from ? 'error' : ''}`}
            type="text"
            placeholder="e.g. Freelance, Friend, Gift"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          {errors.from && (
            <div className="form-error"><AlertCircle size={14} /> {errors.from}</div>
          )}
        </div>
        <button className="btn-submit indigo" type="submit">
          Add ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}
