import { describe, it, expect } from 'vitest'
import {
  DATE_PRESETS,
  DATE_PRESET_OPTIONS,
  formatLocalDate,
  normalizeDateString,
  getDaysInMonth,
  resolveDateRange,
  filterTransactionsByDateRange,
} from '../dateRange'

describe('Domain: Date Range Engine (dateRange.js)', () => {
  describe('formatLocalDate and normalizeDateString', () => {
    it('formats date correctly in YYYY-MM-DD local representation', () => {
      const d = new Date(2026, 9, 5) // Oct 5, 2026 local
      expect(formatLocalDate(d)).toBe('2026-10-05')
    })

    it('normalizes valid YYYY-MM-DD strings and Date objects', () => {
      expect(normalizeDateString('2026-03-15')).toBe('2026-03-15')
      expect(normalizeDateString('2026-11-06T14:30:00.000Z')).toBe('2026-11-06')
      expect(normalizeDateString(new Date(2026, 0, 1))).toBe('2026-01-01')
      expect(normalizeDateString('')).toBeNull()
      expect(normalizeDateString(null)).toBeNull()
      expect(normalizeDateString('invalid-date')).toBeNull()
    })

    it('calculates days in month correctly including leap years', () => {
      expect(getDaysInMonth(2024, 1)).toBe(29) // Feb 2024 leap year
      expect(getDaysInMonth(2026, 1)).toBe(28) // Feb 2026 normal year
      expect(getDaysInMonth(2026, 9)).toBe(31) // Oct 2026
      expect(getDaysInMonth(2026, 10)).toBe(30) // Nov 2026
    })
  })

  describe('resolveDateRange presets', () => {
    const fixedRef = new Date(2026, 10, 6) // Nov 6, 2026

    it('resolves THIS_MONTH correctly with full calendar bounds and previous month baseline', () => {
      const res = resolveDateRange(DATE_PRESETS.THIS_MONTH, fixedRef)
      expect(res.preset).toBe('this_month')
      expect(res.startDate).toBe('2026-11-01')
      expect(res.endDate).toBe('2026-11-30')
      expect(res.prevStartDate).toBe('2026-10-01')
      expect(res.prevEndDate).toBe('2026-10-31')
      expect(res.prevLabel).toBe('vs last month')
    })

    it('resolves LAST_MONTH correctly across previous month boundaries', () => {
      const res = resolveDateRange(DATE_PRESETS.LAST_MONTH, fixedRef)
      expect(res.startDate).toBe('2026-10-01')
      expect(res.endDate).toBe('2026-10-31')
      expect(res.prevStartDate).toBe('2026-09-01')
      expect(res.prevEndDate).toBe('2026-09-30')
      expect(res.prevLabel).toBe('vs prior month')
    })

    it('resolves LAST_3_MONTHS correctly across multi-month intervals', () => {
      const res = resolveDateRange(DATE_PRESETS.LAST_3_MONTHS, fixedRef)
      expect(res.startDate).toBe('2026-09-01')
      expect(res.endDate).toBe('2026-11-30')
      expect(res.prevStartDate).toBe('2026-06-01')
      expect(res.prevEndDate).toBe('2026-08-31')
      expect(res.prevLabel).toBe('vs prior 3 months')
    })

    it('resolves LAST_6_MONTHS correctly', () => {
      const res = resolveDateRange(DATE_PRESETS.LAST_6_MONTHS, fixedRef)
      expect(res.startDate).toBe('2026-06-01')
      expect(res.endDate).toBe('2026-11-30')
      expect(res.prevStartDate).toBe('2025-12-01')
      expect(res.prevEndDate).toBe('2026-05-31')
    })

    it('resolves THIS_YEAR correctly', () => {
      const res = resolveDateRange(DATE_PRESETS.THIS_YEAR, fixedRef)
      expect(res.startDate).toBe('2026-01-01')
      expect(res.endDate).toBe('2026-12-31')
      expect(res.prevStartDate).toBe('2025-01-01')
      expect(res.prevEndDate).toBe('2025-12-31')
    })

    it('resolves ALL_TIME with null bounds', () => {
      const res = resolveDateRange(DATE_PRESETS.ALL_TIME, fixedRef)
      expect(res.startDate).toBeNull()
      expect(res.endDate).toBeNull()
      expect(res.prevStartDate).toBeNull()
      expect(res.prevEndDate).toBeNull()
    })

    it('handles year boundary rollover correctly for January', () => {
      const janRef = new Date(2026, 0, 15) // Jan 15, 2026
      const res = resolveDateRange(DATE_PRESETS.THIS_MONTH, janRef)
      expect(res.startDate).toBe('2026-01-01')
      expect(res.endDate).toBe('2026-01-31')
      expect(res.prevStartDate).toBe('2025-12-01')
      expect(res.prevEndDate).toBe('2025-12-31')

      const lastMonthRes = resolveDateRange(DATE_PRESETS.LAST_MONTH, janRef)
      expect(lastMonthRes.startDate).toBe('2025-12-01')
      expect(lastMonthRes.endDate).toBe('2025-12-31')
      expect(lastMonthRes.prevStartDate).toBe('2025-11-01')
      expect(lastMonthRes.prevEndDate).toBe('2025-11-30')
    })
  })

  describe('filterTransactionsByDateRange', () => {
    const txs = [
      { id: 't1', date: '2026-10-15', amount: 500, type: 'spent' },
      { id: 't2', date: '2026-11-01', amount: 1500, type: 'salary' },
      { id: 't3', date: '2026-11-20', amount: 350, type: 'spent' },
      { id: 't4', date: '2026-12-05', amount: 200, type: 'spent' },
      { id: 't5', date: '', createdAt: '2026-11-10T12:00:00Z', amount: 100, type: 'spent' },
      { id: 't6', date: 'invalid', amount: 50, type: 'spent' },
      { id: 't7', date: '2026-11-15', amount: 50, type: 'spent', isReversed: true },
      { id: 't8', date: '2026-11-18', amount: 80, type: 'spent' },
    ]

    it('filters transactions within inclusive range correctly', () => {
      const filtered = filterTransactionsByDateRange(txs, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      })
      const ids = filtered.map((t) => t.id)
      expect(ids).toContain('t2')
      expect(ids).toContain('t3')
      expect(ids).toContain('t5') // Used createdAt
      expect(ids).toContain('t8')
      expect(ids).not.toContain('t1') // October
      expect(ids).not.toContain('t4') // December
      expect(ids).not.toContain('t6') // Invalid
      expect(ids).not.toContain('t7') // isReversed
    })

    it('returns all valid non-reversed transactions for ALL_TIME (null bounds)', () => {
      const filtered = filterTransactionsByDateRange(txs, {
        startDate: null,
        endDate: null,
      })
      const ids = filtered.map((t) => t.id)
      expect(ids).toContain('t1')
      expect(ids).toContain('t2')
      expect(ids).toContain('t3')
      expect(ids).toContain('t4')
      expect(ids).toContain('t5')
      expect(ids).toContain('t8')
      expect(ids).not.toContain('t6')
      expect(ids).not.toContain('t7')
    })

    it('excludes transactions listed in deletedTxIds tombstone map', () => {
      const deletedTxIds = { t3: '2026-11-21T00:00:00Z' }
      const filtered = filterTransactionsByDateRange(txs, {
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        deletedTxIds,
      })
      const ids = filtered.map((t) => t.id)
      expect(ids).not.toContain('t3')
      expect(ids).toContain('t2')
    })
  })
})

