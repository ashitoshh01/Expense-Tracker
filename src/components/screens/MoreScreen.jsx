import {
  Smartphone,
  Landmark,
  Tag,
  Download,
  Settings,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
  Database,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Trash2,
  ExternalLink,
  LogIn,
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
  onPushToCloud,
  onFetchFresh,
  onClearCache,
  onOpenSettings,
  onOpenHelp,
  onOpenAbout,
  onSignInGoogle,
  onSignOut,
}) {
  const isAnonymous = !authUser || authUser.isAnonymous
  const displayName = authUser?.displayName || (isAnonymous ? 'Local User' : 'Authenticated User')
  const email = authUser?.email || (isAnonymous ? `Isolated Session (${authUser?.uid?.slice(0, 6) || 'local'}...)` : '')
  const avatarText = authUser?.displayName ? authUser.displayName.slice(0, 2).toUpperCase() : 'AL'

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
            {displayName}
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
                {cloudStatus === 'synced' && 'Synced & Isolated (Active)'}
                {cloudStatus === 'saving' && 'Saving to Firestore...'}
                {cloudStatus === 'connecting' && 'Connecting to Firestore...'}
                {cloudStatus === 'offline' && 'Offline / Changes Queued Locally'}
                {cloudStatus === 'not_created' && 'Database Not Created in Console'}
                {cloudStatus === 'error' && 'Network Issue / Local Cache Active'}
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
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId || 'expense-b7fcb'}/firestore`}
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

      {/* Menu Items with all working actions */}
      <div className="menu-list">
        <div className="menu-card">
          <button className="menu-item" onClick={onInstallApp}>
            <span className="menu-item-icon"><Smartphone /></span>
            <span className="menu-item-text">App Shortcut & Icon</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
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
          <button className="menu-item" onClick={onExport}>
            <span className="menu-item-icon"><Download /></span>
            <span className="menu-item-text">Export & Backup</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={onOpenSettings}>
            <span className="menu-item-icon"><Settings /></span>
            <span className="menu-item-text">Settings (Salary & Goals)</span>
            <span className="menu-item-arrow"><ChevronRight /></span>
          </button>
          <button className="menu-item" onClick={onOpenHelp}>
            <span className="menu-item-icon"><HelpCircle /></span>
            <span className="menu-item-text">Help & Support</span>
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
