import { Home, Receipt, TrendingUp, PiggyBank, Menu } from 'lucide-react'

export default function BottomNavigation({ active, onNavigate }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'savings', label: 'Savings', icon: PiggyBank },
    { id: 'more', label: 'More', icon: Menu },
  ]

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.id || (active === 'loans' && tab.id === 'more')
        return (
          <button
            key={tab.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onNavigate(tab.id)}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
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
