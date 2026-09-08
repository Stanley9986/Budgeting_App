import { useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Goals } from './pages/Goals'
import { Settings } from './pages/Settings'
import { Transactions } from './pages/Transactions'
import { useAppStore } from './state/AppStore'
import { useTheme } from './state/useTheme'

type Route = 'dashboard' | 'transactions' | 'goals' | 'settings'

const NAV: { id: Route; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◎' },
  { id: 'transactions', label: 'Transactions', icon: '≡' },
  { id: 'goals', label: 'Goals', icon: '★' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
]

export default function App(): JSX.Element {
  const [route, setRoute] = useState<Route>('dashboard')
  const { ready, error, data } = useAppStore()
  useTheme(data?.profile.themeId)

  if (error) {
    return (
      <div className="loading">
        <div style={{ textAlign: 'center' }}>
          <h3>Something went wrong</h3>
          <p className="muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready || !data) return <div className="loading">Loading your budget…</div>

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__mark">◐</div>
          <div className="sidebar__title">Budget</div>
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            className="nav-item"
            aria-current={route === item.id ? 'page' : undefined}
            onClick={() => setRoute(item.id)}
          >
            <span className="nav-item__icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="avatar">{data.profile.avatarEmoji}</span>
            <span>{data.profile.name || 'Set up your profile'}</span>
          </div>
          <div>Stored locally on this Mac</div>
        </div>
      </nav>

      <main className="main">
        {route === 'dashboard' && <Dashboard onNavigate={setRoute} />}
        {route === 'transactions' && <Transactions />}
        {route === 'goals' && <Goals />}
        {route === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export type { Route }
