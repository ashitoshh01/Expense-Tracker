import { useState } from 'react'
import {
  CircleDollarSign,
  Save,
  AlertCircle,
  Upload,
  Plus,
  Trash2,
  Calendar,
  PiggyBank,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { validateAndParseImport } from '../../services/exportImport'
import { formatAmount } from '../../domain/money'

export default function SettingsSheet({ settings, savingsGoal, onSave, onImportBackup, onClose }) {
  const [goal, setGoal] = useState(String(savingsGoal ?? 0))
  const [recurringIncomes, setRecurringIncomes] = useState(() => {
    return Array.isArray(settings.recurringIncomes) ? [...settings.recurringIncomes] : []
  })

  // New income form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Salary')
  const [newAmount, setNewAmount] = useState('')
  const [newCreditDay, setNewCreditDay] = useState('1')
  const [newAutoSaveAmount, setNewAutoSaveAmount] = useState('')

  const [error, setError] = useState('')
  const [importStatus, setImportStatus] = useState('')

  // Add new recurring income item
  const handleAddIncome = (e) => {
    e.preventDefault()
    setError('')

    const name = newName.trim()
    const amt = Number(newAmount)
    const day = Number(newCreditDay)
    const autoSave = newAutoSaveAmount ? Number(newAutoSaveAmount) : 0

    if (!name) {
      setError('Please provide a name for this income source (e.g. Primary Salary)')
      return
    }
    if (isNaN(amt) || amt <= 0) {
      setError('Income amount must be greater than 0')
      return
    }
    if (isNaN(day) || day < 1 || day > 31) {
      setError('Credit day must be between 1 and 31')
      return
    }
    if (isNaN(autoSave) || autoSave < 0 || autoSave > amt) {
      setError('Auto-save amount must be between 0 and the income amount')
      return
    }

    const newItem = {
      id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      category: newCategory,
      amount: amt,
      creditDay: day,
      autoSaveAmount: autoSave,
      enabled: true,
      createdAt: new Date().toISOString(),
    }

    setRecurringIncomes((prev) => [...prev, newItem])
    setNewName('')
    setNewAmount('')
    setNewAutoSaveAmount('')
    setNewCreditDay('1')
    setShowAddForm(false)
  }

  // Toggle enable/pause for an income source
  const handleToggleIncome = (id) => {
    setRecurringIncomes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
    )
  }

  // Delete an income source
  const handleDeleteIncome = (id) => {
    setRecurringIncomes((prev) => prev.filter((item) => item.id !== id))
  }

  // Save full settings
  const handleSave = (e) => {
    e.preventDefault()
    const g = Number(goal)
    if (isNaN(g) || g < 0) {
      setError('Savings goal must be a valid number (0 or higher)')
      return
    }

    onSave({
      settings: {
        ...settings,
        salaryAmount: 0, // No hardcoded fallback
        autoSaveAmount: 0,
        autoSaveEnabled: false,
        recurringIncomes,
        currency: 'INR',
        hasUserConfiguredSalary: true,
      },
      savingsGoal: g,
    })
    onClose()
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        const result = validateAndParseImport(content)
        if (result.ok) {
          onImportBackup(result.data)
          setImportStatus('Backup restored successfully! ✓')
          setTimeout(() => onClose(), 1200)
        } else {
          setError(result.error || 'Failed to parse backup file')
        }
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="bottom-sheet active" style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
      <div className="sheet-handle" />
      <div className="sheet-title">
        <CircleDollarSign size={24} />
        Salary & Savings
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {importStatus && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10B981',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          {importStatus}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Section: Automated Recurring Incomes */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Automated Incomes & Salaries
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Credits automatically on your specified calendar day each month
              </div>
            </div>
            {!showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: 'var(--accent)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> Add Source
              </button>
            )}
          </div>

          {/* List of existing recurring income sources */}
          {recurringIncomes.length === 0 && !showAddForm ? (
            <div
              style={{
                padding: '18px 14px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed var(--border)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              No automated incomes set up yet. Click <strong>"Add Source"</strong> to configure your monthly salary or recurring income.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recurringIncomes.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: item.enabled ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--border)',
                    opacity: item.enabled ? 1 : 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                        }}
                      >
                        {item.category}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} color="var(--accent)" /> Day {item.creditDay} of month
                      </span>
                      <span style={{ fontWeight: 700, color: '#10B981' }}>
                        +₹{formatAmount(item.amount)}
                      </span>
                      {item.autoSaveAmount > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#818cf8' }}>
                          <PiggyBank size={12} /> Auto-saves ₹{formatAmount(item.autoSaveAmount)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleIncome(item.id)}
                      title={item.enabled ? 'Pause automation' : 'Enable automation'}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: item.enabled ? '#10B981' : 'var(--text-muted)',
                        padding: 4,
                      }}
                    >
                      {item.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteIncome(item.id)}
                      title="Delete source"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#f87171',
                        padding: 4,
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Income Source Inline Form */}
          {showAddForm && (
            <div
              style={{
                marginTop: 12,
                padding: '16px',
                borderRadius: 12,
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#818cf8' }}>
                New Automated Income Source
              </div>

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label" style={{ fontSize: 12 }}>Income Source Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Primary Salary, Consulting, Rental"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Monthly Amount (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="50000"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Credit Day (1 - 31)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="1"
                    value={newCreditDay}
                    onChange={(e) => setNewCreditDay(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Category</label>
                  <select
                    className="form-input"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="Salary">Salary</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Rental">Rental</option>
                    <option value="Business">Business</option>
                    <option value="Investments">Investments</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Auto-Save to Savings (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={newAutoSaveAmount}
                    onChange={(e) => setNewAutoSaveAmount(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddIncome}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Add Income
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section: Savings Goal */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label" htmlFor="set-goal">
            Default Savings Target Goal (₹)
          </label>
          <input
            id="set-goal"
            className="form-input"
            type="number"
            inputMode="decimal"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value)
              setError('')
            }}
          />
        </div>

        <button className="btn-submit indigo" type="submit" style={{ marginBottom: 16 }}>
          <Save size={18} /> Save Settings
        </button>

        {/* Restore Backup Section */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            Restore Data from Backup
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px',
              border: '1.5px dashed var(--border)',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent)',
              cursor: 'pointer',
              background: 'var(--bg)',
            }}
          >
            <Upload size={16} /> Choose Backup JSON File
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </form>
    </div>
  )
}
