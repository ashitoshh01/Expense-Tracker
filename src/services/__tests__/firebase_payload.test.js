import { describe, it, expect, vi } from 'vitest'

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn((db, col, id) => ({ path: `${col}/${id}` })),
  setDoc: vi.fn(async () => {}),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  onSnapshot: vi.fn(),
}))

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn(),
}))

vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(),
  isSupported: vi.fn(async () => false),
}))

import { forcePushToCloud } from '../../firebase'
import { setDoc } from 'firebase/firestore'

describe('Firebase Payload Persistence Suite (Phase 1.6 Stage 1)', () => {
  it('includes recurringIncomeHistory, deletedTxIds, and deletedLoanIds in cloud payload', async () => {
    const data = {
      balance: 15000,
      savings: 3000,
      savingsGoal: 50000,
      lastSalaryMonth: '2026-10',
      recurringIncomeHistory: {
        'inc-1_2026-10': true,
        'inc-2_2026-10': true,
      },
      deletedTxIds: {
        'tx-del-1': '2026-10-15T10:00:00Z',
      },
      deletedLoanIds: {
        'loan-del-1': '2026-10-15T10:00:00Z',
      },
      transactions: [{ id: 'tx-1', amount: 500, type: 'spent' }],
      loans: [],
    }

    const payload = await forcePushToCloud('test_user_payload', data)

    expect(payload.recurringIncomeHistory).toEqual({
      'inc-1_2026-10': true,
      'inc-2_2026-10': true,
    })
    expect(payload.deletedTxIds).toEqual({
      'tx-del-1': '2026-10-15T10:00:00Z',
    })
    expect(payload.deletedLoanIds).toEqual({
      'loan-del-1': '2026-10-15T10:00:00Z',
    })

    // Also verify setDoc was called with the full payload
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'wallet_data/test_user_payload' }),
      expect.objectContaining({
        recurringIncomeHistory: {
          'inc-1_2026-10': true,
          'inc-2_2026-10': true,
        },
        deletedTxIds: {
          'tx-del-1': '2026-10-15T10:00:00Z',
        },
        deletedLoanIds: {
          'loan-del-1': '2026-10-15T10:00:00Z',
        },
      }),
      { merge: true }
    )
  })

  it('safely normalizes missing or invalid history/tombstones to empty objects', async () => {
    const minimalData = {
      balance: 5000,
    }

    const payload = await forcePushToCloud('test_user_minimal', minimalData)

    expect(payload.recurringIncomeHistory).toEqual({})
    expect(payload.deletedTxIds).toEqual({})
    expect(payload.deletedLoanIds).toEqual({})
  })
})

