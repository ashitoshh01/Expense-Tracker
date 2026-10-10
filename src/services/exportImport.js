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

/**
 * Parse and validate an imported backup JSON file.
 * @param {string} jsonString
 * @returns {{ ok: boolean, data?: Object, error?: string }}
 */
export function validateAndParseImport(jsonString) {
  try {
    const parsed = JSON.parse(jsonString)

    // Handle either versioned wrapper ({ meta, data }) or direct state ({ balance, ... })
    const rawData = parsed.data || parsed

    if (typeof rawData !== 'object' || rawData === null) {
      return { ok: false, error: 'Invalid backup file format: missing state payload' }
    }

    if (rawData.transactions && !Array.isArray(rawData.transactions)) {
      return { ok: false, error: 'Corrupt transactions in backup' }
    }

    if (rawData.loans && !Array.isArray(rawData.loans)) {
      return { ok: false, error: 'Corrupt loans in backup' }
    }

    const state = normalizeState(rawData)
    return { ok: true, data: state }
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err.message}` }
  }
}
