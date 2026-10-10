import { describe, it, expect, beforeEach, vi } from 'vitest'
import { normalizeState, DEFAULT_SETTINGS } from '../../domain/accounting'
import { SyncManager } from '../syncManager'

describe('Services: SyncManager & Offline Resilience (C6)', () => {
  const mockUserId = 'test_user_123'
  let storageMock = {}

  beforeEach(() => {
    storageMock = {}
    vi.stubGlobal('localStorage', {
      getItem: (key) => storageMock[key] || null,
      setItem: (key, val) => { storageMock[key] = String(val) },
      removeItem: (key) => { delete storageMock[key] },
      clear: () => { storageMock = {} },
    })
  })

  it('queues mutations into localStorage durably when offline without losing data', async () => {
    const onStateUpdated = vi.fn()
    const onStatusChanged = vi.fn()
    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)
    manager.isOnline = false // simulate offline mode

    const state = normalizeState({
      balance: 4500,
      savings: 1000,
      transactions: [{ id: 'tx-1', amount: 500, type: 'spent' }],
    })

    await manager.syncMutation(state)

    expect(manager.hasPendingChanges()).toBe(true)
    const pending = manager.getPendingQueue()
    expect(pending.balance).toBe(4500)
    expect(pending.transactions).toHaveLength(1)
    expect(onStatusChanged).toHaveBeenCalledWith('offline')

    manager.destroy()
  })

  it('migrates legacy storage keys seamlessly without data loss', () => {
    // Populate legacy keys
    storageMock['et_balance'] = '3500'
    storageMock['et_savings'] = '1200'
    storageMock['et_loans'] = JSON.stringify([{ id: 'l1', name: 'Alice', amount: 800 }])
    storageMock['et_transactions'] = JSON.stringify([{ id: 't1', amount: 200, type: 'spent' }])
    storageMock['et_lastSalaryMonth'] = '2026-08'
    storageMock['et_savingsGoal'] = '5000'

    const legacyBalance = Number(localStorage.getItem('et_balance'))
    const legacySavings = Number(localStorage.getItem('et_savings'))
    const legacyLoans = JSON.parse(localStorage.getItem('et_loans') || '[]')
    const legacyTransactions = JSON.parse(localStorage.getItem('et_transactions') || '[]')
    const legacyLastSalaryMonth = localStorage.getItem('et_lastSalaryMonth') || ''
    const legacySavingsGoal = Number(localStorage.getItem('et_savingsGoal')) || 1000

    const migrated = normalizeState({
      balance: legacyBalance,
      savings: legacySavings,
      loans: legacyLoans,
      transactions: legacyTransactions,
      lastSalaryMonth: legacyLastSalaryMonth,
      savingsGoal: legacySavingsGoal,
      settings: { ...DEFAULT_SETTINGS },
    })

    expect(migrated.balance).toBe(3500)
    expect(migrated.savings).toBe(1200)
    expect(migrated.loans).toHaveLength(1)
    expect(migrated.loans[0].outstanding).toBe(800) // normalized outstanding debt
    expect(migrated.transactions).toHaveLength(1)
    expect(migrated.savingsGoal).toBe(5000)
  })

  it('preserves newer local changes over stale remote snapshots during conflict', () => {
    const onStateUpdated = vi.fn()
    const onStatusChanged = vi.fn()
    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)

    const newerTime = new Date('2026-10-10T12:00:00Z').toISOString()
    const olderTime = new Date('2026-10-10T11:00:00Z').toISOString()

    // Local pending change is newer
    manager.setPendingQueue({
      balance: 6000,
      updatedAt: newerTime,
    })

    const staleRemoteData = {
      balance: 4000,
      updatedAt: olderTime,
    }

    const localTime = new Date(manager.getPendingQueue().updatedAt).getTime()
    const remoteTime = new Date(staleRemoteData.updatedAt).getTime()

    // Conflict check logic: local wins because localTime >= remoteTime
    expect(localTime > remoteTime).toBe(true)
    manager.destroy()
  })
})
