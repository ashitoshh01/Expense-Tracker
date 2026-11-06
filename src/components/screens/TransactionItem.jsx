import { Trash2, Edit2 } from 'lucide-react'
import { getCategoryIcon } from '../../domain/categories'
import { formatAmount } from '../../domain/money'

export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const formatTimeOrDate = (tx) => {
  if (!tx) return ''
  if (tx.createdAt) {
    try {
      const d = new Date(tx.createdAt)
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      }
    } catch {}
  }
  return formatDate(tx.date)
}

export default function TransactionItem({ tx, showDate, showDelete, onDelete, onEdit }) {
  const Icon = getCategoryIcon(tx?.category)

  // Map type to visual class
  const isIncome =
    tx?.type === 'income' ||
    tx?.type === 'salary' ||
    (tx?.type === 'add' && tx?.category !== 'Loan') ||
    tx?.type === 'loan_collection'
  const isExpense =
    tx?.type === 'spent' ||
    tx?.type === 'expense' ||
    tx?.type === 'loan_lend' ||
    tx?.type === 'loan_repayment'
  const isTransfer =
    tx?.type === 'savings_deposit' ||
    tx?.type === 'savings_withdraw' ||
    tx?.type === 'auto_save'

  const iconClass = isIncome
    ? 'add'
    : isExpense
    ? 'spent'
    : tx?.type === 'salary'
    ? 'salary'
    : 'savings'
  const isNegative = isExpense || tx?.type === 'savings_deposit' || tx?.type === 'auto_save'

  const metaText = showDate ? (tx?.createdAt ? formatTimeOrDate(tx) : formatDate(tx?.date)) : ''

  return (
    <div
      className="tx-item"
      onClick={() => onEdit?.(tx)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onEdit) {
          e.preventDefault()
          onEdit(tx)
        }
      }}
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      aria-label={
        onEdit
          ? `Edit ${tx?.category || 'transaction'}: ₹${formatAmount(tx?.amount || 0)}`
          : undefined
      }
      style={{ cursor: onEdit ? 'pointer' : 'default' }}
    >
      <div className={`tx-icon-wrap ${iconClass}`} aria-hidden="true">
        <Icon size={18} />
      </div>

      <div className="tx-info">
        <div className="tx-category">{tx?.category}</div>
        <div className="tx-note">
          {tx?.note ||
            (tx?.type === 'salary'
              ? 'Monthly Salary'
              : tx?.type === 'savings_deposit' || tx?.type === 'auto_save'
              ? 'Transfer to savings'
              : tx?.type === 'savings_withdraw'
              ? 'Transfer from savings'
              : tx?.type === 'loan_repayment'
              ? 'Loan Repayment'
              : tx?.category)}
        </div>
        {metaText && <div className="tx-meta">{metaText}</div>}
      </div>

      <div className="tx-right">
        <div
          className={`tx-amount ${
            isExpense ? 'negative' : isTransfer ? 'neutral' : 'positive'
          }`}
        >
          {`${isNegative ? '−' : '+'}₹${formatAmount(tx?.amount || 0)}`}
        </div>
      </div>

      {(onEdit || showDelete) && (
        <div
          style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <button
              type="button"
              className="tx-delete-btn"
              title="Edit transaction"
              aria-label={`Edit ${tx?.category || 'transaction'}`}
              style={{ color: 'var(--wf-text-secondary)' }}
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
              type="button"
              className="tx-delete-btn"
              title="Delete transaction"
              aria-label={`Delete ${tx?.category || 'transaction'}`}
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(tx?.id)
              }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
