import { useState, useMemo } from 'react'
import { Search, X, Plus, Receipt } from 'lucide-react'
import TransactionItem from './TransactionItem'

const getMonthName = () => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function TransactionsScreen({ transactions, onNavigate, onDeleteTx, onEditTx }) {
  const [filter, setFilter] = useState('all')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTxs = useMemo(() => {
    let txs = [...transactions]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      txs = txs.filter((t) =>
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.note && t.note.toLowerCase().includes(q))
      )
    }

    switch (filter) {
      case 'income':
        return txs.filter((t) => t.type === 'income' || t.type === 'salary' || (t.type === 'add' && t.category !== 'Loan'))
      case 'expenses':
        return txs.filter((t) => t.type === 'spent' || t.type === 'expense')
      case 'savings':
        return txs.filter((t) => t.type === 'savings_deposit' || t.type === 'savings_withdraw' || t.type === 'auto_save')
      case 'loans':
        return txs.filter((t) => t.type === 'loan_borrow' || t.type === 'loan_lend' || t.type === 'loan_repayment' || t.type === 'loan_collection' || (t.type === 'add' && t.category === 'Loan'))
      default:
        return txs
    }
  }, [transactions, filter, searchQuery])

  if (showSearch) {
    return (
      <div className="search-overlay">
        <div className="search-header">
          <div className="search-input-wrap">
            <Search size={18} />
            <input
              className="search-input"
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}
                onClick={() => setSearchQuery('')}
              >
                <X size={16} color="#94A3B8" />
              </button>
            )}
          </div>
          <button
            className="search-cancel-btn"
            onClick={() => {
              setShowSearch(false)
              setSearchQuery('')
            }}
          >
            Cancel
          </button>
        </div>
        <div className="search-results">
          <div className="tx-list">
            {filteredTxs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Search /></div>
                <div className="empty-state-title">No results found</div>
                <div className="empty-state-sub">Try a different search term</div>
              </div>
            ) : (
              filteredTxs.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  tx={tx}
                  showDate
                  onDelete={onDeleteTx}
                  onEdit={onEditTx}
                  showDelete
                />
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        <button className="page-header-action" onClick={() => setShowSearch(true)}>
          <Search />
        </button>
      </div>

      {/* Filter Pills */}
      <div className="filter-pills">
        {['all', 'income', 'expenses', 'savings', 'loans'].map((f) => (
          <button
            key={f}
            className={`filter-pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Month Group */}
      <div className="month-group-header">{getMonthName()}</div>

      {/* Transaction List */}
      <div className="transactions-list-page">
        {filteredTxs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Receipt /></div>
            <div className="empty-state-title">No transactions yet</div>
            <div className="empty-state-sub">Start tracking your finances</div>
          </div>
        ) : (
          filteredTxs.map((tx) => (
            <TransactionItem
              key={tx.id}
              tx={tx}
              showDate
              onDelete={onDeleteTx}
              onEdit={onEditTx}
              showDelete
            />
          ))
        )}
      </div>

      {/* Add Transaction Button */}
      <div className="fab-container">
        <button className="fab-btn" onClick={() => onNavigate('addTx')}>
          <Plus size={20} />
          Add Transaction
        </button>
      </div>
    </div>
  )
}
