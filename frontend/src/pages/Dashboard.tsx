import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import ServiceStatus from '../components/ServiceStatus'
import {
  Package, Video, CheckCircle, AlertTriangle, Clock, TrendingUp, Activity,
} from 'lucide-react'

interface Stats {
  total_products: number
  analyzed_products: number
  enriched_products?: number
  total_jobs: number
  completed_jobs: number
  queued_jobs: number
  failed_jobs: number
  scheduled_events: number
  products_by_marketplace: Record<string, number>
  jobs_by_status: Record<string, number>
  recent_activity: Array<{ action: string; details: string; timestamp: string }>
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.analyticsOverview().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  const statCards = stats
    ? [
        { label: 'Total Products', value: stats.total_products, icon: Package, color: 'text-brand-accent' },
        { label: 'Videos Completed', value: stats.completed_jobs, icon: CheckCircle, color: 'text-brand-success' },
        { label: 'Jobs Queued', value: stats.queued_jobs, icon: Clock, color: 'text-brand-warning' },
        { label: 'Failed Jobs', value: stats.failed_jobs, icon: AlertTriangle, color: 'text-brand-error' },
        { label: 'Analyzed', value: stats.analyzed_products, icon: TrendingUp, color: 'text-blue-400' },
        { label: 'Enriched', value: stats.enriched_products ?? 0, icon: TrendingUp, color: 'text-cyan-400' },
        { label: 'Scheduled Posts', value: stats.scheduled_events, icon: Video, color: 'text-purple-400' },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mission Control</h1>
        <p className="text-brand-text-dim text-sm mt-1">Unloved Productions — ShadowCast + APF Orchestration</p>
      </div>

      {/* Service Status */}
      <div>
        <h2 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-3">Service Status</h2>
        <ServiceStatus />
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-8 w-16 bg-brand-border rounded mb-2" />
              <div className="h-4 w-24 bg-brand-border rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="card">
              <div className="flex items-center justify-between mb-2">
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-brand-text-dim mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Marketplace Breakdown + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Marketplace Breakdown */}
        <div className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-4">Products by Marketplace</h3>
          {stats && Object.keys(stats.products_by_marketplace).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(stats.products_by_marketplace).map(([mp, count]) => {
                const total = stats.total_products || 1
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={mp}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{mp}</span>
                      <span className="text-brand-text-dim">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-brand-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-accent rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-brand-text-dim text-sm">No products imported yet. Head to Product Pipeline to get started.</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-4">Recent Activity</h3>
          {stats && stats.recent_activity.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.recent_activity.slice(0, 10).map((act, i) => {
                const isFailure = act.action.includes('failed') || act.action.includes('error')
                return (
                <div key={i} className={`flex items-start gap-3 py-2 border-b border-brand-border/50 last:border-0 ${isFailure ? 'text-brand-error' : ''}`}>
                  <Activity className="w-4 h-4 text-brand-accent mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {act.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    {act.details && (
                      <p className="text-xs text-brand-text-dim truncate">{act.details}</p>
                    )}
                    <p className="text-[10px] text-brand-text-dim mt-0.5">
                      {new Date(act.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                )
              })}
            </div>
          ) : (
            <p className="text-brand-text-dim text-sm">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
