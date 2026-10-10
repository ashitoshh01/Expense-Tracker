import { describe, it, expect } from 'vitest'
import {
  toPaise,
  toRupees,
  addMoney,
  subMoney,
  validateAmount,
  formatAmount,
} from '../money'
import { normalizeState, SCHEMA_VERSION } from '../accounting'
import {
  generateCSV,
  generateBackupJSON,
  validateAndParseImport,
} from '../../services/exportImport'

describe('Section 3, 8 & 9: Money Precision, Migration & Backup Restore Suite', () => {
  describe('Money Precision & Invariants', () => {
    it('correctly handles comma-formatted strings and floating-point precision', () => {
      expect(toPaise('1,000.50')).toBe(100050)
      expect(toPaise('10,500')).toBe(1050000)
      expect(toPaise('0.1')).toBe(10)
      expect(toPaise('0.2')).toBe(20)

      // Exact 0.1 + 0.2 = 0.3 without IEEE-754 drift
      const sum = addMoney(0.1, 0.2)
      expect(sum).toBe(0.3)
      expect(toPaise(sum)).toBe(30)
    })

    it('rejects invalid, negative, and oversized values exceeding MAX_SAFE_INTEGER', () => {
      expect(() => validateAmount(-500)).toThrow(/must be greater than zero/)
      expect(() => toPaise(NaN)).toThrow(/Amount must be a finite number/)
      expect(() => toPaise(Infinity)).toThrow(/Amount must be a finite number/)
      expect(() => toPaise(Number.MAX_SAFE_INTEGER + 1000)).toThrow(/exceeds maximum supported precision/)
      expect(() => validateAmount(0)).toThrow(/must be greater than zero/)
    })

    it('preserves exact numbers across repeated deposits and withdrawals', () => {
      let balance = 1000.0
      for (let i = 0; i < 100; i++) {
        balance = addMoney(balance, 19.99)
        balance = subMoney(balance, 19.99)
      }
      expect(balance).toBe(1000.0)
    })
  })

  describe('Migration & Schema Normalization', () => {
    it('migrates malformed and legacy objects without crashing or data loss', () => {
      const legacyRaw = {
        balance: '12500.50',
        savings: '3000',
        loans: [
          {
            id: 'l-1',
            name: 'Friend',
            type: 'lent',
            amount: '2000',
            repayments: [{ amount: '500', date: '2026-09-01' }],
          },
        ],
        transactions: [
          { id: 't-1', amount: '500', type: 'add', category: 'General' },
          { id: 't-2', amount: '200', type: 'spent', category: 'Food' },
        ],
      }

      const normalized = normalizeState(legacyRaw)
      expect(normalized.balance).toBe(12500.5)
      expect(normalized.savings).toBe(3000)
      expect(normalized.loans[0].amount).toBe(2000)
      expect(normalized.loans[0].outstanding).toBe(1500)
      expect(normalized.transactions).toHaveLength(2)
      expect(normalized.settings.salaryAmount).toBe(0)
    })

    it('is completely idempotent across repeated normalizations', () => {
      const raw = { balance: 5000, savings: 1000, transactions: [] }
      const first = normalizeState(raw)
      const second = normalizeState(first)
      expect(first).toEqual(second)
    })
  })

  describe('Backup & Restore Verification', () => {
    it('escapes CSV fields containing commas, quotes, and newlines per RFC 4180', () => {
      const txs = [
        {
          date: '2026-10-10',
          type: 'expense',
          category: 'Food, Dining & Drinks',
          amount: 450.5,
          note: 'Dinner at "Le Bistro"\nSpecial menu',
          id: 'tx-quote-1',
        },
      ]
      const csv = generateCSV(txs)
      expect(csv).toContain('"Food, Dining & Drinks"')
      expect(csv).toContain('"Dinner at ""Le Bistro""\nSpecial menu"')
      expect(csv).toContain('450.50')
    })

    it('rejects backup files that exceed the 5MB size limit', () => {
      const oversized = 'a'.repeat(6 * 1024 * 1024)
      const result = validateAndParseImport(oversized)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('maximum allowed size')
    })

    it('rejects unsupported future schema versions', () => {
      const futureBackup = JSON.stringify({
        meta: { schemaVersion: 99 },
        data: { balance: 1000 },
      })
      const result = validateAndParseImport(futureBackup)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Unsupported schema version')
    })

    it('rejects backups containing duplicate transaction IDs', () => {
      const duplicateTxBackup = JSON.stringify({
        meta: { schemaVersion: SCHEMA_VERSION },
        data: {
          balance: 1000,
          transactions: [
            { id: 'dup-1', amount: 100, type: 'income', date: '2026-10-01' },
            { id: 'dup-1', amount: 200, type: 'expense', date: '2026-10-02' },
          ],
        },
      })
      const result = validateAndParseImport(duplicateTxBackup)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Duplicate transaction ID')
    })

    it('rejects backups with negative or non-finite transaction amounts', () => {
      const negativeBackup = JSON.stringify({
        meta: { schemaVersion: SCHEMA_VERSION },
        data: {
          balance: 1000,
          transactions: [{ id: 'tx-neg', amount: -500, type: 'income', date: '2026-10-01' }],
        },
      })
      const result = validateAndParseImport(negativeBackup)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Invalid transaction amount')
    })

    it('guarantees complete round-trip preservation of all financial fields and IDs', () => {
      const original = normalizeState({
        balance: 15450.75,
        savings: 8200.25,
        savingsGoal: 50000,
        loans: [
          {
            id: 'loan-xyz',
            name: 'Home Loan',
            type: 'borrowed',
            amount: 500000,
            outstanding: 450000,
            status: 'partially_paid',
            repayments: [{ id: 'rep-1', amount: 50000, date: '2026-09-15', note: 'EMI 1' }],
          },
        ],
        transactions: [
          {
            id: 'tx-100',
            type: 'salary',
            category: 'Salary',
            amount: 85000,
            note: 'Company Payroll',
            date: '2026-10-01',
          },
        ],
      })

      const backup = generateBackupJSON(original)
      const serialized = JSON.stringify(backup)
      const importResult = validateAndParseImport(serialized)

      expect(importResult.ok).toBe(true)
      const restored = importResult.data
      expect(restored.balance).toBe(15450.75)
      expect(restored.savings).toBe(8200.25)
      expect(restored.savingsGoal).toBe(50000)
      expect(restored.loans[0].id).toBe('loan-xyz')
      expect(restored.loans[0].outstanding).toBe(450000)
      expect(restored.loans[0].repayments[0].id).toBe('rep-1')
      expect(restored.transactions[0].id).toBe('tx-100')
      expect(restored.transactions[0].amount).toBe(85000)
    })
  })
})
