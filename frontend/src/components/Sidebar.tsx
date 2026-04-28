import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Video,
  Brain,
  Calendar,
  BarChart3,
  Settings,
  Activity,
  Zap,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Package, label: 'Product Pipeline' },
  { to: '/jobs', icon: Video, label: 'Video Queue' },
  { to: '/models', icon: Brain, label: 'Ollama Models' },
  { to: '/calendar', icon: Calendar, label: 'Content Calendar' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-brand-surface border-r border-brand-border flex flex-col z-50">
      {/* Logo */}
      <div className="p-5 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-accent flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-brand-text leading-tight">Mission Control</h1>
            <p className="text-[10px] text-brand-text-dim font-medium tracking-wider uppercase">Unloved Productions</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-brand-accent/15 text-brand-accent border border-brand-accent/20'
                  : 'text-brand-text-dim hover:text-brand-text hover:bg-brand-card'
              }`
            }
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-brand-border">
        <div className="flex items-center gap-2 text-xs text-brand-text-dim">
          <Activity className="w-3.5 h-3.5" />
          <span>v1.0.0 — Local Dev</span>
        </div>
      </div>
    </aside>
  )
}
