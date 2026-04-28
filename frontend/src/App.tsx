import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Jobs from './pages/Jobs'
import Models from './pages/Models'
import CalendarPage from './pages/CalendarPage'
import Analytics from './pages/Analytics'
import SettingsPage from './pages/SettingsPage'

export default function App() {
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
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
