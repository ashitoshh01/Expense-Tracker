/**
 * Date Range & Calendar Boundary Engine for Wallet FIX.
 *
 * Implements local calendar boundary calculations without UTC drift,
 * inclusive range filtering, previous-period baseline computation,
 * and robust handling of missing or malformed dates.
 */

export const DATE_PRESETS = {
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  LAST_3_MONTHS: 'last_3_months',
  LAST_6_MONTHS: 'last_6_months',
  THIS_YEAR: 'this_year',
  ALL_TIME: 'all_time',
}

export const DATE_PRESET_OPTIONS = [
  { id: DATE_PRESETS.THIS_MONTH, label: 'This Month' },
  { id: DATE_PRESETS.LAST_MONTH, label: 'Last Month' },
  { id: DATE_PRESETS.LAST_3_MONTHS, label: 'Last 3 Months' },
  { id: DATE_PRESETS.LAST_6_MONTHS, label: 'Last 6 Months' },
  { id: DATE_PRESETS.THIS_YEAR, label: 'This Year' },
  { id: DATE_PRESETS.ALL_TIME, label: 'All Time' },
]

/**
 * Format a Date object to local calendar 'YYYY-MM-DD' string without UTC conversion.
 * @param {Date} date
 * @returns {string} 'YYYY-MM-DD'
 */
export function formatLocalDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Safely extract 'YYYY-MM-DD' from a transaction date string or fallback.
 * @param {string|Date} dateVal
 * @returns {string|null}
 */
export function normalizeDateString(dateVal) {
  if (!dateVal) return null
  if (dateVal instanceof Date) {
    return formatLocalDate(dateVal)
  }
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim()
    // Match YYYY-MM-DD prefix
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10)
    }
    // Attempt parsing if it's another string date format
    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      return formatLocalDate(parsed)
    }
  }
  return null
}

/**
 * Get the number of days in a given local year and month (0-indexed).
 * @param {number} year
 * @param {number} monthIndex 0-11
 * @returns {number}
 */
export function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/**
 * Resolve a date range preset into exact local calendar start and end dates,
 * along with corresponding previous-period comparison boundaries.
 *
 * @param {string} preset One of DATE_PRESETS
 * @param {Date} [referenceDate=new Date()]
 * @returns {{
 *   preset: string,
 *   label: string,
 *   startDate: string|null,
 *   endDate: string|null,
 *   prevStartDate: string|null,
 *   prevEndDate: string|null,
 *   prevLabel: string|null
 * }}
 */
export function resolveDateRange(preset = DATE_PRESETS.THIS_MONTH, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date()

  const currentYear = ref.getFullYear()
  const currentMonth = ref.getMonth()

  switch (preset) {
    case DATE_PRESETS.THIS_MONTH: {
      const lastDay = getDaysInMonth(currentYear, currentMonth)
      const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
      const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // Previous period: full previous month
      const prevDate = new Date(currentYear, currentMonth - 1, 1)
      const prevYear = prevDate.getFullYear()
      const prevMonth = prevDate.getMonth()
      const prevLastDay = getDaysInMonth(prevYear, prevMonth)
      const prevStartDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`
      const prevEndDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`

      return {
        preset,
        label: 'This Month',
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
        prevLabel: 'vs last month',
      }
    }

    case DATE_PRESETS.LAST_MONTH: {
      const prevDate = new Date(currentYear, currentMonth - 1, 1)
      const pYear = prevDate.getFullYear()
      const pMonth = prevDate.getMonth()
      const pLastDay = getDaysInMonth(pYear, pMonth)
      const startDate = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-01`
      const endDate = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(pLastDay).padStart(2, '0')}`

      // Previous period: two months ago
      const twoMonthsAgo = new Date(currentYear, currentMonth - 2, 1)
      const tYear = twoMonthsAgo.getFullYear()
      const tMonth = twoMonthsAgo.getMonth()
      const tLastDay = getDaysInMonth(tYear, tMonth)
      const prevStartDate = `${tYear}-${String(tMonth + 1).padStart(2, '0')}-01`
      const prevEndDate = `${tYear}-${String(tMonth + 1).padStart(2, '0')}-${String(tLastDay).padStart(2, '0')}`

      return {
        preset,
        label: 'Last Month',
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
        prevLabel: 'vs prior month',
      }
    }

    case DATE_PRESETS.LAST_3_MONTHS: {
      // 3 calendar months ending at end of current month
      const startD = new Date(currentYear, currentMonth - 2, 1)
      const sYear = startD.getFullYear()
      const sMonth = startD.getMonth()
      const startDate = `${sYear}-${String(sMonth + 1).padStart(2, '0')}-01`

      const lastDay = getDaysInMonth(currentYear, currentMonth)
      const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // Preceding 3 months
      const pStartD = new Date(currentYear, currentMonth - 5, 1)
      const psYear = pStartD.getFullYear()
      const psMonth = pStartD.getMonth()
      const prevStartDate = `${psYear}-${String(psMonth + 1).padStart(2, '0')}-01`

      const pEndD = new Date(currentYear, currentMonth - 3, 1)
      const peYear = pEndD.getFullYear()
      const peMonth = pEndD.getMonth()
      const peLastDay = getDaysInMonth(peYear, peMonth)
      const prevEndDate = `${peYear}-${String(peMonth + 1).padStart(2, '0')}-${String(peLastDay).padStart(2, '0')}`

      return {
        preset,
        label: 'Last 3 Months',
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
        prevLabel: 'vs prior 3 months',
      }
    }

    case DATE_PRESETS.LAST_6_MONTHS: {
      // 6 calendar months ending at end of current month
      const startD = new Date(currentYear, currentMonth - 5, 1)
      const sYear = startD.getFullYear()
      const sMonth = startD.getMonth()
      const startDate = `${sYear}-${String(sMonth + 1).padStart(2, '0')}-01`

      const lastDay = getDaysInMonth(currentYear, currentMonth)
      const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // Preceding 6 months
      const pStartD = new Date(currentYear, currentMonth - 11, 1)
      const psYear = pStartD.getFullYear()
      const psMonth = pStartD.getMonth()
      const prevStartDate = `${psYear}-${String(psMonth + 1).padStart(2, '0')}-01`

      const pEndD = new Date(currentYear, currentMonth - 6, 1)
      const peYear = pEndD.getFullYear()
      const peMonth = pEndD.getMonth()
      const peLastDay = getDaysInMonth(peYear, peMonth)
      const prevEndDate = `${peYear}-${String(peMonth + 1).padStart(2, '0')}-${String(peLastDay).padStart(2, '0')}`

      return {
        preset,
        label: 'Last 6 Months',
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
        prevLabel: 'vs prior 6 months',
      }
    }

    case DATE_PRESETS.THIS_YEAR: {
      const startDate = `${currentYear}-01-01`
      const endDate = `${currentYear}-12-31`
      const prevStartDate = `${currentYear - 1}-01-01`
      const prevEndDate = `${currentYear - 1}-12-31`

      return {
        preset,
        label: 'This Year',
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
        prevLabel: 'vs last year',
      }
    }

    case DATE_PRESETS.ALL_TIME:
    default: {
      return {
        preset: DATE_PRESETS.ALL_TIME,
        label: 'All Time',
        startDate: null,
        endDate: null,
        prevStartDate: null,
        prevEndDate: null,
        prevLabel: null,
      }
    }
  }
}

/**
 * Filter an array of transactions within an inclusive start and end date range.
 * Safely handles missing dates, fallback to createdAt, and deleted transaction exclusion.
 *
 * @param {Array<Object>} transactions
 * @param {{ startDate?: string|null, endDate?: string|null, deletedTxIds?: Object }} range
 * @returns {Array<Object>}
 */
export function filterTransactionsByDateRange(transactions, { startDate = null, endDate = null, deletedTxIds = null } = {}) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return []
  }

  const deletedSet = deletedTxIds && typeof deletedTxIds === 'object'
    ? new Set(Object.keys(deletedTxIds))
    : null

  return transactions.filter((t) => {
    if (!t || typeof t !== 'object') return false
    if (deletedSet && deletedSet.has(t.id)) return false
    if (t.isReversed) return false

    const rawDate = t.date || (t.createdAt ? t.createdAt.slice(0, 10) : null)
    const txDate = normalizeDateString(rawDate)

    if (!txDate) return false

    if (startDate && txDate < startDate) return false
    if (endDate && txDate > endDate) return false

    return true
  })
}

