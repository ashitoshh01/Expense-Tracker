import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { normalizeState } from '../../domain/accounting'
import { SyncManager } from '../syncManager'
import * as firebase from '../../firebase'

vi.mock('../../firebase', () => ({
  forcePushToCloud: vi.fn(),
  subscribeUserData: vi.fn(),
  fetchFreshFromServer: vi.fn(),
}))

describe('Services: SyncManager Concurrency & Single-Flight Worker Suite (Phase 1.5)', () => {
  const mockUserId = 'test_user_concurrency_123'
  let storageMock = {}
  let onStateUpdated
  let onStatusChanged
  let snapshotCallback
  let windowMock

  beforeEach(() => {
    storageMock = {}
    vi.stubGlobal('localStorage', {
      getItem: (key) => storageMock[key] || null,
      setItem: (key, val) => {
        storageMock[key] = String(val)
      },
      removeItem: (key) => {
        delete storageMock[key]
      },
      clear: () => {
        storageMock = {}
      },
    })

    windowMock = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('window', windowMock)

    onStateUpdated = vi.fn()
    onStatusChanged = vi.fn()
    vi.clearAllMocks()

    firebase.subscribeUserData.mockImplementation((uid, onData) => {
      snapshotCallback = onData
      return vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('1. handles rapid mutations while upload is in flight without launching concurrent forcePushToCloud calls', async () => {
    let inFlightCount = 0
    let maxInFlight = 0

    let resolvePush1
    const pushPromise1 = new Promise((resolve) => {
      resolvePush1 = resolve
    })

    firebase.forcePushToCloud.mockImplementation(async (uid, data) => {
      inFlightCount += 1
      maxInFlight = Math.max(maxInFlight, inFlightCount)
      if (data.balance === 100) {
        await pushPromise1
      }
      inFlightCount -= 1
      return data
    })

    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)

    const state1 = normalizeState({ balance: 100, transactions: [{ id: 'tx-1', amount: 100 }] })
    const state2 = normalizeState({ balance: 200, transactions: [{ id: 'tx-1', amount: 100 }, { id: 'tx-2', amount: 100 }] })
    const state3 = normalizeState({ balance: 300, transactions: [{ id: 'tx-1', amount: 100 }, { id: 'tx-2', amount: 100 }, { id: 'tx-3', amount: 100 }] })

    // Mutation 1 starts
    const p1 = manager.syncMutation(state1)
    expect(firebase.forcePushToCloud).toHaveBeenCalledTimes(1)

    // Mutation 2 and 3 arrive while Mutation 1 is in-flight
    const p2 = manager.syncMutation(state2)
    const p3 = manager.syncMutation(state3)

    // Still only 1 push in-flight
    expect(firebase.forcePushToCloud).toHaveBeenCalledTimes(1)
    expect(maxInFlight).toBe(1)

    // Complete push 1
    resolvePush1()
    await Promise.all([p1, p2, p3])

    // Must have executed sequentially without overlap
    expect(maxInFlight).toBe(1)
    expect(firebase.forcePushToCloud).toHaveBeenCalledTimes(2)
    manager.destroy()
  })

  it('2. earlier upload completion does not clear newer pending queue entry', async () => {
    let resolvePush1
    const pushPromise1 = new Promise((resolve) => {
      resolvePush1 = resolve
    })

    let resolvePush2
    const pushPromise2 = new Promise((resolve) => {
      resolvePush2 = resolve
    })

    firebase.forcePushToCloud.mockImplementation(async (uid, data) => {
      if (data.balance === 500) {
        await pushPromise1
      } else if (data.balance === 800) {
        await pushPromise2
      }
      return data
    })

    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)

    const state1 = normalizeState({ balance: 500, transactions: [{ id: 'tx-1', amount: 500 }] })
    const state2 = normalizeState({ balance: 800, transactions: [{ id: 'tx-1', amount: 500 }, { id: 'tx-2', amount: 300 }] })

    // Start push 1
    const p1 = manager.syncMutation(state1)

    // In-flight: state 2 updates queue
    const p2 = manager.syncMutation(state2)
    expect(manager.getPendingQueue().balance).toBe(800)

    // Push 1 resolves
    resolvePush1()

    // Wait a brief microtask tick
    await new Promise((r) => setTimeout(r, 10))

    // Queue must NOT have been wiped to null by push 1 resolving!
    const queueAfterPush1 = manager.getPendingQueue()
    expect(queueAfterPush1).not.toBeNull()
    expect(queueAfterPush1.balance).toBe(800)

    // Push 2 finishes
    resolvePush2()
    await Promise.all([p1, p2])

    // Now that state 2 finished, queue is cleared
    expect(manager.getPendingQueue()).toBeNull()
    manager.destroy()
  })

  it('3. ensures no concurrent Firestore writes occur from one SyncManager instance', async () => {
    let activePushes = 0
    let peakConcurrency = 0

    firebase.forcePushToCloud.mockImplementation(async (uid, data) => {
      activePushes += 1
      peakConcurrency = Math.max(peakConcurrency, activePushes)
      await new Promise((r) => setTimeout(r, 20))
      activePushes -= 1
      return data
    })

    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)

    // Launch multiple sync requests simultaneously
    const p1 = manager.syncMutation(normalizeState({ balance: 10 }))
    const p2 = manager.syncMutation(normalizeState({ balance: 20 }))
    const p3 = manager.flushPendingSync()
    const p4 = manager.syncMutation(normalizeState({ balance: 30 }))
    const p5 = manager.flushPendingSync()

    await Promise.all([p1, p2, p3, p4, p5])

    expect(peakConcurrency).toBe(1)
    expect(activePushes).toBe(0)
    manager.destroy()
  })

  it('4. ensures the latest mutation eventually reaches Firestore', async () => {
    const pushedStates = []
    firebase.forcePushToCloud.mockImplementation(async (uid, data) => {
      pushedStates.push(data)
      await new Promise((r) => setTimeout(r, 15))
      return data
    })

    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)

    const p1 = manager.syncMutation(normalizeState({ balance: 1000 }))
    const p2 = manager.syncMutation(normalizeState({ balance: 2000 }))
    const p3 = manager.syncMutation(normalizeState({ balance: 3500 }))

    await Promise.all([p1, p2, p3])

    expect(pushedStates.length).toBeGreaterThanOrEqual(1)
    const finalPushed = pushedStates[pushedStates.length - 1]
    expect(finalPushed.balance).toBe(3500)
    expect(manager.getPendingQueue()).toBeNull()
    manager.destroy()
  })

  it('5. failed upload preserves pending state in localStorage for retry', async () => {
    firebase.forcePushToCloud.mockRejectedValue(new Error('Network offline or 503 unavailable'))

    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)

    const state = normalizeState({ balance: 4200, transactions: [{ id: 'tx-fail', amount: 4200 }] })
    await manager.syncMutation(state)

    // Queue must be preserved for retry
    expect(manager.hasPendingChanges()).toBe(true)
    const pending = manager.getPendingQueue()
    expect(pending.balance).toBe(4200)
    expect(pending.transactions[0].id).toBe('tx-fail')
    expect(manager.status).toBe('error')

    manager.destroy()
  })

  it('6. implements exponential backoff retry and timer cleanup', async () => {
    vi.useFakeTimers()
    firebase.forcePushToCloud.mockRejectedValue(new Error('Temporary server glitch'))

    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)
    const state = normalizeState({ balance: 1500 })

    await manager.syncMutation(state)

    // First attempt failed, retry attempt count incremented
    expect(manager.retryAttempt).toBe(1)
    expect(manager.retryTimer).not.toBeNull()

    // Trigger timer for retry 1 (delay is ~1000ms + jitter)
    await vi.advanceTimersByTimeAsync(2000)

    // Second failure
    expect(manager.retryAttempt).toBe(2)

    // Now simulate recovery
    firebase.forcePushToCloud.mockResolvedValue({ balance: 1500 })
    // Advance for retry 2 (~2000ms + jitter)
    await vi.advanceTimersByTimeAsync(3500)

    // Successful sync resets attempts and cleans timer
    expect(manager.retryAttempt).toBe(0)
    expect(manager.retryTimer).toBeNull()

    manager.destroy()
    vi.useRealTimers()
  })

  it('7. suppresses Firestore snapshot echo from triggering redundant pushes', async () => {
    firebase.forcePushToCloud.mockResolvedValue({ balance: 5000 })

    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)
    manager.startListening()

    const state = normalizeState({
      balance: 5000,
      updatedAt: '2026-11-06T10:00:00.000Z',
      transactions: [{ id: 'tx-echo', amount: 5000 }],
    })

    await manager.syncMutation(state)
    expect(firebase.forcePushToCloud).toHaveBeenCalledTimes(1)

    // Simulate Firestore sending back the snapshot echo of what was just pushed
    snapshotCallback({
      balance: 5000,
      updatedAt: state.updatedAt,
      transactions: [{ id: 'tx-echo', amount: 5000 }],
      loans: [],
    })

    // Echo must NOT trigger a second forcePushToCloud!
    expect(firebase.forcePushToCloud).toHaveBeenCalledTimes(1)
    manager.destroy()
  })

  it('8. rejects stale remote snapshot when local state has a newer timestamp and no delta', () => {
    const localCurrentState = normalizeState({
      balance: 9000,
      updatedAt: '2026-11-06T12:00:00.000Z',
      transactions: [{ id: 'tx-new', amount: 9000 }],
    })

    const manager = new SyncManager(
      mockUserId,
      onStateUpdated,
      onStatusChanged,
      () => localCurrentState
    )
    manager.startListening()

    // Stale snapshot arriving with older updatedAt and no new transactions
    const staleRemoteData = {
      balance: 4000,
      updatedAt: '2026-11-06T10:00:00.000Z',
      transactions: [],
      loans: [],
    }

    snapshotCallback(staleRemoteData)

    // UI should NOT be updated with stale data
    expect(onStateUpdated).not.toHaveBeenCalledWith(expect.objectContaining({ balance: 4000 }))
    manager.destroy()
  })

  it('9. removes window online and offline event listeners on destroy() and prevents restarts', () => {
    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)

    expect(windowMock.addEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(windowMock.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function))

    manager.destroy()

    expect(windowMock.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function))
    expect(windowMock.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(manager.isDestroyed).toBe(true)

    // Idempotent destroy call is safe
    expect(() => manager.destroy()).not.toThrow()

    // Destroyed instance does not schedule work
    manager.syncMutation(normalizeState({ balance: 100 }))
    expect(manager.hasPendingChanges()).toBe(false)
  })

  it('10. multiple consecutive mutations preserve all transactions and balances', async () => {
    let finalPayload = null
    firebase.forcePushToCloud.mockImplementation(async (uid, data) => {
      finalPayload = data
      await new Promise((r) => setTimeout(r, 10))
      return data
    })

    const manager = new SyncManager(mockUserId, onStateUpdated, onStatusChanged)

    let state = normalizeState({ balance: 1000, transactions: [] })

    // Chain 5 distinct transactions
    const promises = []
    for (let i = 1; i <= 5; i++) {
      state = {
        ...state,
        balance: state.balance + 100,
        transactions: [{ id: `tx-${i}`, amount: 100 }, ...state.transactions],
        updatedAt: new Date(Date.now() + i * 1000).toISOString(),
      }
      promises.push(manager.syncMutation(state))
    }

    await Promise.all(promises)
    await manager.flushPendingSync()

    expect(finalPayload).not.toBeNull()
    expect(finalPayload.balance).toBe(1500)
    expect(finalPayload.transactions).toHaveLength(5)
    expect(finalPayload.transactions.map((t) => t.id)).toEqual([
      'tx-5',
      'tx-4',
      'tx-3',
      'tx-2',
      'tx-1',
    ])
    expect(manager.getPendingQueue()).toBeNull()
    manager.destroy()
  })

  it('11. stale remote snapshot with meaningful remote delta reconciles safely without overwriting local state', async () => {
    let pushedData = null
    firebase.forcePushToCloud.mockImplementation(async (uid, data) => {
      pushedData = data
      return data
    })

    const localState = normalizeState({
      balance: 4500,
      transactions: [{ id: 'tx-local', type: 'spent', amount: 500, date: '2026-11-06', createdAt: '2026-11-06T10:05:00.000Z' }],
      updatedAt: '2026-11-06T10:05:00.000Z',
    })

    const manager = new SyncManager(
      mockUserId,
      onStateUpdated,
      onStatusChanged,
      () => localState
    )
    manager.startListening()

    // Remote snapshot arrives with older timestamp (10:00 < 10:05), but has a novel remote transaction
    const staleRemoteData = {
      balance: 6200, // 5000 + 1200
      updatedAt: '2026-11-06T10:00:00.000Z',
      transactions: [
        { id: 'tx-remote', type: 'income', amount: 1200, date: '2026-11-06', createdAt: '2026-11-06T10:00:00.000Z' },
      ],
      loans: [],
    }

    // Trigger realtime snapshot
    snapshotCallback(staleRemoteData)

    // Verify onStateUpdated was called with the MERGED state (NOT the raw stale remote state)
    expect(onStateUpdated).toHaveBeenCalled()
    const updatedState = onStateUpdated.mock.calls[onStateUpdated.mock.calls.length - 1][0]

    // Both local and remote transactions are present!
    const txIds = updatedState.transactions.map((t) => t.id)
    expect(txIds).toContain('tx-local')
    expect(txIds).toContain('tx-remote')
    // Balance: local 4500 + remote income 1200 = 5700
    expect(updatedState.balance).toBe(5700)

    // Merged state is queued for cloud push to update the server with the union
    expect(manager.hasPendingChanges()).toBe(true)
    const pending = manager.getPendingQueue()
    expect(pending.transactions.map((t) => t.id)).toContain('tx-local')
    expect(pending.transactions.map((t) => t.id)).toContain('tx-remote')

    manager.destroy()
  })
})
