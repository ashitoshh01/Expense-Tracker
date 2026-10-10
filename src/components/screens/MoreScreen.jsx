import { useState } from 'react'
import {
  Smartphone,
  Landmark,
  Tag,
  Download,
  Info,
  LogOut,
  ChevronRight,
  Database,
  RefreshCw,
  ExternalLink,
  LogIn,
  Edit2,
  CircleDollarSign,
} from 'lucide-react'
import { firebaseConfig } from '../../firebase'

export default function MoreScreen({
  authUser,
  onNavigate,
  onExport,
  onInstallApp,
  isInstalled,
  cloudStatus,
  onManualSync,
  onOpenSettings,
  onOpenSalarySavings,
  onOpenAbout,
  onSignInGoogle,
  onSignOut,
  onUpdateName,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(authUser?.displayName || '')
  const isAnonymous = !authUser || authUser.isAnonymous
  const displayName = authUser?.displayName || (isAnonymous ? 'Local User' : authUser?.email ? authUser.email.split('@')[0] : 'User')
  const email = authUser?.email || (isAnonymous ? `Isolated Session (${authUser?.uid?.slice(0, 6) || 'local'}...)` : '')
  const avatarText = authUser?.displayName
    ? authUser.displayName.slice(0, 2).toUpperCase()
    : authUser?.email
    ? authUser.email.slice(0, 2).toUpperCase()
    : 'U'

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">More</h1>
      </div>

      {/* Profile Card */}
      <div className="profile-card" style={{ cursor: 'pointer' }} onClick={isAnonymous ? onSignInGoogle : undefined}>
        <div className="profile-avatar">{avatarText}</div>
        <div className="profile-info">
          <div className="profile-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {editingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (nameInput.trim() && onUpdateName) {
                    onUpdateName(nameInput.trim())
                  }
                  setEditingName(false)
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <input
                  type="text"
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter name"
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1.5px solid var(--accent)',
                    fontSize: 14,
                    fontWeight: 700,
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    maxWidth: 150,
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{displayName}</span>
                {!isAnonymous && onUpdateName && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setNameInput(authUser?.displayName || '')
                      setEditingName(true)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 2,
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Edit Name"
                    aria-label="Edit Name"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            )}
            {isAnonymous && (
              <span style={{ fontSize: 10, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                Device Isolated
              </span>
            )}
          </div>
          <div className="profile-sub">{email || 'Personal finance manager'}</div>
        </div>
        {isAnonymous ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSignInGoogle()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <LogIn size={14} /> Google Sign-in
          </button>
        ) : (
          <span className="profile-arrow"><ChevronRight /></span>
        )}
      </div>

      {/* Cloud Auto-Sync Card */}
      <div className="database-status-card">
        <div className="database-status-header">
          <div className="database-status-left">
            <div className="database-icon-wrap">
              <Database size={20} />
            </div>
            <div className="database-info">
              <div className="database-title">Cloud Auto-Sync</div>
              <div className="database-sub">
                <span className={`database-dot ${cloudStatus || 'synced'}`} />
                {cloudStatus === 'synced' && 'Real-time sync active'}
                {cloudStatus === 'saving' && 'Auto-saving to cloud...'}
                {cloudStatus === 'connecting' && 'Connecting to cloud...'}
                {cloudStatus === 'offline' && 'Offline / Changes queued locally'}
                {cloudStatus === 'permission_denied' && 'Firestore permissions required'}
                {cloudStatus === 'not_created' && 'Database not created in console'}
                {cloudStatus === 'error' && 'Syncing re-attempting...'}
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
            {cloudStatus === 'saving' ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {(cloudStatus === 'permission_denied' || cloudStatus === 'not_created') && (
          <div className="database-alert-box">
            <div className="database-alert-text">
              {cloudStatus === 'not_created'
                ? 'Cloud Firestore database has not been created yet in your Firebase project.'
                : 'Cloud Firestore Security Rules need to allow access for your account in Firebase Console.'}
            </div>
            <a
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId || 'expense-b7fcb'}/firestore/rules`}
              target="_blank"
              rel="noopener noreferrer"
              className="database-console-btn"
            >
              Open Firebase Rules <ExternalLink size={13} />
            </a>
          </div>
        )}

        <div className="auto-sync-features">
          <div className="auto-sync-badge">
            <span className="auto-sync-check">✓</span>
            <span>All expenses, loans &amp; settings auto-save instantly</span>
          </div>
          <div className="auto-sync-badge">
            <span className="auto-sync-check">✓</span>
            <span>Offline-first: changes safe in local queue and auto-sync when online</span>
          </div>
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
          <button className="menu-item" onClick={() => onNavigate('loans')}>
            <span className="menu-item-icon"><Landmark /></span>
            <span className="menu-item-text">Loans & Debt</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={() => onNavigate('transactions')}>
            <span className="menu-item-icon"><Tag /></span>
            <span className="menu-item-text">Categories & History</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={onOpenSalarySavings || onOpenSettings}>
            <span className="menu-item-icon"><CircleDollarSign /></span>
            <span className="menu-item-text">Salary & Savings</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={onExport}>
            <span className="menu-item-icon"><Download /></span>
            <span className="menu-item-text">Export & Backup</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={onOpenAbout}>
            <span className="menu-item-icon"><Info /></span>
            <span className="menu-item-text">About Wallet FIX</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
        </div>
      </div>

      {/* Sign Out Section */}
      <div className="signout-section">
        <div className="signout-card">
          <button className="menu-item danger" onClick={onSignOut}>
            <span className="menu-item-icon"><LogOut /></span>
            <span className="menu-item-text">{isAnonymous ? 'Reset / Switch Session' : 'Sign Out'}</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
        </div>
      </div>
    </div>
  )
}
