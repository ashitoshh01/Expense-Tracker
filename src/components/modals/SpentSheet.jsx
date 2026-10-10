import { useState, useRef, useEffect } from 'react'
import { Receipt, AlertCircle } from 'lucide-react'
import { DEFAULT_SPEND_CATEGORIES } from '../../domain/categories'
import { formatAmount } from '../../domain/money'

export default function SpentSheet({ onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(DEFAULT_SPEND_CATEGORIES[0])
  const [otherText, setOtherText] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 300)
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
        amount: Number(amount),
        category,
        note: category === 'Other' ? otherText.trim() : otherText.trim() || category,
      })
    }
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Receipt size={24} />
        Record Spending
      </div>
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
          {errors.amount && (
            <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="spent-category">Category</label>
          <select
            id="spent-category"
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {DEFAULT_SPEND_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ animation: 'slideIn 0.25s ease' }}>
          <label className="form-label" htmlFor="spent-other">
            {category === 'Other' ? 'Where did you spend this?' : 'Note (optional)'}
          </label>
          <input
            id="spent-other"
            className={`form-input ${errors.other ? 'error' : ''}`}
            type="text"
            placeholder={category === 'Other' ? 'e.g. Bus ticket' : 'e.g. Lunch with team'}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
          />
          {errors.other && (
            <div className="form-error"><AlertCircle size={14} /> {errors.other}</div>
          )}
        </div>

        <button className="btn-submit red" type="submit">
          Spend ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}
