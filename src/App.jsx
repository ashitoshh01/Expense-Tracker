import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Home, Receipt, PiggyBank, Menu, Search, ChevronRight,
  Plus, Minus, Wallet, TrendingUp, TrendingDown, ArrowLeft,
  Calendar, Trash2, DollarSign, ShoppingCart, Utensils, Plane,
  Building2, Heart, GraduationCap, MoreHorizontal, Eye,
  Landmark, Download, Settings, HelpCircle, Info, LogOut,
  Tag, FileText, FileJson, AlertCircle, Target, ArrowDownToLine,
  CircleDollarSign, CreditCard, X, Smartphone,
  Cloud, CloudCheck, CloudOff, Database, RefreshCw,
  UploadCloud, DownloadCloud, ExternalLink
} from 'lucide-react'
import {
  subscribeUserData,
  saveUserData,
  checkFirestoreConnection,
  fetchFreshFromServer,
  forcePushToCloud,
  firebaseConfig
} from './firebase'

// ─── Helpers ────────────────────────────────────────────────
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatAmount = (n) => {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?')

const todayStr = () => {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

const currentYearMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const getMonthName = () => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const getShortMonth = () => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

// ─── localStorage persistence ───────────────────────────────
const KEYS = {
  balance: 'et_balance',
  savings: 'et_savings',
  loans: 'et_loans',
  transactions: 'et_transactions',
  lastSalaryMonth: 'et_lastSalaryMonth',
  savingsGoal: 'et_savingsGoal',
}

const loadState = () => ({
  balance: Number(localStorage.getItem(KEYS.balance)) || 0,
  savings: Number(localStorage.getItem(KEYS.savings)) || 0,
  loans: JSON.parse(localStorage.getItem(KEYS.loans) || '[]'),
  transactions: JSON.parse(localStorage.getItem(KEYS.transactions) || '[]'),
  lastSalaryMonth: localStorage.getItem(KEYS.lastSalaryMonth) || '',
  savingsGoal: Number(localStorage.getItem(KEYS.savingsGoal)) || 1000,
})

const persist = (key, value) => {
  if (typeof value === 'object') {
    localStorage.setItem(KEYS[key], JSON.stringify(value))
  } else {
    localStorage.setItem(KEYS[key], String(value))
  }
}

// ─── Categories ───────────────────────────────────────────
const SPEND_CATEGORIES = [
  'Outside Food',
  'Material from me/friend',
  'Give friend money',
  'Other',
]

const ALL_CATEGORIES = [
  { id: 'Salary', name: 'Salary', icon: CircleDollarSign, type: 'income' },
  { id: 'Shopping', name: 'Shopping', icon: ShoppingCart, type: 'expense' },
  { id: 'Outside Food', name: 'Food', icon: Utensils, type: 'expense' },
  { id: 'Travel', name: 'Travel', icon: Plane, type: 'expense' },
  { id: 'Rent', name: 'Rent', icon: Building2, type: 'expense' },
  { id: 'Health', name: 'Health', icon: Heart, type: 'expense' },
  { id: 'Material from me/friend', name: 'Education', icon: GraduationCap, type: 'expense' },
  { id: 'Other', name: 'Other', icon: MoreHorizontal, type: 'expense' },
]

const getCategoryIcon = (category) => {
  const cat = ALL_CATEGORIES.find(c => c.id === category)
  if (cat) return cat.icon
  if (category === 'Loan') return Landmark
  if (category === 'Savings') return PiggyBank
  if (category === 'Give friend money') return CreditCard
  return Receipt
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [state, setState] = useState(loadState)
  const [screen, setScreen] = useState('home') // home | transactions | savings | more | addTx | loans
  const [modal, setModal] = useState(null) // 'add' | 'spent' | 'withdraw' | 'export' | 'addSavings' | null
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const toastTimer = useRef(null)
  const [dataLoaded, setDataLoaded] = useState(false) // blocks auto-salary until cloud data arrives
  const dataLoadedRef = useRef(false) // ref to avoid stale closure issues

  // ─── PWA & Install Shortcut ──────────────────────────────────
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
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

  // ─── Firebase Database Synchronization ───────────────────────
  const [cloudStatus, setCloudStatus] = useState('connecting') // 'connecting' | 'synced' | 'saving' | 'not_created' | 'error'

  // Helper: merge cloud data into state and persist to localStorage
  const hydrateFromCloud = useCallback((cloudData) => {
    setState((prev) => {
      const merged = {
        balance: typeof cloudData.balance === 'number' ? cloudData.balance : prev.balance,
        savings: typeof cloudData.savings === 'number' ? cloudData.savings : prev.savings,
        loans: Array.isArray(cloudData.loans) ? cloudData.loans : prev.loans,
        transactions: Array.isArray(cloudData.transactions) ? cloudData.transactions : prev.transactions,
        savingsGoal: typeof cloudData.savingsGoal === 'number' ? cloudData.savingsGoal : prev.savingsGoal,
        lastSalaryMonth: cloudData.lastSalaryMonth || prev.lastSalaryMonth,
      }
      Object.keys(merged).forEach((k) => persist(k, merged[k]))
      return merged
    })
  }, [])

  // Mark data as loaded (both ref and state)
  const markDataLoaded = useCallback(() => {
    if (!dataLoadedRef.current) {
      dataLoadedRef.current = true
      setDataLoaded(true)
    }
  }, [])

  // Diagnostic check and cloud hydration (used for manual re-sync too)
  const verifyAndConnectCloud = useCallback(async () => {
    setCloudStatus('connecting')
    try {
      const check = await checkFirestoreConnection()
      if (!check.ok) {
        if (check.notCreated) {
          setCloudStatus('not_created')
        } else {
          setCloudStatus('error')
        }
        // Even if cloud failed, mark data loaded so app can work offline with localStorage
        markDataLoaded()
        return
      }

      // Firestore database exists!
      if (check.exists && check.data) {
        hydrateFromCloud(check.data)
        setCloudStatus('synced')
      } else {
        // Document doesn't exist in Firestore yet — only push if we already loaded
        // (prevents pushing empty/default state on first load)
        if (dataLoadedRef.current) {
          try {
            // Use functional setState to get current state for push
            setState((currentState) => {
              forcePushToCloud(currentState).catch(() => {})
              return currentState
            })
            setCloudStatus('synced')
          } catch (err) {
            setCloudStatus('error')
          }
        } else {
          // First load and no cloud data — just use localStorage defaults
          setCloudStatus('synced')
        }
      }
      markDataLoaded()
    } catch (err) {
      setCloudStatus('error')
      markDataLoaded()
    }
  }, [hydrateFromCloud, markDataLoaded])

  // Initial mount: connect to Firebase, set up real-time listener
  useEffect(() => {
    verifyAndConnectCloud()

    // Safety timeout: if Firebase doesn't respond within 4 seconds,
    // proceed with localStorage data so the app doesn't hang forever
    const safetyTimeout = setTimeout(() => {
      if (!dataLoadedRef.current) {
        console.warn('Firebase timeout — proceeding with local data')
        setCloudStatus('error')
        markDataLoaded()
      }
    }, 4000)

    // Real-time listener for ongoing sync
    const unsubscribe = subscribeUserData(
      (cloudData, fromCache) => {
        if (cloudData && !fromCache) {
          hydrateFromCloud(cloudData)
          setCloudStatus('synced')
          markDataLoaded()
        }
      },
      (err) => {
        const msg = String(err?.message || err)
        if (msg.includes('PERMISSION_DENIED') || msg.includes('Cloud Firestore API has not been used')) {
          setCloudStatus('not_created')
        } else {
          setCloudStatus('error')
        }
        // Even on error, mark loaded so app works offline
        markDataLoaded()
      }
    )
    return () => {
      clearTimeout(safetyTimeout)
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Sync state → localStorage & Cloud Firestore ────────────
  const updateState = useCallback((updates) => {
    setState((prev) => {
      const next = { ...prev, ...updates }
      Object.keys(updates).forEach((k) => persist(k, next[k]))
      setCloudStatus('saving')
      saveUserData(next)
        .then(() => setCloudStatus('synced'))
        .catch((err) => {
          console.warn('Firestore save error:', err)
          const msg = String(err?.message || err)
          if (msg.includes('PERMISSION_DENIED') || msg.includes('Cloud Firestore API has not been used')) {
            setCloudStatus('not_created')
          } else {
            setCloudStatus('error')
          }
        })
      return next
    })
  }, [])

  const handleManualSync = async () => {
    setCloudStatus('saving')
    showToast('Checking Firebase Cloud Database...')
    await verifyAndConnectCloud()
  }

  const handlePushToCloud = async () => {
    setCloudStatus('saving')
    showToast('Uploading all data directly to Firebase...')
    try {
      await forcePushToCloud(state)
      setCloudStatus('synced')
      showToast('Data uploaded to Firebase Cloud! ✓', 'income')
    } catch (err) {
      const msg = String(err?.message || err)
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Cloud Firestore API has not been used')) {
        setCloudStatus('not_created')
        showToast('Firestore not created yet in Firebase Console', 'error')
      } else {
        setCloudStatus('error')
        showToast('Push failed: ' + (err?.message || 'network error'), 'error')
      }
    }
  }

  const handleFetchFreshFromCloud = async () => {
    setCloudStatus('saving')
    showToast('Fetching fresh data from Firebase server...')
    try {
      const freshData = await fetchFreshFromServer()
      if (freshData) {
        setState((prev) => {
          const merged = {
            balance: typeof freshData.balance === 'number' ? freshData.balance : prev.balance,
            savings: typeof freshData.savings === 'number' ? freshData.savings : prev.savings,
            loans: Array.isArray(freshData.loans) ? freshData.loans : prev.loans,
            transactions: Array.isArray(freshData.transactions) ? freshData.transactions : prev.transactions,
            savingsGoal: typeof freshData.savingsGoal === 'number' ? freshData.savingsGoal : prev.savingsGoal,
            lastSalaryMonth: freshData.lastSalaryMonth || prev.lastSalaryMonth,
          }
          Object.keys(merged).forEach((k) => persist(k, merged[k]))
          return merged
        })
        setCloudStatus('synced')
        showToast('Loaded fresh data from Firebase Cloud! ✓', 'income')
      } else {
        showToast('No cloud data yet. Push local data first.', 'error')
        setCloudStatus('synced')
      }
    } catch (err) {
      const msg = String(err?.message || err)
      if (msg.includes('PERMISSION_DENIED') || msg.includes('Cloud Firestore API has not been used')) {
        setCloudStatus('not_created')
        showToast('Firestore not created yet in Firebase Console', 'error')
      } else {
        setCloudStatus('error')
        showToast('Fetch failed: ' + (err?.message || 'network error'), 'error')
      }
    }
  }

  const handleClearLocalCache = () => {
    setConfirm({
      title: 'Clear Local Cache?',
      message: 'This clears the browser cache so you can verify data fetched directly from Firebase.',
      variant: 'blue',
      onConfirm: () => {
        Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
        setConfirm(null)
        showToast('Local cache cleared! Re-connecting to cloud...')
        verifyAndConnectCloud()
      }
    })
  }

  // ─── Auto salary logic (ONLY runs after dataLoaded is true) ──
  useEffect(() => {
    if (!dataLoaded) return // Wait for Firebase data to load first!

    const today = new Date()
    const cm = currentYearMonth()
    // Use functional setState to read the LATEST state after Firebase hydration
    setState((currentState) => {
      if (today.getDate() >= 5 && currentState.lastSalaryMonth !== cm) {
        const salaryTx = {
          id: genId(),
          type: 'salary',
          category: 'Salary',
          amount: 2000,
          note: 'Salary',
          date: todayStr(),
        }
        const savingsTx = {
          id: genId(),
          type: 'auto_save',
          category: 'Savings',
          amount: 500,
          note: 'Auto-saved from salary',
          date: todayStr(),
        }
        const next = {
          ...currentState,
          balance: currentState.balance + 2000 - 500,
          savings: currentState.savings + 500,
          transactions: [savingsTx, salaryTx, ...currentState.transactions],
          lastSalaryMonth: cm,
        }
        // Persist to localStorage and cloud
        Object.keys(next).forEach((k) => {
          if (KEYS[k]) persist(k, next[k])
        })
        setCloudStatus('saving')
        saveUserData(next)
          .then(() => setCloudStatus('synced'))
          .catch(() => setCloudStatus('error'))
        showToast('Salary ₹2,000 credited! ₹500 moved to savings.', 'salary')
        return next
      }
      return currentState // No change
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded])

  // ─── Toast ──────────────────────────────────────────────────
  const showToast = (msg, variant = '') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, variant })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  // ─── Add Amount (Loan) ─────────────────────────────────────
  const handleAdd = ({ amount, from }) => {
    const amt = Number(amount)
    const loan = { id: genId(), name: from, amount: amt, date: todayStr() }
    const tx = {
      id: genId(),
      type: 'add',
      category: 'Loan',
      amount: amt,
      note: from,
      date: todayStr(),
    }
    updateState({
      balance: state.balance + amt,
      loans: [loan, ...state.loans],
      transactions: [tx, ...state.transactions],
    })
    setModal(null)
    showToast(`+₹${formatAmount(amt)} added from ${from}`)
  }

  // ─── Spent ─────────────────────────────────────────────────
  const handleSpent = ({ amount, category, note }) => {
    const amt = Number(amount)
    const tx = {
      id: genId(),
      type: 'spent',
      category,
      amount: amt,
      note: note || '',
      date: todayStr(),
    }
    updateState({
      balance: state.balance - amt,
      transactions: [tx, ...state.transactions],
    })
    setModal(null)
    showToast(`-₹${formatAmount(amt)} spent on ${category}`)
  }

  // ─── Add Transaction (unified) ─────────────────────────────
  const handleAddTransaction = ({ type, amount, category, note, date }) => {
    const amt = Number(amount)
    if (type === 'income') {
      const tx = {
        id: genId(),
        type: 'add',
        category: category || 'Salary',
        amount: amt,
        note: note || '',
        date: date || todayStr(),
      }
      updateState({
        balance: state.balance + amt,
        transactions: [tx, ...state.transactions],
      })
      showToast(`+₹${formatAmount(amt)} income added`)
    } else {
      const tx = {
        id: genId(),
        type: 'spent',
        category: category || 'Other',
        amount: amt,
        note: note || '',
        date: date || todayStr(),
      }
      updateState({
        balance: state.balance - amt,
        transactions: [tx, ...state.transactions],
      })
      showToast(`-₹${formatAmount(amt)} expense recorded`)
    }
    setScreen('transactions')
  }

  // ─── Mark loan as repaid ────────────────────────────────────
  const handleRepaid = (loanId) => {
    const loan = state.loans.find((l) => l.id === loanId)
    if (!loan) return
    setConfirm({
      title: 'Mark as Repaid?',
      message: `Remove loan of ₹${formatAmount(loan.amount)} from ${loan.name}?`,
      variant: 'blue',
      onConfirm: () => {
        updateState({
          loans: state.loans.filter((l) => l.id !== loanId),
        })
        setConfirm(null)
        showToast(`Loan from ${loan.name} marked as repaid`)
      },
    })
  }

  // ─── Delete transaction ─────────────────────────────────────
  const handleDeleteTx = (txId) => {
    const tx = state.transactions.find((t) => t.id === txId)
    if (!tx) return
    setConfirm({
      title: 'Delete Transaction?',
      message: `This will remove this ${tx.category} entry of ₹${formatAmount(tx.amount)}. Your balance will NOT be adjusted.`,
      variant: '',
      onConfirm: () => {
        updateState({
          transactions: state.transactions.filter((t) => t.id !== txId),
        })
        setConfirm(null)
        showToast('Transaction deleted')
      },
    })
  }

  // ─── Withdraw from savings ──────────────────────────────────
  const handleWithdraw = ({ amount }) => {
    const amt = Number(amount)
    if (amt > state.savings) {
      showToast('Cannot withdraw more than savings balance')
      return
    }
    updateState({
      balance: state.balance + amt,
      savings: state.savings - amt,
    })
    setModal(null)
    showToast(`₹${formatAmount(amt)} withdrawn from savings`)
  }

  // ─── Add to savings ────────────────────────────────────────
  const handleAddToSavings = ({ amount }) => {
    const amt = Number(amount)
    if (amt > state.balance) {
      showToast('Cannot save more than your balance')
      return
    }
    const tx = {
      id: genId(),
      type: 'auto_save',
      category: 'Savings',
      amount: amt,
      note: 'Manually added to savings',
      date: todayStr(),
    }
    updateState({
      balance: state.balance - amt,
      savings: state.savings + amt,
      transactions: [tx, ...state.transactions],
    })
    setModal(null)
    showToast(`₹${formatAmount(amt)} added to savings`)
  }

  // ─── Update savings goal ───────────────────────────────────
  const handleUpdateGoal = (goal) => {
    updateState({ savingsGoal: Number(goal) })
    showToast('Savings goal updated')
  }

  // ─── Export ─────────────────────────────────────────────────
  const exportCSV = () => {
    if (state.transactions.length === 0) {
      showToast('No transactions to export')
      return
    }
    const headers = 'Date,Type,Category,Amount,Note\n'
    const rows = state.transactions
      .map((t) => `${t.date},${t.type},${t.category},${t.amount},"${t.note || ''}"`)
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${todayStr()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setModal(null)
    showToast('CSV exported successfully')
  }

  const exportJSON = () => {
    if (state.transactions.length === 0) {
      showToast('No transactions to export')
      return
    }
    const data = {
      balance: state.balance,
      savings: state.savings,
      loans: state.loans,
      transactions: state.transactions,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses_${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setModal(null)
    showToast('JSON exported successfully')
  }

  // ─── Monthly summary ───────────────────────────────────────
  const cm = currentYearMonth()
  const monthlyTxs = state.transactions.filter((t) => t.date.startsWith(cm))
  const monthlySpent = monthlyTxs
    .filter((t) => t.type === 'spent')
    .reduce((sum, t) => sum + t.amount, 0)
  const monthlyEarned = monthlyTxs
    .filter((t) => t.type === 'add' || t.type === 'salary')
    .reduce((sum, t) => sum + t.amount, 0)

  // ─── Previous month balance for % change ───────────────────
  const prevMonthBalance = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    const pm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const prevTxs = state.transactions.filter(t => t.date.startsWith(pm))
    const earned = prevTxs.filter(t => t.type === 'add' || t.type === 'salary').reduce((s, t) => s + t.amount, 0)
    const spent = prevTxs.filter(t => t.type === 'spent').reduce((s, t) => s + t.amount, 0)
    return earned - spent
  }, [state.transactions])

  const balanceChangePercent = useMemo(() => {
    if (prevMonthBalance === 0) return monthlyEarned > 0 ? 100 : 0
    return (((monthlyEarned - monthlySpent) / Math.abs(prevMonthBalance)) * 100).toFixed(1)
  }, [prevMonthBalance, monthlyEarned, monthlySpent])

  // ─── Savings transactions ──────────────────────────────────
  const savingsTxs = state.transactions.filter(t => t.type === 'auto_save')

  // ─── Navigate ─────────────────────────────────────────────
  const navigate = (s) => {
    setScreen(s)
  }

  // ─── Loading Screen ─────────────────────────────────────────
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
          <p className="loading-text">Loading your data...</p>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <>
      <div className="app-container">
        {screen === 'home' && (
          <HomeScreen
            state={state}
            monthlyEarned={monthlyEarned}
            monthlySpent={monthlySpent}
            balanceChangePercent={balanceChangePercent}
            onNavigate={navigate}
            onAddMoney={() => setModal('add')}
            onAddExpense={() => setModal('spent')}
            cloudStatus={cloudStatus}
            onCloudClick={handleManualSync}
            onRetryCloud={verifyAndConnectCloud}
          />
        )}
        {screen === 'transactions' && (
          <TransactionsScreen
            transactions={state.transactions}
            onNavigate={navigate}
            onDeleteTx={handleDeleteTx}
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
            onNavigate={navigate}
          />
        )}
        {screen === 'loans' && (
          <LoansScreen
            loans={state.loans}
            onRepaid={handleRepaid}
            onAddLoan={() => setModal('add')}
            onNavigate={navigate}
          />
        )}
        {screen === 'more' && (
          <MoreScreen
            onNavigate={navigate}
            onExport={() => setModal('export')}
            onInstallApp={() => setModal('installApp')}
            isInstalled={isInstalled}
            cloudStatus={cloudStatus}
            onManualSync={handleManualSync}
            onPushToCloud={handlePushToCloud}
            onFetchFresh={handleFetchFreshFromCloud}
            onClearCache={handleClearLocalCache}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      {screen !== 'addTx' && (
        <BottomNavigation active={screen} onNavigate={navigate} />
      )}

      {/* ── Modals ── */}
      <div className={`overlay ${modal ? 'active' : ''}`} onClick={() => setModal(null)} />

      {modal === 'add' && <AddSheet onSubmit={handleAdd} onClose={() => setModal(null)} />}
      {modal === 'spent' && <SpentSheet onSubmit={handleSpent} onClose={() => setModal(null)} />}
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
      {modal === 'export' && (
        <ExportSheet
          onExportCSV={exportCSV}
          onExportJSON={exportJSON}
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

      {/* ── Confirm Dialog ── */}
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

      {/* ── Toast ── */}
      <div className={`toast ${toast ? 'show' : ''} ${toast?.variant || ''}`}>
        {toast?.msg}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// BOTTOM NAVIGATION
// ═══════════════════════════════════════════════════════════════
function BottomNavigation({ active, onNavigate }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'savings', label: 'Savings', icon: PiggyBank },
    { id: 'more', label: 'More', icon: Menu },
  ]

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.id || (active === 'loans' && tab.id === 'more')
        return (
          <button
            key={tab.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onNavigate(tab.id)}
          >
            <span className="nav-icon">
              <Icon />
            </span>
            <span className="nav-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ state, monthlyEarned, monthlySpent, balanceChangePercent, onNavigate, onAddMoney, onAddExpense, cloudStatus, onCloudClick, onRetryCloud }) {
  const recentTxs = state.transactions.slice(0, 5)

  return (
    <div className="screen">
      {/* Header */}
      <div className="mobile-header">
        <div className="header-brand" onClick={() => onNavigate('more')} role="button" aria-label="Wallet FIX">
          <img src="/apple-touch-icon.png" alt="Wallet FIX" className="header-brand-logo" />
          <div className="header-brand-title">
            <span className="brand-name-wallet">Wallet</span>
            <span className="brand-name-fix">FIX</span>
          </div>
        </div>
        <div className="mobile-header-right">
          <button
            className={`cloud-badge ${cloudStatus || 'synced'}`}
            onClick={onCloudClick}
            aria-label={`Database status: ${cloudStatus}`}
            title={`Firebase Database: ${cloudStatus === 'synced' ? 'Synced with Cloud Firestore' : cloudStatus === 'saving' ? 'Saving to Firestore...' : cloudStatus === 'connecting' ? 'Connecting...' : 'Database not created yet'}`}
          >
            {cloudStatus === 'synced' && <CloudCheck size={16} />}
            {cloudStatus === 'saving' && <RefreshCw size={14} className="spin-icon" />}
            {cloudStatus === 'connecting' && <Cloud size={16} />}
            {cloudStatus === 'not_created' && <CloudOff size={16} />}
            {cloudStatus === 'error' && <CloudOff size={16} />}
          </button>
          <div className="header-avatar" onClick={() => onNavigate('more')} style={{ cursor: 'pointer' }}>AL</div>
        </div>
      </div>

      {/* Cloud Firestore Setup Notice if not created in Firebase console */}
      {cloudStatus === 'not_created' && (
        <div className="firestore-setup-banner">
          <div className="setup-banner-top">
            <span className="setup-badge">Action Required</span>
            <span className="setup-badge-sub">Firebase Console</span>
          </div>
          <div className="setup-banner-title">Activate Cloud Firestore Database</div>
          <p className="setup-banner-desc">
            Your Firebase project <strong>expense-b7fcb</strong> is connected, but Cloud Firestore database has not been created yet in the Firebase Console.
          </p>
          <div className="setup-banner-steps">
            <div className="setup-step-row">
              <span className="setup-step-num">1</span>
              <span>Open Firebase Console and click <strong>Create database</strong></span>
            </div>
            <div className="setup-step-row">
              <span className="setup-step-num">2</span>
              <span>Choose <strong>Start in test mode</strong> and click Enable</span>
            </div>
          </div>
          <div className="setup-banner-buttons">
            <a
              href="https://console.firebase.google.com/project/expense-b7fcb/firestore"
              target="_blank"
              rel="noopener noreferrer"
              className="setup-action-link"
            >
              Open Firebase Console <ExternalLink size={14} />
            </a>
            <button className="setup-action-retry" onClick={onRetryCloud}>
              <RefreshCw size={14} /> Test Connection
            </button>
          </div>
        </div>
      )}

      {/* Greeting */}
      <div className="greeting-section">
        <div className="greeting-sub">{getGreeting()}</div>
        <div className="greeting-name">Ashitosh 👋</div>
        <div className="greeting-message">Let's make today a great financial day!</div>
      </div>

      {/* Balance Card */}
      <div className="balance-card">
        <div className="balance-left">
          <div className="balance-label">
            <Eye size={14} />
            Available Balance
          </div>
          <div className={`balance-amount ${state.balance < 0 ? 'negative' : ''}`}>
            <span className="balance-rupee">₹</span>
            {formatAmount(Math.abs(state.balance))}
          </div>
          <div className={`balance-change ${Number(balanceChangePercent) < 0 ? 'negative-change' : ''}`}>
            {Number(balanceChangePercent) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Number(balanceChangePercent) >= 0 ? '+' : ''}{balanceChangePercent}% from last month
          </div>
        </div>
        <div className="balance-right">
          <Wallet />
        </div>
      </div>

      {/* Action Cards */}
      <div className="action-cards">
        <button className="action-card income" onClick={onAddMoney}>
          <div className="action-card-icon">
            <Plus />
          </div>
          <div>
            <div className="action-card-title">Add Money</div>
            <div className="action-card-sub">Income / Deposit</div>
          </div>
        </button>
        <button className="action-card expense" onClick={onAddExpense}>
          <div className="action-card-icon">
            <Minus />
          </div>
          <div>
            <div className="action-card-title">Add Expense</div>
            <div className="action-card-sub">Track Spending</div>
          </div>
        </button>
      </div>

      {/* This Month */}
      <MonthlySummary
        earned={monthlyEarned}
        spent={monthlySpent}
      />

      {/* Quick Stats */}
      <div className="quick-stats-section">
        <div className="quick-stats-title">Quick Stats</div>
        <div className="quick-stats-grid">
          <div className="quick-stat-item">
            <div className="quick-stat-label">Total Savings</div>
            <div className="quick-stat-value green">₹{formatAmount(state.savings)}</div>
          </div>
          <div className="quick-stat-item">
            <div className="quick-stat-label">Transactions</div>
            <div className="quick-stat-value accent">{state.transactions.length}</div>
          </div>
          <div className="quick-stat-item">
            <div className="quick-stat-label">Active Loans</div>
            <div className="quick-stat-value">{state.loans.length}</div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {recentTxs.length > 0 && (
        <div className="recent-section">
          <div className="recent-header">
            <div className="recent-title">Recent Transactions</div>
            <button className="recent-view-all" onClick={() => onNavigate('transactions')}>
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="tx-list">
            {recentTxs.map((tx) => (
              <TransactionItem key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MONTHLY SUMMARY COMPONENT
// ═══════════════════════════════════════════════════════════════
function MonthlySummary({ earned, spent }) {
  return (
    <div className="month-card">
      <div className="month-card-header">
        <div className="month-card-title">
          <Calendar size={18} />
          This Month
        </div>
        <div className="month-card-period">
          {getShortMonth()} <ChevronRight size={14} />
        </div>
      </div>
      <div className="month-stats">
        <div>
          <div className="month-stat-label">Income</div>
          <div className="month-stat-value income">₹{formatAmount(earned)}</div>
        </div>
        <div>
          <div className="month-stat-label">Expenses</div>
          <div className="month-stat-value expense">₹{formatAmount(spent)}</div>
        </div>
      </div>
      {earned >= spent ? (
        <div className="month-message">
          <TrendingUp />
          You're spending less than you earn! 🎉
        </div>
      ) : (
        <div className="month-message warning">
          <TrendingDown />
          You're spending more than you earn!
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTION ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════
function TransactionItem({ tx, showDate, showDelete, onDelete }) {
  const Icon = getCategoryIcon(tx.category)
  const iconClass = tx.type === 'add' ? 'add' : tx.type === 'spent' ? 'spent' : tx.type === 'salary' ? 'salary' : 'savings'

  return (
    <div className="tx-item">
      <div className={`tx-icon-wrap ${iconClass}`}>
        <Icon />
      </div>
      <div className="tx-info">
        <div className="tx-category">{tx.category}</div>
        <div className="tx-note">{tx.note || (tx.type === 'salary' ? 'Salary' : tx.type === 'auto_save' ? 'Auto-saved from salary' : tx.category)}</div>
        {showDate && <div className="tx-meta">{formatDate(tx.date)}</div>}
      </div>
      <div className="tx-right">
        <div className={`tx-amount ${tx.type === 'spent' ? 'negative' : tx.type === 'auto_save' ? 'neutral' : 'positive'}`}>
          {tx.type === 'spent' || tx.type === 'auto_save' ? '−' : '+'}₹{formatAmount(tx.amount)}
        </div>
      </div>
      {showDelete && (
        <button
          className="tx-delete-btn"
          title="Delete transaction"
          onClick={(e) => { e.stopPropagation(); onDelete?.(tx.id); }}
        >
          <Trash2 />
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTIONS SCREEN
// ═══════════════════════════════════════════════════════════════
function TransactionsScreen({ transactions, onNavigate, onDeleteTx }) {
  const [filter, setFilter] = useState('all')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTxs = useMemo(() => {
    let txs = [...transactions]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      txs = txs.filter(t =>
        t.category.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q))
      )
    }

    switch (filter) {
      case 'income':
        return txs.filter(t => t.type === 'add' || t.type === 'salary')
      case 'expenses':
        return txs.filter(t => t.type === 'spent')
      case 'savings':
        return txs.filter(t => t.type === 'auto_save')
      default:
        return txs
    }
  }, [transactions, filter, searchQuery])

  if (showSearch) {
    return (
      <div className="search-overlay">
        <div className="search-header">
          <div className="search-input-wrap">
            <Search size={18} />
            <input
              className="search-input"
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setSearchQuery('')}>
                <X size={16} color="#94A3B8" />
              </button>
            )}
          </div>
          <button className="search-cancel-btn" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
            Cancel
          </button>
        </div>
        <div className="search-results">
          <div className="tx-list">
            {filteredTxs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Search /></div>
                <div className="empty-state-title">No results found</div>
                <div className="empty-state-sub">Try a different search term</div>
              </div>
            ) : (
              filteredTxs.map(tx => (
                <TransactionItem key={tx.id} tx={tx} showDate onDelete={onDeleteTx} showDelete />
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        <button className="page-header-action" onClick={() => setShowSearch(true)}>
          <Search />
        </button>
      </div>

      {/* Filter Pills */}
      <div className="filter-pills">
        {['all', 'income', 'expenses', 'savings'].map(f => (
          <button
            key={f}
            className={`filter-pill ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Month Group */}
      <div className="month-group-header">{getMonthName()}</div>

      {/* Transaction List */}
      <div className="transactions-list-page">
        {filteredTxs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Receipt /></div>
            <div className="empty-state-title">No transactions yet</div>
            <div className="empty-state-sub">Start tracking your finances</div>
          </div>
        ) : (
          filteredTxs.map(tx => (
            <TransactionItem key={tx.id} tx={tx} showDate onDelete={onDeleteTx} showDelete />
          ))
        )}
      </div>

      {/* Add Transaction Button */}
      <div className="fab-container">
        <button className="fab-btn" onClick={() => onNavigate('addTx')}>
          <Plus size={20} />
          Add Transaction
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADD TRANSACTION SCREEN
// ═══════════════════════════════════════════════════════════════
function AddTransactionScreen({ onSubmit, onBack }) {
  const [txType, setTxType] = useState('income')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Salary')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayStr())
  const [errors, setErrors] = useState({})

  const categories = txType === 'income'
    ? ALL_CATEGORIES.filter(c => c.type === 'income')
    : ALL_CATEGORIES.filter(c => c.type === 'expense')

  useEffect(() => {
    setCategory(txType === 'income' ? 'Salary' : 'Outside Food')
  }, [txType])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      onSubmit({ type: txType, amount, category, note, date })
    }
  }

  return (
    <div className="screen add-tx-screen">
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={22} />
          </button>
          <h1 className="page-title">Add Transaction</h1>
        </div>
      </div>

      {/* Type Toggle */}
      <div className="type-toggle">
        <button
          className={`type-toggle-btn income-btn ${txType === 'income' ? 'active' : ''}`}
          onClick={() => setTxType('income')}
        >
          <span className="toggle-icon"><Plus size={16} /></span>
          Income
        </button>
        <button
          className={`type-toggle-btn expense-btn ${txType === 'expense' ? 'active' : ''}`}
          onClick={() => setTxType('expense')}
        >
          <span className="toggle-icon"><Minus size={16} /></span>
          Expense
        </button>
      </div>

      <div className="form-section">
        {/* Amount */}
        <div className="form-group">
          <label className="form-label">Amount</label>
          <div className={`amount-input-wrap ${errors.amount ? 'error' : ''}`}>
            <span className="amount-prefix">₹</span>
            <input
              className="amount-input"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="amount-input-icon">
              <DollarSign />
            </span>
          </div>
          {errors.amount && (
            <div className="form-error">
              <AlertCircle size={14} /> {errors.amount}
            </div>
          )}
        </div>

        {/* Category Grid */}
        <div className="form-group">
          <label className="form-label">Category</label>
          <div className="category-grid">
            {categories.map((cat) => {
              const CatIcon = cat.icon
              return (
                <button
                  key={cat.id}
                  className={`category-item ${category === cat.id ? 'active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                  type="button"
                >
                  <div className="category-icon">
                    <CatIcon />
                  </div>
                  <span className="category-name">{cat.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">
            Description <span className="form-label-optional">(Optional)</span>
          </label>
          <input
            className="form-input"
            type="text"
            placeholder={`e.g. ${txType === 'income' ? 'Salary for September' : 'Lunch at restaurant'}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Date */}
        <div className="form-group">
          <label className="form-label">Date</label>
          <div className="date-input-wrap">
            <Calendar size={20} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="save-btn-container">
        <button className="save-btn" onClick={handleSubmit}>
          <Plus size={20} />
          Save Transaction
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SAVINGS SCREEN
// ═══════════════════════════════════════════════════════════════
function SavingsScreen({ state, savingsTxs, onUpdateGoal, onAddToSavings, onWithdraw, onNavigate }) {
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalValue, setGoalValue] = useState(String(state.savingsGoal))
  const goalPercent = state.savingsGoal > 0 ? Math.min(100, Math.round((state.savings / state.savingsGoal) * 100)) : 0

  const savingsGrowth = useMemo(() => {
    if (savingsTxs.length === 0) return 0
    const totalSaved = savingsTxs.reduce((s, t) => s + t.amount, 0)
    return totalSaved > 0 ? '+100%' : '0%'
  }, [savingsTxs])

  const handleSaveGoal = () => {
    const val = Number(goalValue)
    if (val > 0) {
      onUpdateGoal(val)
      setEditingGoal(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">Savings</h1>
      </div>

      {/* Main Savings Card */}
      <div className="savings-main-card">
        <div className="savings-icon-big">
          <PiggyBank />
        </div>
        <div className="savings-info">
          <div className="savings-label">Total Savings</div>
          <div className="savings-amount-row">
            <div className="savings-amount">₹{formatAmount(state.savings)}</div>
            {state.savings > 0 && (
              <span className="savings-change">{savingsGrowth}</span>
            )}
          </div>
          <div className="savings-message">
            {state.savings > 0 ? 'Good job! Keep saving 🌱' : 'Start saving today!'}
          </div>
        </div>
      </div>

      {/* Savings Goal */}
      <div className="savings-goal-card">
        <div className="goal-header">
          <div className="goal-title">
            <Target size={18} />
            Savings Goal
          </div>
          <span className="goal-arrow"><ChevronRight /></span>
        </div>

        <div className="goal-progress-header">
          <div className="goal-amounts">
            ₹{formatAmount(state.savings)} / <span>₹{formatAmount(state.savingsGoal)}</span>
          </div>
          <div className="goal-percent">{goalPercent}%</div>
        </div>

        <div className="goal-progress-bar">
          <div className="goal-progress-fill" style={{ width: `${goalPercent}%` }} />
        </div>

        <div className="goal-footer">
          <div className="goal-message">
            {goalPercent >= 100 ? 'Goal reached! 🎉' : goalPercent >= 50 ? "You're halfway there!" : 'Keep going!'}
          </div>
          {!editingGoal ? (
            <button className="goal-edit-btn" onClick={() => setEditingGoal(true)}>Edit Goal</button>
          ) : null}
        </div>

        {editingGoal && (
          <div className="goal-input-wrap">
            <input
              className="goal-input"
              type="number"
              inputMode="decimal"
              placeholder="Goal amount"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
              autoFocus
            />
            <button className="goal-save-btn" onClick={handleSaveGoal}>Save</button>
            <button className="goal-cancel-btn" onClick={() => setEditingGoal(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Recent Savings */}
      {savingsTxs.length > 0 && (
        <div className="recent-savings-section">
          <div className="recent-savings-title">Recent Savings</div>
          <div className="tx-list">
            {savingsTxs.slice(0, 5).map(tx => (
              <TransactionItem key={tx.id} tx={tx} showDate />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="fab-container">
        <button className="fab-btn" onClick={onAddToSavings}>
          <Plus size={20} />
          Add to Savings
        </button>
      </div>

      {state.savings > 0 && (
        <div className="fab-container" style={{ paddingTop: 0 }}>
          <button
            className="fab-btn"
            style={{ background: 'var(--surface)', color: 'var(--accent)', border: '1.5px solid var(--accent)', boxShadow: 'none' }}
            onClick={onWithdraw}
          >
            <ArrowDownToLine size={20} />
            Withdraw from Savings
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// LOANS SCREEN
// ═══════════════════════════════════════════════════════════════
function LoansScreen({ loans, onRepaid, onAddLoan, onNavigate }) {
  return (
    <div className="screen">
      <div className="page-header">
        <div className="page-header-left">
          <button className="back-btn" onClick={() => onNavigate('more')}>
            <ArrowLeft size={22} />
          </button>
          <h1 className="page-title">Loans</h1>
        </div>
      </div>

      {loans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Landmark />
          </div>
          <div className="empty-state-title">No active loans</div>
          <div className="empty-state-sub">You're all clear! 🎉</div>
        </div>
      ) : (
        <div className="loans-list-page">
          {loans.map((loan) => (
            <div className="loan-item" key={loan.id}>
              <div className="loan-avatar">{getInitial(loan.name)}</div>
              <div className="loan-info">
                <div className="loan-name">{loan.name}</div>
                <div className="loan-date">{formatDate(loan.date)}</div>
              </div>
              <div className="loan-amount">₹{formatAmount(loan.amount)}</div>
              <button
                className="loan-repaid-btn"
                onClick={() => onRepaid(loan.id)}
              >
                Repaid
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="fab-container">
        <button className="fab-btn" onClick={onAddLoan}>
          <Plus size={20} />
          Add a Loan
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MORE SCREEN
// ═══════════════════════════════════════════════════════════════
function MoreScreen({ onNavigate, onExport, onInstallApp, isInstalled, cloudStatus, onManualSync, onPushToCloud, onFetchFresh, onClearCache }) {
  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">More</h1>
      </div>

      {/* Profile Card */}
      <div className="profile-card">
        <div className="profile-avatar">AL</div>
        <div className="profile-info">
          <div className="profile-name">Ashitosh</div>
          <div className="profile-sub">Personal finance manager</div>
        </div>
        <span className="profile-arrow"><ChevronRight /></span>
      </div>

      {/* Cloud Database Status Card */}
      <div className="database-status-card">
        <div className="database-status-header">
          <div className="database-status-left">
            <div className="database-icon-wrap">
              <Database size={20} />
            </div>
            <div className="database-info">
              <div className="database-title">Firebase Cloud Database</div>
              <div className="database-sub">
                <span className={`database-dot ${cloudStatus || 'synced'}`} />
                {cloudStatus === 'synced' && 'Synced & Active (expense-b7fcb)'}
                {cloudStatus === 'saving' && 'Saving to Firestore...'}
                {cloudStatus === 'connecting' && 'Connecting to Firestore...'}
                {cloudStatus === 'not_created' && 'Database Not Created in Console'}
                {cloudStatus === 'error' && 'Offline / Local cache active'}
              </div>
            </div>
          </div>
          <button
            className="database-sync-btn"
            onClick={onManualSync}
            disabled={cloudStatus === 'saving'}
            aria-label="Sync with Firebase"
          >
            <RefreshCw size={13} className={cloudStatus === 'saving' ? 'spin-icon' : ''} />
            {cloudStatus === 'saving' ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {cloudStatus === 'not_created' && (
          <div className="database-alert-box">
            <div className="database-alert-text">
              Firestore has not been created yet in your project. Click below to create it in Firebase Console:
            </div>
            <a
              href="https://console.firebase.google.com/project/expense-b7fcb/firestore"
              target="_blank"
              rel="noopener noreferrer"
              className="database-console-btn"
            >
              Open Firebase Console <ExternalLink size={13} />
            </a>
          </div>
        )}

        <div className="database-actions-grid">
          <button className="db-action-btn" onClick={onPushToCloud} title="Directly upload all local data to Cloud Firestore">
            <UploadCloud size={15} /> Push to Cloud
          </button>
          <button className="db-action-btn" onClick={onFetchFresh} title="Fetch directly from Firebase server bypassing cache">
            <DownloadCloud size={15} /> Fetch from Cloud
          </button>
          <button className="db-action-btn warning" onClick={onClearCache} title="Clear browser cache to test fresh cloud load">
            <Trash2 size={15} /> Clear Cache
          </button>
        </div>
      </div>

      {/* App Shortcut / Install Card */}
      <div className="app-install-card" onClick={onInstallApp}>
        <img src="/apple-touch-icon.png" alt="Expense Tracker" className="app-install-icon" />
        <div className="app-install-info">
          <div className="app-install-title">Download App Shortcut</div>
          <div className="app-install-desc">
            {isInstalled ? 'Installed with custom wallet icon' : 'Add to home screen with wallet icon'}
          </div>
        </div>
        <span className={`app-install-badge ${isInstalled ? 'installed' : ''}`}>
          {isInstalled ? 'Installed' : 'Install'}
        </span>
      </div>

      {/* Menu Items */}
      <div className="menu-list">
        <div className="menu-card">
          <button className="menu-item" onClick={onInstallApp}>
            <span className="menu-item-icon"><Smartphone /></span>
            <span className="menu-item-text">App Shortcut & Icon</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={() => onNavigate('loans')}>
            <span className="menu-item-icon"><Landmark /></span>
            <span className="menu-item-text">Loans</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={() => onNavigate('transactions')}>
            <span className="menu-item-icon"><Tag /></span>
            <span className="menu-item-text">Categories</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={onExport}>
            <span className="menu-item-icon"><Download /></span>
            <span className="menu-item-text">Export Data</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item">
            <span className="menu-item-icon"><Settings /></span>
            <span className="menu-item-text">Settings</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item">
            <span className="menu-item-icon"><HelpCircle /></span>
            <span className="menu-item-text">Help & Support</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item">
            <span className="menu-item-icon"><Info /></span>
            <span className="menu-item-text">About</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="signout-section">
        <div className="signout-card">
          <button className="menu-item danger">
            <span className="menu-item-icon"><LogOut /></span>
            <span className="menu-item-text">Sign Out</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADD AMOUNT (LOAN) BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function AddSheet({ onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    if (!from.trim()) e.from = 'Enter the person\'s name'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) onSubmit({ amount, from: from.trim() })
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Wallet size={24} />
        Add Amount
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="add-amount">Amount (₹)</label>
          <input
            ref={amountRef}
            id="add-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="e.g. 500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="add-from">From (person's name)</label>
          <input
            id="add-from"
            className={`form-input ${errors.from ? 'error' : ''}`}
            type="text"
            placeholder="e.g. Rahul"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          {errors.from && <div className="form-error"><AlertCircle size={14} /> {errors.from}</div>}
        </div>
        <button className="btn-submit indigo" type="submit">
          Add ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SPENT BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function SpentSheet({ onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(SPEND_CATEGORIES[0])
  const [otherText, setOtherText] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    if (category === 'Other' && !otherText.trim()) e.other = 'Describe where you spent this'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) {
      onSubmit({
        amount,
        category,
        note: category === 'Other' ? otherText.trim() : '',
      })
    }
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Receipt size={24} />
        Record Spending
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="spent-amount">Amount (₹)</label>
          <input
            ref={amountRef}
            id="spent-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="e.g. 120"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="spent-category">Category</label>
          <select
            id="spent-category"
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {SPEND_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        {category === 'Other' && (
          <div className="form-group" style={{ animation: 'slideIn 0.25s ease' }}>
            <label className="form-label" htmlFor="spent-other">Where did you spend this?</label>
            <input
              id="spent-other"
              className={`form-input ${errors.other ? 'error' : ''}`}
              type="text"
              placeholder="e.g. Bus ticket"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
            />
            {errors.other && <div className="form-error"><AlertCircle size={14} /> {errors.other}</div>}
          </div>
        )}
        <button className="btn-submit red" type="submit">
          Spend ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// WITHDRAW FROM SAVINGS BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function WithdrawSheet({ maxAmount, onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    else if (amt > maxAmount) e.amount = `Maximum withdrawal: ₹${formatAmount(maxAmount)}`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) onSubmit({ amount })
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <ArrowDownToLine size={24} />
        Withdraw from Savings
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="withdraw-amount">
            Amount (₹) — Available: ₹{formatAmount(maxAmount)}
          </label>
          <input
            ref={amountRef}
            id="withdraw-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder={`Max ₹${formatAmount(maxAmount)}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>}
        </div>
        <button className="btn-submit indigo" type="submit">
          Withdraw ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADD TO SAVINGS BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function AddSavingsSheet({ maxAmount, onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState({})
  const amountRef = useRef(null)

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 350)
  }, [])

  const validate = () => {
    const e = {}
    const amt = Number(amount)
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount greater than 0'
    else if (amt > maxAmount) e.amount = `Maximum: ₹${formatAmount(maxAmount)} (your current balance)`
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (validate()) onSubmit({ amount })
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <PiggyBank size={24} />
        Add to Savings
      </div>
      <form onSubmit={handleSubmit}>
        <div className="add-savings-info">
          <Wallet size={16} />
          Available balance: ₹{formatAmount(maxAmount)}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="savings-amount">Amount (₹)</label>
          <input
            ref={amountRef}
            id="savings-amount"
            className={`form-input ${errors.amount ? 'error' : ''}`}
            type="number"
            inputMode="decimal"
            placeholder="e.g. 200"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && <div className="form-error"><AlertCircle size={14} /> {errors.amount}</div>}
        </div>
        <button className="btn-submit indigo" type="submit">
          Save ₹{amount && Number(amount) > 0 ? formatAmount(Number(amount)) : '0'}
        </button>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// EXPORT BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function ExportSheet({ onExportCSV, onExportJSON, onClose }) {
  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Download size={24} />
        Export Data
      </div>
      <div className="export-options">
        <button className="export-option-btn" onClick={onExportCSV}>
          <span className="export-option-icon"><FileText /></span>
          <span className="export-option-text">
            <div className="export-option-title">Export as CSV</div>
            <div className="export-option-sub">Spreadsheet compatible format</div>
          </span>
        </button>
        <button className="export-option-btn" onClick={onExportJSON}>
          <span className="export-option-icon"><FileJson /></span>
          <span className="export-option-text">
            <div className="export-option-title">Export as JSON</div>
            <div className="export-option-sub">Raw data with full details</div>
          </span>
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// INSTALL / SHORTCUT BOTTOM SHEET
// ═══════════════════════════════════════════════════════════════
function InstallAppSheet({ installPrompt, isInstalled, onClose, onInstallSuccess }) {
  const [installing, setInstalling] = useState(false)

  const handleInstallClick = async () => {
    if (installPrompt) {
      setInstalling(true)
      try {
        installPrompt.prompt()
        const choiceResult = await installPrompt.userChoice
        if (choiceResult && choiceResult.outcome === 'accepted') {
          onInstallSuccess()
        }
      } catch (err) {
        console.error('Install prompt error:', err)
      } finally {
        setInstalling(false)
        onClose()
      }
    }
  }

  return (
    <div className="bottom-sheet active">
      <div className="sheet-handle" />
      <div className="sheet-title">
        <Smartphone size={24} />
        App Shortcut & Icon
      </div>

      <div className="install-sheet-content">
        <div className="install-app-preview">
          <img src="/apple-touch-icon.png" alt="Wallet FIX App Icon" className="install-preview-img" />
          <div className="install-preview-name">Wallet FIX</div>
          <div className="install-preview-tag">Web Application</div>
        </div>

        <p className="install-sheet-desc">
          Add Wallet FIX to your Home screen or desktop. It downloads as a standalone shortcut displaying this custom 3D wallet application icon!
        </p>

        {installPrompt ? (
          <button className="btn-submit indigo" onClick={handleInstallClick} disabled={installing} style={{ marginBottom: '16px' }}>
            <Download size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            {installing ? 'Installing...' : 'Add Shortcut to Device'}
          </button>
        ) : isInstalled ? (
          <div className="install-info-box success" style={{ marginBottom: '16px' }}>
            ✓ Application shortcut is already active on this device!
          </div>
        ) : (
          <div className="install-instructions">
            <div className="install-step">
              <span className="step-num">1</span>
              <div>
                <strong>Safari / iOS:</strong> Tap the <strong>Share</strong> button (box with arrow) at the bottom, scroll down and tap <strong>"Add to Home Screen"</strong>.
              </div>
            </div>
            <div className="install-step">
              <span className="step-num">2</span>
              <div>
                <strong>Chrome / Android:</strong> Tap the <strong>three dots menu (⋮)</strong> and tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
              </div>
            </div>
            <div className="install-step">
              <span className="step-num">3</span>
              <div>
                <strong>Desktop:</strong> Look for the <strong>Install icon</strong> in your browser's address bar to install as a desktop shortcut.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

