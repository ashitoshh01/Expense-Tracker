/**
 * Money utilities with strict minor-unit (paise) integer math.
 * 1 INR = 100 paise.
 * Eliminates IEEE 754 floating-point rounding errors in all financial operations.
 */

/**
 * Convert Rupees (number or numeric string) to integer paise.
 * Throws on invalid or infinite values.
 * @param {number|string} rupees
 * @returns {number} Integer paise
 */
export function toPaise(rupees) {
  if (rupees === null || rupees === undefined || rupees === '') {
    throw new Error('Amount is required')
  }
  const cleanStr = typeof rupees === 'string' ? rupees.replace(/,/g, '').trim() : rupees
  const num = typeof cleanStr === 'string' ? Number(cleanStr) : Number(cleanStr)
  if (!Number.isFinite(num)) {
    throw new Error('Amount must be a finite number')
  }
  const paise = Math.round(num * 100)
  if (Math.abs(paise) > Number.MAX_SAFE_INTEGER) {
    throw new Error('Amount exceeds maximum supported precision')
  }
  return paise
}

/**
 * Convert integer paise to Rupees with 2 decimal places.
 * @param {number} paise
 * @returns {number}
 */
export function toRupees(paise) {
  if (!Number.isFinite(paise)) {
    throw new Error('Paise must be a finite integer')
  }
  return Math.round(paise) / 100
}

/**
 * Safely parse and validate a monetary amount in Rupees.
 * Must be positive (> 0) unless allowZero is true.
 * @param {number|string} amount
 * @param {boolean} [allowZero=false]
 * @returns {number} Validated amount in Rupees (rounded to 2 decimal places)
 */
export function validateAmount(amount, allowZero = false) {
  const paise = toPaise(amount)
  if (!allowZero && paise <= 0) {
    throw new Error('Amount must be greater than zero')
  }
  if (allowZero && paise < 0) {
    throw new Error('Amount cannot be negative')
  }
  return toRupees(paise)
}

/**
 * Add two amounts in Rupees without floating-point error.
 */
export function addMoney(a, b) {
  return toRupees(toPaise(a) + toPaise(b))
}

/**
 * Subtract two amounts in Rupees without floating-point error.
 */
export function subMoney(a, b) {
  return toRupees(toPaise(a) - toPaise(b))
}

/**
 * Format an amount in INR with standard Indian number system formatting.
 * @param {number|string} amount
 * @returns {string} e.g. "1,23,456.78"
 */
export function formatAmount(amount) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

/**
 * Generate a unique cryptographically stable or pseudo-random ID.
 */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
