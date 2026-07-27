import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import {
  BarChart3, Package, Video, CheckCircle, AlertTriangle, Clock, TrendingUp, RefreshCw,
} from 'lucide-react'

interface Stats {
  total_products: number
  analyzed_products: number
  enriched_products?: number
  approved_products?: number
  total_jobs: number
  completed_jobs: number
  queued_jobs: number
  failed_jobs: number
  scheduled_events: number
  products_by_marketplace: Record<string, number>
  jobs_by_status: Record<string, number>
  recent_activity: Array<{ action: string; details: string; timestamp: string }>
}

export default function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scDash, setScDash] = useState<any>(null)
  const [scHooks, setScHooks] = useState<any>(null)
  const [scFormats, setScFormats] = useState<any>(null)
  const [scRevenue, setScRevenue] = useState<any>(null)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const data = await api.analyticsOverview()
      setStats(data)
      const [d, h, f, r] = await Promise.all([
        api.scAnalyticsDashboard().catch(() => null),
        api.scAnalyticsHooks().catch(() => null),
        api.scAnalyticsFormats().catch(() => null),
        api.scAnalyticsRevenue().catch(() => null),
      ])
      setScDash(d)
      setScHooks(h)
      setScFormats(f)
      setScRevenue(r)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card animate-pulse"><div className="h-16 bg-brand-border rounded" /></div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return <p className="text-brand-text-dim">Failed to load analytics.</p>

  const completionRate = stats.total_jobs > 0
    ? Math.round((stats.completed_jobs / stats.total_jobs) * 100)
    : 0

  const analysisRate = stats.total_products > 0
    ? Math.round((stats.analyzed_products / stats.total_products) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics Overview</h1>
          <p className="text-brand-text-dim text-sm mt-1">Pipeline performance and production metrics</p>
        </div>
        <button onClick={fetchStats} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <Package className="w-5 h-5 text-brand-accent" />
            <span className="text-xs text-brand-text-dim">Products</span>
          </div>
          <p className="text-3xl font-bold">{stats.total_products}</p>
          <p className="text-xs text-brand-text-dim mt-1">
            {stats.enriched_products ?? 0} enriched · {stats.analyzed_products} analyzed ({analysisRate}%)
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <Video className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-brand-text-dim">Total Jobs</span>
          </div>
          <p className="text-3xl font-bold">{stats.total_jobs}</p>
          <p className="text-xs text-brand-text-dim mt-1">{stats.queued_jobs} in queue</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle className="w-5 h-5 text-brand-success" />
            <span className="text-xs text-brand-text-dim">Completed</span>
          </div>
          <p className="text-3xl font-bold">{stats.completed_jobs}</p>
          <p className="text-xs text-brand-text-dim mt-1">{completionRate}% completion rate</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <AlertTriangle className="w-5 h-5 text-brand-error" />
            <span className="text-xs text-brand-text-dim">Failed</span>
          </div>
          <p className="text-3xl font-bold">{stats.failed_jobs}</p>
          <p className="text-xs text-brand-text-dim mt-1">{stats.total_jobs > 0 ? Math.round((stats.failed_jobs / stats.total_jobs) * 100) : 0}% failure rate</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products by Marketplace */}
        <div className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-4">Products by Marketplace</h3>
          {Object.keys(stats.products_by_marketplace).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(stats.products_by_marketplace)
                .sort(([, a], [, b]) => b - a)
                .map(([mp, count]) => {
                  const maxCount = Math.max(...Object.values(stats.products_by_marketplace))
                  const pct = Math.round((count / maxCount) * 100)
                  return (
                    <div key={mp}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="capitalize font-medium">{mp}</span>
                        <span className="text-brand-text-dim font-mono">{count}</span>
                      </div>
                      <div className="h-3 bg-brand-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-brand-accent to-brand-accent-hover rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <p className="text-brand-text-dim text-sm">No data yet.</p>
          )}
        </div>

        {/* Jobs by Status */}
        <div className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-4">Jobs by Status</h3>
          {Object.keys(stats.jobs_by_status).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(stats.jobs_by_status).map(([status, count]) => {
                const maxCount = Math.max(...Object.values(stats.jobs_by_status))
                const pct = Math.round((count / maxCount) * 100)
                const colors: Record<string, string> = {
                  completed: 'from-green-600 to-green-500',
                  queued: 'from-yellow-600 to-yellow-500',
                  rendering: 'from-brand-accent to-brand-accent-hover',
                  generating_script: 'from-blue-600 to-blue-500',
                  failed: 'from-red-600 to-red-500',
                }
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="capitalize font-medium">{status.replace(/_/g, ' ')}</span>
                      <span className="text-brand-text-dim font-mono">{count}</span>
                    </div>
                    <div className="h-3 bg-brand-surface rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${colors[status] || 'from-gray-600 to-gray-500'} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-brand-text-dim text-sm">No jobs yet.</p>
          )}
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="card">
        <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-4">Pipeline Funnel</h3>
        <div className="flex items-end justify-between gap-4 h-48">
          {[
            { label: 'Imported', value: stats.total_products, color: 'bg-brand-accent' },
            { label: 'Enriched', value: stats.enriched_products ?? 0, color: 'bg-cyan-500' },
            { label: 'Analyzed', value: stats.analyzed_products, color: 'bg-blue-500' },
            { label: 'Approved', value: stats.approved_products ?? 0, color: 'bg-indigo-500' },
            { label: 'Jobs Created', value: stats.total_jobs, color: 'bg-purple-500' },
            { label: 'Completed', value: stats.completed_jobs, color: 'bg-brand-success' },
            { label: 'Scheduled', value: stats.scheduled_events, color: 'bg-yellow-500' },
          ].map((item) => {
            const maxVal = Math.max(stats.total_products, 1)
            const height = Math.max((item.value / maxVal) * 100, 5)
            return (
              <div key={item.label} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-lg font-bold">{item.value}</span>
                <div className="w-full bg-brand-surface rounded-t-lg overflow-hidden" style={{ height: `${height}%` }}>
                  <div className={`w-full h-full ${item.color} rounded-t-lg opacity-80`} />
                </div>
                <span className="text-[10px] text-brand-text-dim text-center">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> ShadowCast dashboard
          </h3>
          {scDash ? (
            <pre className="text-xs overflow-auto max-h-56 text-brand-text-dim">{JSON.stringify(scDash, null, 2)}</pre>
          ) : (
            <p className="text-sm text-brand-text-dim">Unavailable (ShadowCast offline or empty)</p>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-3">Revenue</h3>
          {scRevenue ? (
            <pre className="text-xs overflow-auto max-h-56 text-brand-text-dim">{JSON.stringify(scRevenue, null, 2)}</pre>
          ) : (
            <p className="text-sm text-brand-text-dim">Unavailable</p>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-3">Hooks performance</h3>
          {scHooks ? (
            <pre className="text-xs overflow-auto max-h-56 text-brand-text-dim">{JSON.stringify(scHooks, null, 2)}</pre>
          ) : (
            <p className="text-sm text-brand-text-dim">Unavailable</p>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-3">Formats performance</h3>
          {scFormats ? (
            <pre className="text-xs overflow-auto max-h-56 text-brand-text-dim">{JSON.stringify(scFormats, null, 2)}</pre>
          ) : (
            <p className="text-sm text-brand-text-dim">Unavailable</p>
          )}
        </div>
      </div>
    </div>
  )
}
