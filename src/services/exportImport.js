/**
 * Data Export, Backup, and Import Service for Wallet FIX.
 *
 * Implements:
 * 1. Schema-versioned JSON backup files.
 * 2. RFC 4180 compliant CSV export with proper escaping and clear financial transaction types.
 * 3. Safe JSON import validation that rejects corrupt files without overwriting user data.
 */

import { normalizeState, SCHEMA_VERSION } from '../domain/accounting'

/**
 * Escape a string field according to RFC 4180 for CSV.
 * @param {string} val
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

/**
 * Generate CSV text from transactions.
 * @param {Array} transactions
 * @returns {string}
 */
export function generateCSV(transactions = []) {
  const headers = ['Date', 'Type', 'Category', 'Amount (INR)', 'Note', 'Transaction ID']
  const headerRow = headers.map(escapeCSV).join(',')

  const rows = transactions.map((t) => {
    return [
      t.date || '',
      t.type || '',
      t.category || '',
      (Number(t.amount) || 0).toFixed(2),
      t.note || '',
      t.id || '',
    ]
      .map(escapeCSV)
      .join(',')
  })

  return [headerRow, ...rows].join('\n')
}

/**
 * Trigger browser download of CSV file.
 * @param {Array} transactions
 */
export function exportToCSV(transactions) {
  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions available to export')
  }

  const csvContent = generateCSV(transactions)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `wallet_fix_expenses_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate schema-versioned backup object.
 * @param {Object} state
 * @returns {Object}
 */
export function generateBackupJSON(state) {
  const normalized = normalizeState(state)
  return {
    meta: {
      appName: 'Wallet FIX',
      version: '2.0.0',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
    },
    data: {
      balance: normalized.balance,
      savings: normalized.savings,
      loans: normalized.loans,
      transactions: normalized.transactions,
      savingsGoal: normalized.savingsGoal,
      lastSalaryMonth: normalized.lastSalaryMonth,
      settings: normalized.settings,
    },
  }
}

/**
 * Trigger browser download of JSON backup.
 * @param {Object} state
 */
export function exportToJSON(state) {
  const backup = generateBackupJSON(state)
  const jsonString = JSON.stringify(backup, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `wallet_fix_backup_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024 // 5MB limit
const ALLOWED_TX_TYPES = new Set([
  'income',
  'salary',
  'spent',
  'expense',
  'savings_deposit',
  'savings_withdraw',
  'loan_borrow',
  'loan_lend',
  'loan_repayment',
  'loan_collection',
  'auto_save',
  'add',
])

/**
 * Parse and validate an imported backup JSON file.
 *
 * Requirements verified:
 * - Reject oversized imports (> 5MB).
 * - Reject unsupported future schema versions.
 * - Detect and reject duplicate transaction IDs.
 * - Enforce positive, finite monetary amounts on transactions.
 * - Validate loan bounds (outstanding <= amount, non-negative).
 * - All-or-nothing validation preventing partial corruption.
 *
 * @param {string} jsonString
 * @returns {{ ok: boolean, data?: Object, error?: string }}
 */
export function validateAndParseImport(jsonString) {
  if (typeof jsonString !== 'string') {
    return { ok: false, error: 'Import payload must be a string' }
  }

  if (jsonString.length > MAX_IMPORT_SIZE_BYTES) {
    return { ok: false, error: 'Import file exceeds maximum allowed size (5MB)' }
  }

  try {
    const parsed = JSON.parse(jsonString)

    if (parsed === null || typeof parsed !== 'object') {
      return { ok: false, error: 'Invalid backup file format: payload must be a JSON object' }
    }

    // Schema version validation
    if (parsed.meta && parsed.meta.schemaVersion !== undefined) {
      const version = Number(parsed.meta.schemaVersion)
      if (!Number.isInteger(version) || version < 1 || version > SCHEMA_VERSION) {
        return {
          ok: false,
          error: `Unsupported schema version: ${parsed.meta.schemaVersion}. Current supported version is ${SCHEMA_VERSION}.`,
        }
      }
    }

    // Handle either versioned wrapper ({ meta, data }) or direct state ({ balance, ... })
    const rawData = parsed.data || parsed

    if (typeof rawData !== 'object' || rawData === null || Array.isArray(rawData)) {
      return { ok: false, error: 'Invalid backup file format: missing state payload' }
    }

    // Validate balances
    if (rawData.balance !== undefined && !Number.isFinite(Number(rawData.balance))) {
      return { ok: false, error: 'Corrupt cash balance: must be a finite number' }
    }
    if (rawData.savings !== undefined && (!Number.isFinite(Number(rawData.savings)) || Number(rawData.savings) < 0)) {
      return { ok: false, error: 'Corrupt savings balance: cannot be negative or non-finite' }
    }

    // Validate transactions
    if (rawData.transactions !== undefined) {
      if (!Array.isArray(rawData.transactions)) {
        return { ok: false, error: 'Corrupt transactions in backup: must be an array' }
      }

      const seenIds = new Set()
      for (let i = 0; i < rawData.transactions.length; i++) {
        const tx = rawData.transactions[i]
        if (!tx || typeof tx !== 'object') {
          return { ok: false, error: `Corrupt transaction at index ${i}` }
        }

        // Duplicate ID check
        if (tx.id) {
          if (seenIds.has(tx.id)) {
            return { ok: false, error: `Duplicate transaction ID detected: ${tx.id}` }
          }
          seenIds.add(tx.id)
        }

        // Amount check
        const amt = Number(tx.amount)
        if (!Number.isFinite(amt) || amt <= 0) {
          return { ok: false, error: `Invalid transaction amount at index ${i}: must be positive and finite` }
        }

        // Type check
        if (tx.type && !ALLOWED_TX_TYPES.has(tx.type)) {
          return { ok: false, error: `Unknown transaction type "${tx.type}" at index ${i}` }
        }
      }
    }

    // Validate loans
    if (rawData.loans !== undefined) {
      if (!Array.isArray(rawData.loans)) {
        return { ok: false, error: 'Corrupt loans in backup: must be an array' }
      }

      for (let i = 0; i < rawData.loans.length; i++) {
        const loan = rawData.loans[i]
        if (!loan || typeof loan !== 'object') {
          return { ok: false, error: `Corrupt loan at index ${i}` }
        }

        const loanAmt = Number(loan.amount)
        if (!Number.isFinite(loanAmt) || loanAmt <= 0) {
          return { ok: false, error: `Invalid loan amount at index ${i}: must be positive and finite` }
        }

        const outstanding = Number(loan.outstanding !== undefined ? loan.outstanding : loan.amount)
        if (!Number.isFinite(outstanding) || outstanding < 0 || outstanding > loanAmt) {
          return { ok: false, error: `Invalid loan outstanding balance at index ${i}` }
        }

        if (loan.repayments !== undefined && !Array.isArray(loan.repayments)) {
          return { ok: false, error: `Corrupt loan repayments at index ${i}: must be an array` }
        }
      }
    }

    const state = normalizeState(rawData)
    return { ok: true, data: state }
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err.message}` }
  }
}
