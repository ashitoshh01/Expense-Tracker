import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeState,
  recordIncome,
  recordExpense,
  processRecurringIncomesAutomation,
  addRecurringIncome,
} from '../../domain/accounting'

describe('React State Mutation Architecture & StateRef Synchronization (Phase 1.4)', () => {
  let mockStorage = {}
  let stateRef
  let authUserRef
  let syncManagerMock
  let showToastMock
  let setStateMock
  let mutateState
  let applyStateUpdate

  beforeEach(() => {
    mockStorage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, val) => {
        mockStorage[key] = String(val)
      },
      removeItem: (key) => {
        delete mockStorage[key]
      },
      clear: () => {
        mockStorage = {}
      },
    })

    const initialState = normalizeState({ balance: 1000 })
    stateRef = { current: initialState }
    authUserRef = { current: { uid: 'user_test_123' } }

    setStateMock = vi.fn((newState) => {
      // In React, setState schedules an update with the value passed
    })

    applyStateUpdate = (nextState) => {
      stateRef.current = nextState
      setStateMock(nextState)
    }

    showToastMock = vi.fn()
    syncManagerMock = {
      syncMutation: vi.fn(),
    }

    // Mirror the exact mutateState implementation in App.jsx
    mutateState = (reducerFn, successMsg = '', toastVariant = '') => {
      try {
        const prev = stateRef.current
        const next = reducerFn(prev)
        if (!next || next === prev) {
          return prev
        }
        applyStateUpdate(next)

        const uid = authUserRef.current?.uid || 'anonymous_local'
        try {
          const key = `et_${uid}_state`
          localStorage.setItem(key, JSON.stringify(next))
        } catch {}

        if (syncManagerMock) {
          syncManagerMock.syncMutation(next)
        }
        const finalMsg = typeof successMsg === 'function' ? successMsg(next, prev) : successMsg
        if (finalMsg) {
          showToastMock(finalMsg, toastVariant)
        }
        return next
      } catch (err) {
        showToastMock(err.message || 'Operation failed', 'error')
        return stateRef.current
      }
    }
  })

  it('executes reducer function exactly once per mutation call', () => {
    const reducer = vi.fn((s) => recordIncome(s, { amount: 500, category: 'Income' }))

    const result = mutateState(reducer, '+₹500 added', 'income')

    expect(reducer).toHaveBeenCalledTimes(1)
    expect(result.balance).toBe(1500)
    expect(stateRef.current.balance).toBe(1500)
    expect(setStateMock).toHaveBeenCalledWith(result)
    // Confirms setState is called with a concrete object, NOT an updater function with side effects
    expect(typeof setStateMock.mock.calls[0][0]).toBe('object')
  })

  it('runs all side effects (persistence, sync, toast) outside setState updater', () => {
    mutateState(
      (s) => recordIncome(s, { amount: 200, category: 'Salary' }),
      'Income recorded',
      'income'
    )

    // Verify localStorage persistence
    const key = `et_user_test_123_state`
    expect(mockStorage[key]).toBeDefined()
    const stored = JSON.parse(mockStorage[key])
    expect(stored.balance).toBe(1200)

    // Verify cloud sync mutation triggered with exact new state
    expect(syncManagerMock.syncMutation).toHaveBeenCalledTimes(1)
    expect(syncManagerMock.syncMutation).toHaveBeenCalledWith(stateRef.current)

    // Verify toast shown with expected message and variant
    expect(showToastMock).toHaveBeenCalledWith('Income recorded', 'income')
  })

  it('avoids stale state when multiple mutations happen rapidly and synchronously', () => {
    // 3 rapid mutations in same tick before any React render cycle completes
    mutateState((s) => recordIncome(s, { amount: 500 }), 'Income 1')
    mutateState((s) => recordExpense(s, { amount: 200, category: 'Food' }), 'Expense 1')
    mutateState((s) => recordIncome(s, { amount: 100 }), 'Income 2')

    // Initial 1000 + 500 - 200 + 100 = 1400
    expect(stateRef.current.balance).toBe(1400)
    expect(setStateMock).toHaveBeenCalledTimes(3)
    expect(syncManagerMock.syncMutation).toHaveBeenCalledTimes(3)
    expect(stateRef.current.transactions).toHaveLength(3)
  })

  it('skips persistence, sync, and toast if reducer returns identical state (no-op)', () => {
    const noopReducer = vi.fn((s) => s)

    const result = mutateState(noopReducer, 'Should not show')

    expect(noopReducer).toHaveBeenCalledTimes(1)
    expect(setStateMock).not.toHaveBeenCalled()
    expect(syncManagerMock.syncMutation).not.toHaveBeenCalled()
    expect(showToastMock).not.toHaveBeenCalled()
    expect(result).toBe(stateRef.current)
  })

  it('catches reducer errors cleanly, shows error toast, and preserves stateRef', () => {
    const failingReducer = vi.fn(() => {
      throw new Error('Ledger calculation overflow')
    })

    const initial = stateRef.current
    const result = mutateState(failingReducer, 'Success!')

    expect(failingReducer).toHaveBeenCalledTimes(1)
    expect(showToastMock).toHaveBeenCalledWith('Ledger calculation overflow', 'error')
    expect(setStateMock).not.toHaveBeenCalled()
    expect(syncManagerMock.syncMutation).not.toHaveBeenCalled()
    expect(result).toBe(initial)
    expect(stateRef.current).toBe(initial)
  })

  it('guarantees recurring income automation is strictly idempotent across runs', () => {
    // Configure recurring income due on day 5
    let configuredState = addRecurringIncome(stateRef.current, {
      name: 'Monthly Stipend',
      category: 'Salary',
      amount: 10000,
      creditDay: 5,
      autoSaveAmount: 2000,
    })
    applyStateUpdate(configuredState)

    const date = new Date('2026-11-05T10:00:00Z')

    // First run (simulates initial load)
    const preview1 = processRecurringIncomesAutomation(stateRef.current, { now: date })
    expect(preview1.processed).toBe(true)

    if (preview1.processed && preview1.creditedSources?.length) {
      mutateState(
        (currentState) => {
          const res = processRecurringIncomesAutomation(currentState, { now: date })
          return res.processed && res.creditedSources?.length ? res.state : currentState
        },
        'Salary Credited',
        'salary'
      )
    }

    expect(stateRef.current.balance).toBe(9000) // 1000 + (10000 - 2000)
    expect(stateRef.current.savings).toBe(2000)
    expect(showToastMock).toHaveBeenCalledWith('Salary Credited', 'salary')
    expect(syncManagerMock.syncMutation).toHaveBeenCalledTimes(1)

    // Second run (simulates React StrictMode second effect invocation)
    const preview2 = processRecurringIncomesAutomation(stateRef.current, { now: date })
    expect(preview2.processed).toBe(false) // Idempotency check prevents second run

    // Even if mutateState were called, it returns same state
    mutateState(
      (currentState) => {
        const res = processRecurringIncomesAutomation(currentState, { now: date })
        return res.processed && res.creditedSources?.length ? res.state : currentState
      },
      'Salary Credited Again',
      'salary'
    )

    // No second credit, no second toast, no second sync call
    expect(stateRef.current.balance).toBe(9000)
    expect(stateRef.current.savings).toBe(2000)
    expect(showToastMock).toHaveBeenCalledTimes(1)
    expect(syncManagerMock.syncMutation).toHaveBeenCalledTimes(1)
  })

  it('supports dynamic success message functions in mutateState', () => {
    mutateState(
      (s) => recordIncome(s, { amount: 300 }),
      (next, prev) => `Balance increased from ₹${prev.balance} to ₹${next.balance}`,
      'income'
    )

    expect(showToastMock).toHaveBeenCalledWith(
      'Balance increased from ₹1000 to ₹1300',
      'income'
    )
  })
})

