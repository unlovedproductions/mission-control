import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import { Activity, RefreshCw, Server, Shield, ExternalLink } from 'lucide-react'

export default function Ops() {
  const [overview, setOverview] = useState<any>(null)
  const [services, setServices] = useState<Record<string, any>>({})
  const [readiness, setReadiness] = useState<any>(null)
  const [daemon, setDaemon] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [ov, st, rd, dm] = await Promise.all([
        api.opsOverview(),
        api.serviceStatus().catch(() => ({})),
        api.shadowcastReadiness().catch(() => null),
        api.apfDaemon().catch(() => null),
      ])
      setOverview(ov)
      setServices(st)
      setReadiness(rd)
      setDaemon(dm)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleSchedule = async (kind: string, enabled: boolean) => {
    try {
      await api.updateSchedule({ kind, enabled })
      await load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ops</h1>
          <p className="text-brand-text-dim text-sm mt-1">Service registry, readiness, refresh runs, problem jobs</p>
          <p className="text-xs text-brand-warning mt-1">
            Digistore daemon is probed at :3219 directly (APF stopgap). Refresh runs are local until APF ships products.refreshLogs.
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading && !overview ? (
        <div className="card animate-pulse h-32" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {Object.entries(services).map(([name, info]: [string, any]) => (
              <div key={name} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-brand-accent" />
                    <span className="text-sm font-semibold capitalize">{name.replace(/_/g, ' ')}</span>
                  </div>
                  <StatusBadge status={info.status} />
                </div>
                <p className="text-xs text-brand-text-dim truncate">{info.url}</p>
                {info.ui_url && (
                  <a href={info.ui_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-accent mt-2">
                    <ExternalLink className="w-3 h-3" /> Open UI
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card">
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> ShadowCast readiness</h2>
              {readiness ? (
                <pre className="text-xs overflow-auto max-h-40 text-brand-text-dim">{JSON.stringify(readiness, null, 2)}</pre>
              ) : (
                <p className="text-sm text-brand-text-dim">Unavailable</p>
              )}
            </div>
            <div className="card">
              <h2 className="text-sm font-semibold mb-2">Digistore daemon</h2>
              <p className="text-xs text-brand-text-dim mb-2">Direct probe — not via APF system.digistoreDaemon yet</p>
              {daemon ? (
                <>
                  <StatusBadge status={daemon.status} />
                  <p className="text-xs text-brand-text-dim mt-2">{daemon.url}</p>
                </>
              ) : (
                <p className="text-sm text-brand-text-dim">Unavailable</p>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold mb-3">Schedules</h2>
            <div className="space-y-2">
              {(overview?.schedules || []).map((s: any) => (
                <div key={s.kind} className="flex items-center justify-between bg-brand-surface rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{s.kind}</p>
                    <p className="text-xs text-brand-text-dim">
                      every {s.interval_minutes}m · last: {s.last_run || 'never'} {s.last_status && `(${s.last_status})`}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!s.enabled}
                      onChange={(e) => toggleSchedule(s.kind, e.target.checked)}
                    />
                    Enabled
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold mb-3">Latest refresh runs</h2>
            <p className="text-xs text-brand-text-dim mb-2">Local MC stopgap until APF products.refreshLogs exists</p>
            <div className="space-y-2">
              {(overview?.refresh_runs || []).length === 0 && (
                <p className="text-sm text-brand-text-dim">No refresh runs recorded yet</p>
              )}
              {(overview?.refresh_runs || []).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{r.marketplace}</span>
                  <StatusBadge status={r.status === 'ok' ? 'completed' : r.status} />
                  <span className="text-xs text-brand-text-dim">{r.product_count} products · {r.finished_at || r.started_at}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold mb-3">Problem jobs</h2>
            {(overview?.problem_jobs || []).length === 0 ? (
              <p className="text-sm text-brand-text-dim">None</p>
            ) : (
              <div className="space-y-2">
                {overview.problem_jobs.map((j: any) => (
                  <div key={j.id} className="flex items-center gap-3 text-sm">
                    <StatusBadge status={j.status} />
                    <span className="truncate flex-1">{j.product_name}</span>
                    <span className="text-xs text-brand-text-dim truncate max-w-[40%]">{j.error_message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> Recent activity</h2>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {(overview?.activity || []).map((a: any) => (
                <div key={a.id} className="text-xs flex gap-2">
                  <span className="text-brand-text-dim whitespace-nowrap">{a.timestamp}</span>
                  <span className="font-medium">{a.action}</span>
                  <span className="text-brand-text-dim truncate">{a.details}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
