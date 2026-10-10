import { Trash2, Edit2 } from 'lucide-react'
import { getCategoryIcon } from '../../domain/categories'
import { formatAmount } from '../../domain/money'

export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TransactionItem({ tx, showDate, showDelete, onDelete, onEdit }) {
  const Icon = getCategoryIcon(tx.category)

  // Map type to visual class
  const isIncome = tx.type === 'income' || tx.type === 'salary' || (tx.type === 'add' && tx.category !== 'Loan') || tx.type === 'loan_collection'
  const isExpense = tx.type === 'spent' || tx.type === 'expense' || tx.type === 'loan_lend' || tx.type === 'loan_repayment'
  const isTransfer = tx.type === 'savings_deposit' || tx.type === 'savings_withdraw' || tx.type === 'auto_save'

  const iconClass = isIncome ? 'add' : isExpense ? 'spent' : tx.type === 'salary' ? 'salary' : 'savings'
  const isNegative = isExpense || tx.type === 'savings_deposit' || tx.type === 'auto_save'

  return (
    <div
      className="tx-item"
      onClick={() => onEdit?.(tx)}
      style={{ cursor: onEdit ? 'pointer' : 'default' }}
    >
      <div className={`tx-icon-wrap ${iconClass}`}>
        <Icon />
      </div>
      <div className="tx-info">
        <div className="tx-category">{tx.category}</div>
        <div className="tx-note">
          {tx.note ||
            (tx.type === 'salary'
              ? 'Monthly Salary'
              : tx.type === 'savings_deposit' || tx.type === 'auto_save'
              ? 'Transfer to savings'
              : tx.type === 'savings_withdraw'
              ? 'Transfer from savings'
              : tx.type === 'loan_repayment'
              ? 'Loan Repayment'
              : tx.category)}
        </div>
        {showDate && <div className="tx-meta">{formatDate(tx.date)}</div>}
      </div>
      <div className="tx-right">
        <div
          className={`tx-amount ${
            isExpense ? 'negative' : isTransfer ? 'neutral' : 'positive'
          }`}
        >
          {isNegative ? '−' : '+'}₹{formatAmount(tx.amount)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {onEdit && (
          <button
            className="tx-delete-btn"
            title="Edit transaction"
            style={{ color: 'var(--text-muted)' }}
            onClick={(e) => {
              e.stopPropagation()
              onEdit(tx)
            }}
          >
            <Edit2 size={15} />
          </button>
        )}
        {showDelete && (
          <button
            className="tx-delete-btn"
            title="Delete transaction"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(tx.id)
            }}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
