import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import { Share2, RefreshCw, ExternalLink, Send, ListOrdered } from 'lucide-react'

export default function Publish() {
  const [oauth, setOauth] = useState<any>(null)
  const [postable, setPostable] = useState<any[]>([])
  const [queue, setQueue] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState('youtube')
  const [busy, setBusy] = useState(false)
  const [scUrl, setScUrl] = useState('http://localhost:8000')

  const load = async () => {
    setLoading(true)
    try {
      const cfg = await api.getConfig().catch(() => ({} as Record<string, string>))
      if (cfg.shadowcast_url) setScUrl(cfg.shadowcast_url)
      const [o, p, q] = await Promise.all([
        api.oauthStatus().catch(() => null),
        api.postableJobs().catch(() => ({ jobs: [] })),
        api.socialQueue().catch(() => null),
      ])
      setOauth(o)
      setPostable(Array.isArray(p) ? p : p?.jobs || p?.postable || [])
      setQueue(q)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const publishOne = async (jobId: string, dryRun = false) => {
    setBusy(true)
    try {
      await api.publish({ job_id: jobId, platform, dry_run: dryRun })
      alert(dryRun ? 'Dry-run ok' : 'Publish submitted')
      await load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const processQueue = async (dryRun = false) => {
    setBusy(true)
    try {
      await api.socialQueueProcess(dryRun)
      await load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Publish</h1>
          <p className="text-brand-text-dim text-sm mt-1">
            ShadowCast OAuth + social queue. Connect accounts in ShadowCast UI.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={scUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-2 text-sm">
            <ExternalLink className="w-4 h-4" /> Open ShadowCast
          </a>
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Share2 className="w-4 h-4" /> OAuth status</h2>
        {loading ? (
          <div className="h-16 bg-brand-border animate-pulse rounded" />
        ) : oauth ? (
          <pre className="text-xs overflow-auto max-h-48 text-brand-text-dim">{JSON.stringify(oauth, null, 2)}</pre>
        ) : (
          <p className="text-sm text-brand-text-dim">OAuth status unavailable — is ShadowCast online?</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-brand-text-dim">Platform</label>
        <select className="input-field text-sm" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {['youtube', 'tiktok', 'meta', 'rumble'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button disabled={busy} onClick={() => processQueue(false)} className="btn-primary text-sm flex items-center gap-1">
          <ListOrdered className="w-4 h-4" /> Process queue
        </button>
        <button disabled={busy} onClick={() => processQueue(true)} className="btn-secondary text-sm">Dry-run queue</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-border text-sm font-semibold">Postable jobs</div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border text-left">
              <th className="px-4 py-2 text-xs text-brand-text-dim uppercase">Job</th>
              <th className="px-4 py-2 text-xs text-brand-text-dim uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {postable.length === 0 ? (
              <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-brand-text-dim">No postable jobs</td></tr>
            ) : postable.map((j: any) => {
              const id = j.job_id || j.id || j.jobId
              return (
                <tr key={String(id)} className="border-b border-brand-border/50">
                  <td className="px-4 py-3 text-sm">
                    <p className="font-medium">{j.title || j.product_name || id}</p>
                    <p className="text-xs text-brand-text-dim">{id}</p>
                    {j.status && <StatusBadge status={j.status} />}
                  </td>
                  <td className="px-4 py-3">
                    <button disabled={busy} className="btn-primary text-xs flex items-center gap-1" onClick={() => publishOne(String(id), false)}>
                      <Send className="w-3 h-3" /> Publish
                    </button>
                    <button disabled={busy} className="btn-secondary text-xs ml-2" onClick={() => publishOne(String(id), true)}>
                      Dry-run
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold mb-3">Social queue</h2>
        {queue ? (
          <pre className="text-xs overflow-auto max-h-64 text-brand-text-dim">{JSON.stringify(queue, null, 2)}</pre>
        ) : (
          <p className="text-sm text-brand-text-dim">Queue empty or unavailable</p>
        )}
      </div>
    </div>
  )
}
