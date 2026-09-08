import { useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Goals } from './pages/Goals'
import { Settings } from './pages/Settings'
import { Transactions } from './pages/Transactions'
import { Reports } from './pages/Reports'
import { Bills } from './pages/Bills'
import { useAppStore } from './state/AppStore'
import { useTheme } from './state/useTheme'

type Route = 'dashboard' | 'transactions' | 'goals' | 'bills' | 'reports' | 'settings'

const NAV: { id: Route; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◎' },
  { id: 'transactions', label: 'Transactions', icon: '≡' },
  { id: 'bills', label: 'Bills', icon: '▦' },
  { id: 'reports', label: 'Reports', icon: '▥' },
  { id: 'goals', label: 'Goals', icon: '★' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
]

export default function App(): JSX.Element {
  const [route, setRoute] = useState<Route>('dashboard')
  const { ready, error, data, refresh, dismissError, canUndo, busy, mutate } = useAppStore()
  useTheme(data?.profile.themeId)

  if (error && !data) {
    return (
      <div className="loading">
        <div style={{ textAlign: 'center' }}>
          <h3>Something went wrong</h3>
          <p className="muted">{error}</p>
          <button className="btn" onClick={() => void refresh()}>
            Retry
          </button>
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
            <span className="nav-item__icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
        <div className="sidebar__footer">
          <button
            className="btn"
            style={{ marginBottom: 16 }}
            disabled={!canUndo || busy}
            onClick={() => void mutate(() => window.budget.undo())}
            title="Undo the last saved change (up to 20 changes this session)"
          >
            ↶ Undo last change
          </button>
          <div className="sidebar__user">
            <span className="avatar">{data.profile.avatarEmoji}</span>
            <span>{data.profile.name || 'Set up your profile'}</span>
          </div>
          <div>Stored locally on this device</div>
        </div>
      </nav>

      {/* A new page gets a fresh scroll container instead of inheriting the prior page's offset. */}
      <main className="main" key={route}>
        {route === 'dashboard' && <Dashboard onNavigate={setRoute} />}
        {route === 'transactions' && <Transactions />}
        {route === 'goals' && <Goals />}
        {route === 'bills' && <Bills />}
        {route === 'reports' && <Reports />}
        {route === 'settings' && <Settings />}
      </main>
      {error && (
        <div className="error-notice" role="alert">
          <strong>Budget notice</strong>
          <p>{error}</p>
          <button className="btn" onClick={dismissError}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

export type { Route }
