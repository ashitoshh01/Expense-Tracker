import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  initializeAuth,
  subscribeAuthState,
  signInWithGoogle,
  signOutUser,
  updateUserProfileName,
} from './services/auth'
import { SyncManager } from './services/syncManager'
import {
  checkFirestoreConnection,
  fetchFreshFromServer,
  forcePushToCloud,
} from './firebase'
import {
  normalizeState,
  recordIncome,
  recordExpense,
  recordSavingsDeposit,
  recordSavingsWithdrawal,
  createLoan,
  repayLoan,
  deleteTransaction,
  editTransaction,
  processRecurringIncomesAutomation,
  processSalaryAutomation,
  DEFAULT_SETTINGS,
} from './domain/accounting'
import {
  calculateMonthlyBreakdown,
  calculateBalanceChangePercent,
} from './domain/metrics'
import { exportToCSV, exportToJSON } from './services/exportImport'
import { formatAmount } from './domain/money'

// Screens
import AuthScreen from './components/screens/AuthScreen'
import HomeScreen from './components/screens/HomeScreen'
import TransactionsScreen from './components/screens/TransactionsScreen'
import AddTransactionScreen from './components/screens/AddTransactionScreen'
import SavingsScreen from './components/screens/SavingsScreen'
import LoansScreen from './components/screens/LoansScreen'
import MoreScreen from './components/screens/MoreScreen'
import BottomNavigation from './components/layout/BottomNavigation'

// Modals
import AddSheet from './components/modals/AddSheet'
import SpentSheet from './components/modals/SpentSheet'
import WithdrawSheet from './components/modals/WithdrawSheet'
import AddSavingsSheet from './components/modals/AddSavingsSheet'
import ExportSheet from './components/modals/ExportSheet'
import InstallAppSheet from './components/modals/InstallAppSheet'
import LoanRepaySheet from './components/modals/LoanRepaySheet'
import SettingsSheet from './components/modals/SettingsSheet'
import HelpSheet from './components/modals/HelpSheet'
import AboutSheet from './components/modals/AboutSheet'
import EditTxSheet from './components/modals/EditTxSheet'

// ─── Scoped State Persistence ────────────────────────────────
const getScopedStorageKey = (uid) => `et_${uid || 'anonymous_local'}_state`

/**
 * Remove obsolete legacy storage keys so unauthenticated test/demo values never pollute new users.
 */
const cleanupLegacyStorage = () => {
  try {
    const legacyKeys = [
      'et_balance',
      'et_savings',
      'et_loans',
      'et_transactions',
      'et_lastSalaryMonth',
      'et_savingsGoal',
    ]
    legacyKeys.forEach((k) => localStorage.removeItem(k))
  } catch {}
}

/**
 * Load state for a user.
 * Guarantees zero hardcoded values: any new account starts strictly with 0 values.
 */
const loadInitialState = (uid) => {
  cleanupLegacyStorage()
  if (!uid) return normalizeState({})
  const scopedKey = getScopedStorageKey(uid)
  const existingScoped = localStorage.getItem(scopedKey)

  if (existingScoped) {
    try {
      return normalizeState(JSON.parse(existingScoped))
    } catch (e) {
      console.warn('Failed parsing scoped state:', e)
    }
  }

  // Brand new user: pristine state with 0 for all balances and empty lists
  return normalizeState({})
}

const persistScopedState = (uid, state) => {
  try {
    const key = getScopedStorageKey(uid)
    localStorage.setItem(key, JSON.stringify(state))
  } catch (e) {
    console.warn('LocalStorage save failed:', e)
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [authUser, setAuthUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [state, setState] = useState(() => loadInitialState('anonymous_local'))
  const [screen, setScreen] = useState('home')
  const [modal, setModal] = useState(null)
  const [activeLoanForRepay, setActiveLoanForRepay] = useState(null)
  const [activeTxForEdit, setActiveTxForEdit] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [cloudStatus, setCloudStatus] = useState('connecting')
  const [dataLoaded, setDataLoaded] = useState(false)

  const toastTimer = useRef(null)
  const dataLoadedRef = useRef(false)
  const syncManagerRef = useRef(null)

  // PWA install state
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    ) {
      setIsInstalled(true)
    }
    const handlePrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const handleInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  // ─── Toast Feedback ─────────────────────────────────────────
  const showToast = useCallback((msg, variant = '') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, variant })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // Mark initial data loading complete
  const markDataLoaded = useCallback(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true
      setDataLoaded(true)
    }
  }, [])

  // ─── Centralized State Mutation Handler ─────────────────────
  const mutateState = useCallback(
    (reducerFn, successMsg = '', toastVariant = '') => {
      setState((prev) => {
        try {
          const next = reducerFn(prev)
          const uid = authUser?.uid || 'anonymous_local'
          persistScopedState(uid, next)
          if (syncManagerRef.current) {
            syncManagerRef.current.syncMutation(next)
          }
          if (successMsg) {
            showToast(successMsg, toastVariant)
          }
          return next
        } catch (err) {
          showToast(err.message || 'Operation failed', 'error')
          return prev
        }
      })
    },
    [authUser?.uid, showToast]
  )

  // ─── Firebase Auth Initialization ─────────────────────────
  useEffect(() => {
    initializeAuth()
      .then((user) => {
        setAuthUser(user)
        setAuthChecking(false)
        if (!user) markDataLoaded()
      })
      .catch((err) => {
        console.warn('Auth initialization fallback:', err)
        setAuthChecking(false)
        markDataLoaded()
      })

    const unsubscribeAuth = subscribeAuthState((user) => {
      setAuthUser(user)
      setAuthChecking(false)
      if (!user) markDataLoaded()
    })

    // Timeout safety: unblock UI after 2.5s if Firestore is slow
    const safetyTimer = setTimeout(() => {
      setAuthChecking(false)
      markDataLoaded()
    }, 2500)

    return () => {
      clearTimeout(safetyTimer)
      unsubscribeAuth()
    }
  }, [markDataLoaded])

  // ─── Isolated Sync & Multi-Tab Synchronization per UID ─────
  useEffect(() => {
    if (!authUser?.uid) return

    const uid = authUser.uid
    const initial = loadInitialState(uid)
    setState(initial)

    const syncMgr = new SyncManager(
      uid,
      (remoteState) => {
        setState(remoteState)
        persistScopedState(uid, remoteState)
      },
      (status) => {
        setCloudStatus(status)
      },
      () => loadInitialState(uid)
    )
    syncManagerRef.current = syncMgr

    syncMgr.startListening(() => {
      markDataLoaded()
    })

    // Synchronize across multiple browser tabs
    const handleStorageChange = (e) => {
      if (e.key === getScopedStorageKey(uid) && e.newValue) {
        try {
          const freshLocal = normalizeState(JSON.parse(e.newValue))
          setState(freshLocal)
        } catch (err) {
          console.warn('Failed parsing multi-tab storage update:', err)
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      syncMgr.destroy()
      if (syncManagerRef.current === syncMgr) {
        syncManagerRef.current = null
      }
    }
  }, [authUser?.uid, markDataLoaded])

  // ─── Idempotent Monthly Recurring Incomes Processing ──────────
  useEffect(() => {
    if (!dataLoaded || !authUser) return

    mutateState((currentState) => {
      const result = processRecurringIncomesAutomation(currentState)
      if (result.processed && result.creditedSources?.length) {
        const summary = result.creditedSources
          .map((s) => `${s.name} (+₹${formatAmount(s.amount)})`)
          .join(', ')
        showToast(
          `Automated Credit: ${summary}${
            result.savedAmount > 0 ? ` (₹${formatAmount(result.savedAmount)} moved to savings)` : ''
          }`,
          'salary'
        )
        return result.state
      }
      return currentState
    })
  }, [dataLoaded, authUser?.uid, mutateState, showToast])

  // ─── Action Handlers ────────────────────────────────────────

  // Add Income / Money
  const handleAdd = ({ amount, from }) => {
    mutateState(
      (s) => recordIncome(s, { amount, category: from ? 'Income' : 'Salary', note: from }),
      `+₹${formatAmount(amount)} added from ${from || 'income'}`,
      'income'
    )
    setModal(null)
  }

  // Record Spending
  const handleSpent = ({ amount, category, note }) => {
    mutateState(
      (s) => recordExpense(s, { amount, category, note }),
      `-₹${formatAmount(amount)} spent on ${category}`,
      'spent'
    )
    setModal(null)
  }

  // Unified Add Transaction
  const handleAddTransaction = ({ type, amount, category, note, date }) => {
    if (type === 'income') {
      mutateState(
        (s) => recordIncome(s, { amount, category, note, date }),
        `+₹${formatAmount(amount)} income recorded`,
        'income'
      )
    } else {
      mutateState(
        (s) => recordExpense(s, { amount, category, note, date }),
        `-₹${formatAmount(amount)} expense recorded`,
        'spent'
      )
    }
    setScreen('transactions')
  }

  // Create Loan (Borrowed or Lent)
  const handleCreateLoan = ({ type, amount, name, dueDate }) => {
    mutateState(
      (s) => createLoan(s, { type, amount, name, dueDate }),
      type === 'borrowed'
        ? `+₹${formatAmount(amount)} borrowed from ${name}`
        : `₹${formatAmount(amount)} lent to ${name}`,
      type === 'borrowed' ? 'income' : 'spent'
    )
    setModal(null)
  }

  // Loan Repayment (Partial or Full)
  const handleLoanRepayment = ({ loanId, amount, note }) => {
    mutateState(
      (s) => repayLoan(s, { loanId, amount, note }),
      `Repayment of ₹${formatAmount(amount)} recorded ✓`,
      'income'
    )
    setModal(null)
    setActiveLoanForRepay(null)
  }

  // Transaction Deletion with Safe Financial Reversal
  const handleDeleteTx = (txId) => {
    const tx = state.transactions.find((t) => t.id === txId)
    if (!tx) return

    setConfirm({
      title: 'Reverse & Delete Transaction?',
      message: `This will reverse the financial effect of this ₹${formatAmount(
        tx.amount
      )} ${tx.category} entry and adjust your balance accordingly.`,
      variant: 'blue',
      onConfirm: () => {
        mutateState(
          (s) => deleteTransaction(s, txId),
          'Transaction reversed and deleted successfully',
          'income'
        )
        setConfirm(null)
      },
    })
  }

  // Transaction Editing with Safe Reversal
  const handleEditTx = (txId, updates) => {
    mutateState(
      (s) => editTransaction(s, txId, updates),
      'Transaction updated successfully',
      'income'
    )
    setModal(null)
    setActiveTxForEdit(null)
  }

  // Withdraw from Savings
  const handleWithdraw = ({ amount }) => {
    mutateState(
      (s) => recordSavingsWithdrawal(s, { amount }),
      `₹${formatAmount(amount)} withdrawn from savings to cash`,
      'income'
    )
    setModal(null)
  }

  // Add to Savings
  const handleAddToSavings = ({ amount }) => {
    mutateState(
      (s) => recordSavingsDeposit(s, { amount }),
      `₹${formatAmount(amount)} deposited into savings`,
      'income'
    )
    setModal(null)
  }

  // Update Savings Goal
  const handleUpdateGoal = (goal) => {
    mutateState(
      (s) => ({ ...s, savingsGoal: Number(goal) }),
      'Savings goal updated'
    )
  }

  // Save Configurable Settings
  const handleSaveSettings = ({ settings, savingsGoal }) => {
    mutateState(
      (s) => ({
        ...s,
        settings: { ...s.settings, ...settings },
        savingsGoal,
      }),
      'Settings saved successfully ✓',
      'income'
    )
  }

  // Import Backup
  const handleImportBackup = (importedState) => {
    setConfirm({
      title: 'Restore Backup Data?',
      message: `This will safely replace your current workspace with the ${importedState.transactions.length} transactions and ₹${formatAmount(
        importedState.balance
      )} balance from the backup.`,
      variant: 'blue',
      onConfirm: () => {
        mutateState(
          () => importedState,
          'Backup data successfully restored! 🎉',
          'income'
        )
        setConfirm(null)
      },
    })
  }

  // Reset all financial data to ₹0
  const handleResetAllData = () => {
    setConfirm({
      title: 'Reset All Financial Data to ₹0?',
      message:
        'This will reset your cash balance, savings, loans, and all transaction history to ₹0. Any existing values will be cleared so you can start completely fresh. Are you sure?',
      variant: 'red',
      onConfirm: () => {
        const freshZeroState = normalizeState({})
        mutateState(
          () => freshZeroState,
          'All financial data reset to ₹0! Fresh account ready.',
          'income'
        )
        setConfirm(null)
        setModal(null)
      },
    })
  }

  // Export handlers
  const handleExportCSV = () => {
    try {
      exportToCSV(state.transactions)
      showToast('CSV file exported successfully ✓', 'income')
      setModal(null)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleExportJSON = () => {
    try {
      exportToJSON(state)
      showToast('JSON backup exported successfully ✓', 'income')
      setModal(null)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // Google Sign-In & Sign-Out
  const handleSignInGoogle = async () => {
    try {
      showToast('Signing in with Google...')
      const user = await signInWithGoogle()
      setAuthUser(user)
      showToast(`Welcome, ${user.displayName || user.email}! 🎉`, 'income')
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        showToast(e.message || 'Google sign-in failed', 'error')
      }
    }
  }

  // Update User Display Name
  const handleUpdateUserName = async (newName) => {
    try {
      const updated = await updateUserProfileName(newName)
      if (updated) {
        setAuthUser({
          ...updated,
          displayName: newName.trim(),
        })
        showToast(`Name updated to "${newName.trim()}"! ✓`, 'income')
      }
    } catch (err) {
      showToast(err.message || 'Failed to update name', 'error')
    }
  }

  const handleSignOut = () => {
    setConfirm({
      title: 'Sign Out?',
      message:
        'Your local and cloud financial records remain completely preserved. You will switch to a clean local session.',
      variant: '',
      onConfirm: async () => {
        try {
          const freshUser = await signOutUser()
          setAuthUser(freshUser)
          setConfirm(null)
          showToast('Signed out successfully. Data preserved.', 'income')
        } catch (e) {
          showToast(e.message, 'error')
        }
      },
    })
  }

  // Cloud Maintenance Actions
  const handleManualSync = async () => {
    setCloudStatus('saving')
    showToast('Checking isolated Firestore connection...')
    if (syncManagerRef.current) {
      await syncManagerRef.current.flushPendingSync()
    }
  }

  const handlePushToCloud = async () => {
    setCloudStatus('saving')
    showToast('Uploading isolated state to Cloud Firestore...')
    try {
      const uid = authUser?.uid || 'anonymous_local'
      await forcePushToCloud(uid, state)
      setCloudStatus('synced')
      showToast('Data uploaded to Firebase Cloud! ✓', 'income')
    } catch (err) {
      setCloudStatus('error')
      showToast('Push failed: ' + (err?.message || 'network error'), 'error')
    }
  }

  const handleFetchFreshFromCloud = async () => {
    setCloudStatus('saving')
    showToast('Fetching fresh data from Firebase server...')
    try {
      const uid = authUser?.uid || 'anonymous_local'
      const freshData = await fetchFreshFromServer(uid)
      if (freshData) {
        mutateState(() => normalizeState(freshData), 'Fresh cloud data loaded! ✓', 'income')
        setCloudStatus('synced')
      } else {
        showToast('No cloud data yet for this user. Push local data first.', 'error')
        setCloudStatus('synced')
      }
    } catch (err) {
      setCloudStatus('error')
      showToast('Fetch failed: ' + (err?.message || 'network error'), 'error')
    }
  }

  const handleClearLocalCache = () => {
    setConfirm({
      title: 'Clear Local Cache?',
      message:
        'This clears browser cache to verify fresh fetch from Firebase Cloud. Your data in the cloud is not affected.',
      variant: 'blue',
      onConfirm: () => {
        const uid = authUser?.uid || 'anonymous_local'
        localStorage.removeItem(getScopedStorageKey(uid))
        setConfirm(null)
        showToast('Local cache cleared! Re-fetching...')
        handleFetchFreshFromCloud()
      },
    })
  }

  // ─── Honest Analytics Computations ──────────────────────────
  const now = new Date()
  const cm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const pmDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const pm = `${pmDate.getFullYear()}-${String(pmDate.getMonth() + 1).padStart(2, '0')}`

  const currentMonthData = useMemo(
    () => calculateMonthlyBreakdown(state.transactions, cm),
    [state.transactions, cm]
  )
  const prevMonthData = useMemo(
    () => calculateMonthlyBreakdown(state.transactions, pm),
    [state.transactions, pm]
  )

  const currentNet = currentMonthData.externalIncome - currentMonthData.externalSpent
  const prevNet = prevMonthData.externalIncome - prevMonthData.externalSpent
  const balanceChangePercent = useMemo(
    () => calculateBalanceChangePercent(currentNet, prevNet),
    [currentNet, prevNet]
  )

  const savingsTxs = useMemo(
    () =>
      state.transactions.filter(
        (t) =>
          t.type === 'savings_deposit' ||
          t.type === 'savings_withdraw' ||
          t.type === 'auto_save'
      ),
    [state.transactions]
  )

  // ─── Loading / Auth Gate ────────────────────────────────────
  if (authChecking) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <img src="/apple-touch-icon.png" alt="Wallet FIX" className="loading-logo" />
          <div className="loading-brand">
            <span className="brand-name-wallet">Wallet</span>
            <span className="brand-name-fix">FIX</span>
          </div>
          <div className="loading-spinner"></div>
          <p className="loading-text">Initializing Wallet FIX...</p>
        </div>
      </div>
    )
  }

  if (!authUser) {
    return (
      <AuthScreen
        onSignInSuccess={(user) => {
          setAuthUser(user)
          setAuthChecking(false)
        }}
      />
    )
  }

  if (!dataLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <img src="/apple-touch-icon.png" alt="Wallet FIX" className="loading-logo" />
          <div className="loading-brand">
            <span className="brand-name-wallet">Wallet</span>
            <span className="brand-name-fix">FIX</span>
          </div>
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading your financial data...</p>
        </div>
      </div>
    )
  }

  // ─── Render Screens ─────────────────────────────────────────
  return (
    <>
      <div className="app-container">
        {screen === 'home' && (
          <HomeScreen
            state={state}
            monthlyEarned={currentMonthData.externalIncome}
            monthlySpent={currentMonthData.externalSpent}
            balanceChangePercent={balanceChangePercent}
            onNavigate={setScreen}
            onAddMoney={() => setModal('add')}
            onAddExpense={() => setModal('spent')}
            cloudStatus={cloudStatus}
            onCloudClick={handleManualSync}
            onRetryCloud={() => checkFirestoreConnection(authUser?.uid)}
            authUser={authUser}
            onUpdateName={handleUpdateUserName}
          />
        )}
        {screen === 'transactions' && (
          <TransactionsScreen
            transactions={state.transactions}
            onNavigate={setScreen}
            onDeleteTx={handleDeleteTx}
            onEditTx={(tx) => {
              setActiveTxForEdit(tx)
              setModal('editTx')
            }}
          />
        )}
        {screen === 'addTx' && (
          <AddTransactionScreen
            onSubmit={handleAddTransaction}
            onBack={() => setScreen('transactions')}
          />
        )}
        {screen === 'savings' && (
          <SavingsScreen
            state={state}
            savingsTxs={savingsTxs}
            onUpdateGoal={handleUpdateGoal}
            onAddToSavings={() => setModal('addSavings')}
            onWithdraw={() => setModal('withdraw')}
            onNavigate={setScreen}
          />
        )}
        {screen === 'loans' && (
          <LoansScreen
            loans={state.loans}
            onRepaid={(loan) => {
              setActiveLoanForRepay(loan)
              setModal('repayLoan')
            }}
            onAddLoan={() => setModal('addLoan')}
            onNavigate={setScreen}
          />
        )}
        {screen === 'more' && (
          <MoreScreen
            authUser={authUser}
            onNavigate={setScreen}
            onExport={() => setModal('export')}
            onInstallApp={() => setModal('installApp')}
            isInstalled={isInstalled}
            cloudStatus={cloudStatus}
            onManualSync={handleManualSync}
            onOpenSalarySavings={() => setModal('settings')}
            onOpenSettings={() => setModal('settings')}
            onOpenAbout={() => setModal('about')}
            onSignInGoogle={handleSignInGoogle}
            onSignOut={handleSignOut}
            onUpdateName={handleUpdateUserName}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      {screen !== 'addTx' && (
        <BottomNavigation active={screen} onNavigate={setScreen} />
      )}

      {/* Modals & Overlays */}
      <div
        className={`overlay ${modal ? 'active' : ''}`}
        onClick={() => {
          setModal(null)
          setActiveLoanForRepay(null)
          setActiveTxForEdit(null)
        }}
      />

      {modal === 'add' && <AddSheet onSubmit={handleAdd} onClose={() => setModal(null)} />}
      {modal === 'spent' && <SpentSheet onSubmit={handleSpent} onClose={() => setModal(null)} />}
      {modal === 'addLoan' && (
        <AddLoanSheet
          availableBalance={state.balance}
          onSubmit={handleCreateLoan}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'repayLoan' && activeLoanForRepay && (
        <LoanRepaySheet
          loan={activeLoanForRepay}
          availableBalance={state.balance}
          onSubmit={handleLoanRepayment}
          onClose={() => {
            setModal(null)
            setActiveLoanForRepay(null)
          }}
        />
      )}
      {modal === 'editTx' && activeTxForEdit && (
        <EditTxSheet
          tx={activeTxForEdit}
          onSubmit={handleEditTx}
          onClose={() => {
            setModal(null)
            setActiveTxForEdit(null)
          }}
        />
      )}
      {modal === 'withdraw' && (
        <WithdrawSheet
          maxAmount={state.savings}
          onSubmit={handleWithdraw}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'addSavings' && (
        <AddSavingsSheet
          maxAmount={state.balance}
          onSubmit={handleAddToSavings}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'settings' && (
        <SettingsSheet
          settings={state.settings}
          savingsGoal={state.savingsGoal}
          onSave={handleSaveSettings}
          onImportBackup={handleImportBackup}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'help' && <HelpSheet onClose={() => setModal(null)} />}
      {modal === 'about' && <AboutSheet onClose={() => setModal(null)} />}
      {modal === 'export' && (
        <ExportSheet
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'installApp' && (
        <InstallAppSheet
          installPrompt={deferredPrompt}
          isInstalled={isInstalled}
          onClose={() => setModal(null)}
          onInstallSuccess={() => {
            showToast('App shortcut added successfully! 🎉', 'income')
            setIsInstalled(true)
          }}
        />
      )}

      {/* Confirmation Dialog */}
      <div className={`overlay ${confirm ? 'active' : ''}`} onClick={() => setConfirm(null)} />
      {confirm && (
        <div className="confirm-dialog active">
          <h3>{confirm.title}</h3>
          <p>{confirm.message}</p>
          <div className="confirm-actions">
            <button className="confirm-cancel" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className={`confirm-ok ${confirm.variant || ''}`}
              onClick={confirm.onConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`toast ${toast ? 'show' : ''} ${toast?.variant || ''}`}>
        {toast?.msg}
      </div>
    </>
  )
}
