import { useState } from 'react'
import { Settings, Save, AlertCircle, Upload, Check } from 'lucide-react'
import { validateAndParseImport } from '../../services/exportImport'

export default function SettingsSheet({ settings, savingsGoal, onSave, onImportBackup, onClose }) {
  const [salaryAmount, setSalaryAmount] = useState(String(settings.salaryAmount || 2000))
  const [salaryDay, setSalaryDay] = useState(String(settings.salaryDay || 5))
  const [autoSaveAmount, setAutoSaveAmount] = useState(String(settings.autoSaveAmount || 500))
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(Boolean(settings.autoSaveEnabled))
  const [goal, setGoal] = useState(String(savingsGoal || 1000))
  const [error, setError] = useState('')
  const [importStatus, setImportStatus] = useState('')

  const handleSave = (e) => {
    e.preventDefault()
    const sal = Number(salaryAmount)
    const day = Number(salaryDay)
    const asAmt = Number(autoSaveAmount)
    const g = Number(goal)

    if (isNaN(sal) || sal <= 0) {
      setError('Salary amount must be greater than 0')
      return
    }
    if (isNaN(day) || day < 1 || day > 28) {
      setError('Salary day must be between 1 and 28')
      return
    }
    if (autoSaveEnabled && (isNaN(asAmt) || asAmt < 0 || asAmt > sal)) {
      setError('Auto-save amount must be between 0 and your salary')
      return
    }
    if (isNaN(g) || g <= 0) {
      setError('Savings goal must be greater than 0')
      return
    }

    onSave({
      settings: {
        salaryAmount: sal,
        salaryDay: day,
        autoSaveAmount: asAmt,
        autoSaveEnabled,
        currency: 'INR',
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
    <div className="bottom-sheet active" style={{ maxHeight: '90dvh' }}>
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Settings size={24} />
        Financial Settings
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {importStatus && (
        <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          {importStatus}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="form-group">
          <label className="form-label" htmlFor="set-salary">Monthly Salary Amount (₹)</label>
          <input
            id="set-salary"
            className="form-input"
            type="number"
            inputMode="decimal"
            value={salaryAmount}
            onChange={(e) => { setSalaryAmount(e.target.value); setError(''); }}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="set-day">Salary Credit Day of Month (1 - 28)</label>
          <input
            id="set-day"
            className="form-input"
            type="number"
            min="1"
            max="28"
            value={salaryDay}
            onChange={(e) => { setSalaryDay(e.target.value); setError(''); }}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Enable Auto-Savings</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Automatically move portion of salary to savings</div>
          </div>
          <input
            type="checkbox"
            checked={autoSaveEnabled}
            onChange={(e) => setAutoSaveEnabled(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
        </div>

        {autoSaveEnabled && (
          <div className="form-group">
            <label className="form-label" htmlFor="set-autosave">Auto-Save Amount (₹)</label>
            <input
              id="set-autosave"
              className="form-input"
              type="number"
              inputMode="decimal"
              value={autoSaveAmount}
              onChange={(e) => { setAutoSaveAmount(e.target.value); setError(''); }}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="set-goal">Default Savings Goal (₹)</label>
          <input
            id="set-goal"
            className="form-input"
            type="number"
            inputMode="decimal"
            value={goal}
            onChange={(e) => { setGoal(e.target.value); setError(''); }}
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
