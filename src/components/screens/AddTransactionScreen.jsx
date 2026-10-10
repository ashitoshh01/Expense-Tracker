import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Minus, DollarSign, Calendar, AlertCircle } from 'lucide-react'
import { ALL_CATEGORIES } from '../../domain/categories'

export default function AddTransactionScreen({ onSubmit, onBack }) {
  const [txType, setTxType] = useState('income')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Salary')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [errors, setErrors] = useState({})

  const categories = txType === 'income'
    ? ALL_CATEGORIES.filter((c) => c.type === 'income')
    : ALL_CATEGORIES.filter((c) => c.type === 'expense')

  useEffect(() => {
    setCategory(txType === 'income' ? 'Salary' : 'Outside Food')
  }, [txType])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({ type: txType, amount: Number(amount), category, note, date })
    }
  }

  return (
    <div className="screen add-tx-screen">
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={22} />
          </button>
          <h1 className="page-title">Add Transaction</h1>
        </div>
      </div>

      {/* Type Toggle */}
      <div className="type-toggle">
        <button
          className={`type-toggle-btn income-btn ${txType === 'income' ? 'active' : ''}`}
          onClick={() => setTxType('income')}
          type="button"
        >
          <span className="toggle-icon"><Plus size={16} /></span>
          Income
        </button>
        <button
          className={`type-toggle-btn expense-btn ${txType === 'expense' ? 'active' : ''}`}
          onClick={() => setTxType('expense')}
          type="button"
        >
          <span className="toggle-icon"><Minus size={16} /></span>
          Expense
        </button>
      </div>

      <div className="form-section">
        {/* Amount */}
        <div className="form-group">
          <label className="form-label">Amount</label>
          <div className={`amount-input-wrap ${errors.amount ? 'error' : ''}`}>
            <span className="amount-prefix">₹</span>
            <input
              className="amount-input"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="amount-input-icon">
              <DollarSign />
            </span>
          </div>
          {errors.amount && (
            <div className="form-error">
              <AlertCircle size={14} /> {errors.amount}
            </div>
          )}
        </div>

        {/* Category Grid */}
        <div className="form-group">
          <label className="form-label">Category</label>
          <div className="category-grid">
            {categories.map((cat) => {
              const CatIcon = cat.icon
              return (
                <button
                  key={cat.id}
                  className={`category-item ${category === cat.id ? 'active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                  type="button"
                >
                  <div className="category-icon">
                    <CatIcon />
                  </div>
                  <span className="category-name">{cat.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">
            Description <span className="form-label-optional">(Optional)</span>
          </label>
          <input
            className="form-input"
            type="text"
            placeholder={`e.g. ${txType === 'income' ? 'Bonus or freelance' : 'Lunch at restaurant'}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Date */}
        <div className="form-group">
          <label className="form-label">Date</label>
          <div className="date-input-wrap">
            <Calendar size={20} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="save-btn-container">
        <button className="save-btn" onClick={handleSubmit} type="button">
          <Plus size={20} />
          Save Transaction
        </button>
      </div>
    </div>
  )
}
