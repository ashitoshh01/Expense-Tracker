import { Home, Receipt, PiggyBank, Landmark, Menu, TrendingUp } from 'lucide-react'

export default function SidebarNavigation({ active, onNavigate, authUser }) {
  const tabs = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'savings', label: 'Savings', icon: PiggyBank },
    { id: 'loans', label: 'Loans & Debt', icon: Landmark },
    { id: 'more', label: 'More', icon: Menu },
  ]

  const avatarText = authUser?.displayName
    ? authUser.displayName.slice(0, 2).toUpperCase()
    : authUser?.email
    ? authUser.email.slice(0, 2).toUpperCase()
    : 'U'

  const displayName =
    authUser?.displayName?.trim() ||
    (authUser?.email ? authUser.email.split('@')[0] : 'User')

  return (
    <aside className="sidebar-nav" role="navigation" aria-label="Main navigation">
      {/* Brand */}
      <div className="sidebar-brand">
        <img src="/apple-touch-icon.png" alt="Wallet FIX" className="sidebar-brand-logo" />
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">Wallet</span>
          <span className="sidebar-brand-badge">FIX</span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="sidebar-links">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive =
            active === tab.id ||
            (active === 'addTx' && tab.id === 'transactions') ||
            (active === 'loans' && tab.id === 'loans')
          return (
            <button
              key={tab.id}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(tab.id)}
              type="button"
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="sidebar-link-icon">
                <Icon size={20} />
              </span>
              <span className="sidebar-link-label">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className="sidebar-footer">
        <button
          className="sidebar-user"
          onClick={() => onNavigate('more')}
          type="button"
          aria-label="Open profile and settings"
        >
          <div className="sidebar-user-avatar">{avatarText}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName}</div>
            <div className="sidebar-user-sub">
              {authUser?.email || 'Personal Finance'}
            </div>
          </div>
        </button>
      </div>
    </aside>
  )
}

