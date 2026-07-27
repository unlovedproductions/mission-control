import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Jobs from './pages/Jobs'
import Models from './pages/Models'
import CalendarPage from './pages/CalendarPage'
import Analytics from './pages/Analytics'
import SettingsPage from './pages/SettingsPage'
import Publish from './pages/Publish'
import Ops from './pages/Ops'
import { api } from './utils/api'
import { Lock } from 'lucide-react'

export default function App() {
  const [authRequired, setAuthRequired] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [checking, setChecking] = useState(true)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.authStatus()
      .then((s) => {
        setAuthRequired(!!s.required)
        if (!s.required) {
          setUnlocked(true)
        } else if (localStorage.getItem('mc_dashboard_token')) {
          setUnlocked(true)
        }
      })
      .catch(() => setUnlocked(true))
      .finally(() => setChecking(false))
  }, [])

  const unlock = async () => {
    setError('')
    try {
      await api.authUnlock(token)
      localStorage.setItem('mc_dashboard_token', token)
      setUnlocked(true)
    } catch (e: any) {
      setError(e.message || 'Invalid token')
    }
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-brand-text-dim">Loading…</div>
  }

  if (authRequired && !unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
        <div className="card max-w-md w-full space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-brand-accent" />
            <h1 className="text-lg font-bold">Mission Control unlock</h1>
          </div>
          <p className="text-sm text-brand-text-dim">
            Operator token required (MC_DASHBOARD_TOKEN). Needed now that this dashboard can publish to live social accounts.
          </p>
          <input
            type="password"
            className="input-field w-full"
            placeholder="Dashboard token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
          />
          {error && <p className="text-sm text-brand-error">{error}</p>}
          <button className="btn-primary w-full" onClick={unlock}>Unlock</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/models" element={<Models />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/ops" element={<Ops />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
