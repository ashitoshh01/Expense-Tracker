import { useState, useRef, useEffect } from 'react'
import { Edit3, AlertCircle } from 'lucide-react'
import { ALL_CATEGORIES } from '../../domain/categories'
import { formatAmount } from '../../domain/money'

export default function EditTxSheet({ tx, onSubmit, onClose }) {
  const [amount, setAmount] = useState(String(tx.amount))
  const [category, setCategory] = useState(tx.category)
  const [note, setNote] = useState(tx.note || '')
  const [date, setDate] = useState(tx.date || new Date().toISOString().split('T')[0])
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 300)
  }, [])

  const availableCategories = ALL_CATEGORIES.filter((c) =>
    tx.type === 'income' || tx.type === 'salary' ? c.type === 'income' : c.type === 'expense'
  )

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) {
      e.amount = 'Enter a valid amount greater than 0'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) {
      onSubmit(tx.id, {
        amount: Number(amount),
        category,
        note: note.trim(),
        date,
      })
    }
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Edit3 size={24} />
        Edit Transaction
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="edit-amount">Amount (₹)</label>
          <input
            ref={amountRef}
            id="edit-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && (
            <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>
          )}
        </div>

        {availableCategories.length > 0 && (
          <div className="form-group">
            <label className="form-label" htmlFor="edit-category">Category</label>
            <select
              id="edit-category"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {availableCategories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="edit-note">Note / Description</label>
          <input
            id="edit-note"
            className="form-input"
            type="text"
            placeholder="Description"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="edit-date">Date</label>
          <input
            id="edit-date"
            className="form-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <button className="btn-submit indigo" type="submit">
          Save Changes
        </button>
      </form>
    </div>
  )
}
