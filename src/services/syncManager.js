/**
 * Cloud Synchronization & Offline Mutation Manager for Wallet FIX.
 *
 * Guarantees zero data loss across network drops, refreshes, and multi-tab sessions:
 * 1. Single-flight serialized synchronization worker preventing concurrent or out-of-order pushes.
 * 2. Optimistic local-first updates with safe, identity-matched pending mutation queue in localStorage.
 * 3. Automatic retry with exponential backoff and jitter.
 * 4. Two-way reconciliation: preserves unconfirmed local changes when remote snapshots arrive while suppressing self-echoes.
 * 5. Transparent sync status indicators: 'synced' | 'saving' | 'offline' | 'pending' | 'error' | 'permission_denied'.
 */

import { normalizeState, reconcileStates } from '../domain/accounting'
import { forcePushToCloud, subscribeUserData } from '../firebase'

export class SyncManager {
  constructor(userId, onStateUpdated, onStatusChanged, getCurrentState = null) {
    this.userId = userId
    this.onStateUpdated = onStateUpdated
    this.onStatusChanged = onStatusChanged
    this.getCurrentState = getCurrentState
    this.getInitialState = getCurrentState // backward compatibility alias
    this.pendingQueueKey = `et_pending_sync_${userId}`
    this.status = 'connecting'
    this.unsubscribeFirestore = null
    this.retryTimer = null
    this.retryAttempt = 0
    this.isOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true
    this.isDestroyed = false

    // Single-flight synchronization worker state
    this.workerPromise = null
    this.isPushing = false
    this.lastPushedSignature = null

    // Named event listeners for clean unbinding
    this.handleOnline = null
    this.handleOffline = null

    this.bindNetworkEvents()
  }

  bindNetworkEvents() {
    if (typeof window === 'undefined') return

    this.handleOnline = () => {
      if (this.isDestroyed) return
      this.isOnline = true
      this.retryAttempt = 0
      this.flushPendingSync()
    }

    this.handleOffline = () => {
      if (this.isDestroyed) return
      this.isOnline = false
      if (this.retryTimer) {
        clearTimeout(this.retryTimer)
        this.retryTimer = null
      }
      this.setStatus('offline')
    }

    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
  }

  classifyError(err) {
    const msg = String(err?.message || err).toLowerCase()
    const code = String(err?.code || '').toLowerCase()
    if (
      code.includes('permission-denied') ||
      msg.includes('permission') ||
      msg.includes('insufficient permissions')
    ) {
      return 'permission_denied'
    }
    if (code.includes('not-found') || msg.includes('not found') || msg.includes('not-found')) {
      return 'not_created'
    }
    return this.isOnline ? 'error' : 'offline'
  }

  setStatus(status) {
    if (this.isDestroyed) return
    this.status = status
    if (this.onStatusChanged) {
      this.onStatusChanged(status)
    }
  }

  getPendingQueue() {
    try {
      const data = localStorage.getItem(this.pendingQueueKey)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }

  setPendingQueue(state) {
    try {
      if (state) {
        localStorage.setItem(this.pendingQueueKey, JSON.stringify(state))
      } else {
        localStorage.removeItem(this.pendingQueueKey)
      }
    } catch (e) {
      console.warn('Could not write pending sync queue to localStorage:', e)
    }
  }

  hasPendingChanges() {
    return Boolean(this.getPendingQueue())
  }

  getLastSyncedAt() {
    try {
      return localStorage.getItem(`et_last_synced_at_${this.userId}`) || null
    } catch {
      return null
    }
  }

  setLastSyncedAt(timestamp) {
    try {
      if (timestamp) {
        localStorage.setItem(`et_last_synced_at_${this.userId}`, timestamp)
      } else {
        localStorage.removeItem(`et_last_synced_at_${this.userId}`)
      }
    } catch (e) {
      console.warn('Could not write lastSyncedAt to localStorage:', e)
    }
  }

  _getStateSignature(state) {
    if (!state) return ''
    const txCount = (state.transactions || []).length
    const loanCount = (state.loans || []).length
    const latestTxId = txCount > 0 ? state.transactions[0].id : ''
    const deletedTxCount = Object.keys(state.deletedTxIds || {}).length
    const deletedLoanCount = Object.keys(state.deletedLoanIds || {}).length
    return `${state.balance}_${state.savings}_${txCount}_${latestTxId}_${loanCount}_${deletedTxCount}_${deletedLoanCount}_${state.updatedAt || ''}`
  }

  _isStateEqual(stateA, stateB) {
    if (stateA === stateB) return true
    if (!stateA || !stateB) return false
    if (stateA.balance !== stateB.balance) return false
    if (stateA.savings !== stateB.savings) return false
    if (stateA.savingsGoal !== stateB.savingsGoal) return false
    if (stateA.lastSalaryMonth !== stateB.lastSalaryMonth) return false
    if ((stateA.transactions || []).length !== (stateB.transactions || []).length) return false
    if ((stateA.loans || []).length !== (stateB.loans || []).length) return false
    if (Object.keys(stateA.deletedTxIds || {}).length !== Object.keys(stateB.deletedTxIds || {}).length) return false
    if (Object.keys(stateA.deletedLoanIds || {}).length !== Object.keys(stateB.deletedLoanIds || {}).length) return false
    if (stateA.updatedAt && stateB.updatedAt && stateA.updatedAt !== stateB.updatedAt) return false
    return JSON.stringify(stateA) === JSON.stringify(stateB)
  }

  _hasNewRemoteContent(localState, remoteState) {
    if (!localState) return true
    if (!remoteState) return false

    // 1. Check for remote deletions not yet known locally
    const localDelTxs = localState.deletedTxIds || {}
    const hasNewDelTx = Object.keys(remoteState.deletedTxIds || {}).some((id) => !localDelTxs[id])
    if (hasNewDelTx) return true

    const localDelLoans = localState.deletedLoanIds || {}
    const hasNewDelLoan = Object.keys(remoteState.deletedLoanIds || {}).some((id) => !localDelLoans[id])
    if (hasNewDelLoan) return true

    // 2. Check for remote-only transactions
    const localTxSet = new Set((localState.transactions || []).map((t) => t.id))
    const hasNewTx = (remoteState.transactions || []).some((t) => !localTxSet.has(t.id))
    if (hasNewTx) return true

    // 3. Check for remote loan changes / repayments
    const localLoanMap = new Map((localState.loans || []).map((l) => [l.id, l]))
    for (const rLoan of remoteState.loans || []) {
      const lLoan = localLoanMap.get(rLoan.id)
      if (!lLoan) return true
      const lRepIds = new Set((lLoan.repayments || []).map((r) => r.id || `${r.date}_${r.amount}`))
      const hasNewRep = (rLoan.repayments || []).some((r) => !lRepIds.has(r.id || `${r.date}_${r.amount}`))
      if (hasNewRep) return true
    }

    // 4. Check for settings or balance changes with newer timestamp
    const remoteTime = new Date(remoteState.updatedAt || 0).getTime()
    const localTime = new Date(localState.updatedAt || 0).getTime()
    if (remoteTime > localTime) {
      if (remoteState.balance !== localState.balance || remoteState.savings !== localState.savings) {
        return true
      }
      if (JSON.stringify(remoteState.settings) !== JSON.stringify(localState.settings)) {
        return true
      }
    }

    return false
  }

  /**
   * Enqueue a local state mutation and trigger serialized synchronization.
   * @param {Object} nextState
   * @returns {Promise<Object>}
   */
  async syncMutation(nextState) {
    if (this.isDestroyed) return normalizeState(nextState)

    const normalized = normalizeState(nextState)
    normalized.updatedAt = new Date().toISOString()

    // Durable queue: save locally first immediately
    this.setPendingQueue(normalized)

    if (!this.isOnline) {
      this.setStatus('offline')
      return normalized
    }

    // Schedule single-flight worker
    try {
      await this._scheduleSyncWorker()
    } catch {
      // Errors are handled inside _runSyncWorker and status is classified
    }
    return normalized
  }

  /**
   * Schedule or join the active single-flight worker promise.
   * @returns {Promise<void>}
   */
  _scheduleSyncWorker() {
    if (this.isDestroyed) return Promise.resolve()

    if (!this.workerPromise) {
      this.workerPromise = this._runSyncWorker().finally(() => {
        this.workerPromise = null
        this.isPushing = false
      })
    }
    return this.workerPromise
  }

  /**
   * Single-flight worker loop: sequentially pushes queued state.
   * Never executes concurrent forcePushToCloud operations.
   */
  async _runSyncWorker() {
    if (this.isDestroyed || !this.isOnline) return

    this.isPushing = true

    while (this.hasPendingChanges() && !this.isDestroyed && this.isOnline) {
      const stateToPush = this.getPendingQueue()
      if (!stateToPush) break

      this.setStatus('saving')
      try {
        await forcePushToCloud(this.userId, stateToPush)

        if (this.isDestroyed) return

        // Record signature of successfully uploaded state
        this.lastPushedSignature = this._getStateSignature(stateToPush)
        this.setLastSyncedAt(new Date().toISOString())

        // Reset retry counters on success
        this.retryAttempt = 0
        if (this.retryTimer) {
          clearTimeout(this.retryTimer)
          this.retryTimer = null
        }

        // Safe pending queue handling:
        // Clear queue ONLY if current pending state still matches what was just successfully pushed.
        // If a newer mutation arrived while forcePushToCloud was in-flight, preserve it and continue loop!
        const currentPending = this.getPendingQueue()
        if (currentPending && this._isStateEqual(currentPending, stateToPush)) {
          this.setPendingQueue(null)
          this.setStatus('synced')
        }
      } catch (err) {
        if (this.isDestroyed) return
        console.warn('Sync worker push failed, preserved in queue for retry:', err)
        this.setStatus(this.classifyError(err))
        this.scheduleRetry()
        break
      }
    }

    if (
      !this.hasPendingChanges() &&
      !this.isDestroyed &&
      this.status !== 'error' &&
      this.status !== 'offline' &&
      this.status !== 'permission_denied'
    ) {
      this.setStatus('synced')
    }
  }

  /**
   * Schedule automatic retry with exponential backoff and jitter.
   */
  scheduleRetry() {
    if (this.isDestroyed || !this.isOnline) return

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    const baseDelay = Math.min(30000, 1000 * Math.pow(2, this.retryAttempt))
    const jitter = Math.floor(Math.random() * (baseDelay * 0.2))
    const delay = baseDelay + jitter

    this.retryAttempt += 1

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (!this.isDestroyed && this.hasPendingChanges() && this.isOnline) {
        this.flushPendingSync()
      }
    }, delay)
  }

  /**
   * Flush any queued unsynced mutations to Cloud Firestore.
   * Joins the serialized single-flight worker.
   */
  async flushPendingSync(fallbackState = null) {
    if (this.isDestroyed) return

    if (fallbackState && !this.getPendingQueue()) {
      this.setPendingQueue(normalizeState(fallbackState))
    }

    if (!this.hasPendingChanges()) {
      this.setStatus('synced')
      return
    }

    if (!this.isOnline) {
      this.setStatus('offline')
      return
    }

    return this._scheduleSyncWorker()
  }

  /**
   * Start listening to Firestore real-time updates with conflict resolution.
   */
  startListening(onInitialLoadComplete) {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore()
    }

    this.setStatus('connecting')

    let initialHandled = false
    this.unsubscribeFirestore = subscribeUserData(
      this.userId,
      (remoteData, fromCache) => {
        if (this.isDestroyed) return

        if (!initialHandled) {
          initialHandled = true
          if (onInitialLoadComplete) onInitialLoadComplete()
        }

        if (!remoteData) {
          // No document yet in cloud
          const pending = this.getPendingQueue()
          if (pending) {
            this.flushPendingSync()
          } else {
            const initial =
              typeof this.getCurrentState === 'function' ? this.getCurrentState() : null
            if (
              initial &&
              (Number(initial.balance) > 0 ||
                (initial.transactions?.length || 0) > 0 ||
                (initial.loans?.length || 0) > 0)
            ) {
              this.syncMutation(initial)
            } else {
              this.setStatus('synced')
            }
          }
          return
        }

        const normalizedRemote = normalizeState(remoteData)
        const remoteSig = this._getStateSignature(normalizedRemote)

        // 1. Echo suppression: if snapshot matches what we just successfully pushed, ignore
        if (this.lastPushedSignature && this.lastPushedSignature === remoteSig) {
          if (!this.hasPendingChanges()) {
            this.setStatus('synced')
          }
          return
        }

        // 2. Pending queue match: if snapshot matches current pending state, avoid duplicate push
        const pending = this.getPendingQueue()
        if (pending && this._isStateEqual(pending, normalizedRemote)) {
          if (!this.isPushing) {
            this.setPendingQueue(null)
            this.setStatus('synced')
          }
          return
        }

        // Local state reference (pending queue or in-memory current state)
        const localCurrent =
          pending || (typeof this.getCurrentState === 'function' ? this.getCurrentState() : null)

        // 3. Conflict resolution when local mutations are pending:
        if (this.hasPendingChanges()) {
          const hasRemoteDelta = this._hasNewRemoteContent(pending, normalizedRemote)
          if (!hasRemoteDelta) {
            // No new remote content (e.g. older snapshot or local echo)
            return
          }

          // True concurrent conflict: reconcile local pending with remote
          const merged = reconcileStates(pending, normalizedRemote, {
            lastSyncedAt: this.getLastSyncedAt(),
          })
          this.setPendingQueue(merged)
          this._scheduleSyncWorker()
          if (this.onStateUpdated) {
            this.onStateUpdated(merged)
          }
          return
        }

        // 4. Remote snapshot check when no local mutations are pending in queue:
        if (localCurrent) {
          const remoteTime = new Date(normalizedRemote.updatedAt || 0).getTime()
          const localTime = new Date(localCurrent.updatedAt || 0).getTime()

          if (remoteTime < localTime) {
            const hasRemoteDelta = this._hasNewRemoteContent(localCurrent, normalizedRemote)
            if (!hasRemoteDelta) {
              // Stale remote snapshot: reject to prevent overwriting newer local state
              return
            }

            // Stale remote snapshot WITH meaningful new delta:
            // NEVER replace newer local state! Reconcile them using established architecture.
            const merged = reconcileStates(localCurrent, normalizedRemote, {
              lastSyncedAt: this.getLastSyncedAt(),
            })

            if (this._isStateEqual(localCurrent, merged)) {
              return
            }

            // Persist, queue for push, and update UI
            this.setPendingQueue(merged)
            this._scheduleSyncWorker()
            if (this.onStateUpdated) {
              this.onStateUpdated(merged)
            }
            return
          }

          // If remote is newer or equal, check if local has any local-only changes not in remote:
          const remoteTxSet = new Set((normalizedRemote.transactions || []).map((t) => t.id))
          const hasLocalOnlyTx = (localCurrent.transactions || []).some((t) => !remoteTxSet.has(t.id))
          if (hasLocalOnlyTx) {
            const merged = reconcileStates(localCurrent, normalizedRemote, {
              lastSyncedAt: this.getLastSyncedAt(),
            })
            if (!this._isStateEqual(localCurrent, merged)) {
              this.setPendingQueue(merged)
              this._scheduleSyncWorker()
              if (this.onStateUpdated) {
                this.onStateUpdated(merged)
              }
              return
            }
          }
        }

        // Remote data is confirmed and valid: record sync timestamp, notify UI
        this.setLastSyncedAt(new Date().toISOString())
        this.setStatus('synced')
        if (this.onStateUpdated) {
          this.onStateUpdated(normalizedRemote)
        }
      },
      (err) => {
        if (this.isDestroyed) return
        console.warn('Realtime listener error:', err)
        this.setStatus(this.classifyError(err))
        if (!initialHandled) {
          initialHandled = true
          if (onInitialLoadComplete) onInitialLoadComplete()
        }
      }
    )
  }

  destroy() {
    this.isDestroyed = true

    if (this.unsubscribeFirestore) {
      try {
        this.unsubscribeFirestore()
      } catch (e) {
        console.warn('Error unsubscribing Firestore:', e)
      }
      this.unsubscribeFirestore = null
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    if (typeof window !== 'undefined') {
      if (this.handleOnline) {
        window.removeEventListener('online', this.handleOnline)
        this.handleOnline = null
      }
      if (this.handleOffline) {
        window.removeEventListener('offline', this.handleOffline)
        this.handleOffline = null
      }
    }
  }
}
