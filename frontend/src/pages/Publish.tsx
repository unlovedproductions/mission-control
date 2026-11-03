import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import { Share2, RefreshCw, ExternalLink, Send, ListOrdered, CalendarClock } from 'lucide-react'

type Variant = {
  hook_type: string
  video_format: string
  product_slug?: string | null
  label?: string
  caption_hint?: string
  hashtags?: string[]
}

type PostableJob = {
  job_id: string
  product_name?: string
  status?: string
  variants?: Variant[]
}

const PLATFORMS = ['youtube', 'tiktok', 'meta', 'rumble']

export default function Publish() {
  const [oauth, setOauth] = useState<any>(null)
  const [postable, setPostable] = useState<PostableJob[]>([])
  const [queue, setQueue] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState('youtube')
  const [batchPlatforms, setBatchPlatforms] = useState<string[]>(['youtube'])
  const [busy, setBusy] = useState(false)
  const [scUrl, setScUrl] = useState('http://localhost:8000')
  const [scheduleAt, setScheduleAt] = useState('')
  const [selectedKey, setSelectedKey] = useState<string>('')

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
      const jobs: PostableJob[] = Array.isArray(p) ? p : p?.jobs || p?.postable || []
      setPostable(jobs)
      setQueue(q)
      if (!selectedKey && jobs[0]?.variants?.[0]) {
        const v = jobs[0].variants[0]
        setSelectedKey(`${jobs[0].job_id}|${v.hook_type}|${v.video_format}|${v.product_slug || ''}`)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const parseKey = (key: string) => {
    const [job_id, hook_type, video_format, product_slug] = key.split('|')
    return { job_id, hook_type, video_format, product_slug: product_slug || undefined }
  }

  const publishOne = async (dryRun = false) => {
    if (!selectedKey) return alert('Select a variant first')
    const sel = parseKey(selectedKey)
    setBusy(true)
    try {
      await api.publish({
        job_id: sel.job_id,
        platform,
        hook_type: sel.hook_type,
        video_format: sel.video_format,
        product_slug: sel.product_slug,
        dry_run: dryRun,
      })
      alert(dryRun ? 'Dry-run ok' : 'Publish submitted')
      await load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const publishBatch = async (dryRun = false) => {
    if (!selectedKey) return alert('Select a variant first')
    if (batchPlatforms.length === 0) return alert('Pick at least one platform')
    const sel = parseKey(selectedKey)
    setBusy(true)
    try {
      await api.publishBatch({
        job_id: sel.job_id,
        hook_type: sel.hook_type,
        video_format: sel.video_format,
        product_slug: sel.product_slug,
        platforms: batchPlatforms,
        dry_run: dryRun,
      })
      alert(dryRun ? 'Batch dry-run ok' : 'Batch publish submitted')
      await load()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const scheduleOne = async () => {
    if (!selectedKey) return alert('Select a variant first')
    if (!scheduleAt) return alert('Pick a schedule time')
    const sel = parseKey(selectedKey)
    const job = postable.find((j) => j.job_id === sel.job_id)
    const variant = job?.variants?.find(
      (v) => v.hook_type === sel.hook_type && v.video_format === sel.video_format,
    )
    setBusy(true)
    try {
      await api.socialSchedule({
        job_id: sel.job_id,
        platform,
        scheduled_time: new Date(scheduleAt).toISOString(),
        hook_type: sel.hook_type,
        video_format: sel.video_format,
        product_slug: sel.product_slug,
        caption: variant?.caption_hint || job?.product_name || '',
        hashtags: variant?.hashtags || [],
      })
      alert('Scheduled in ShadowCast social queue')
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

  const toggleBatchPlatform = (p: string) => {
    setBatchPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Publish</h1>
          <p className="text-brand-text-dim text-sm mt-1">
            ShadowCast variants → publish / schedule / queue. Connect OAuth in ShadowCast UI.
            Set <code className="text-xs">MC_DASHBOARD_TOKEN</code> before live posts.
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

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-brand-text-dim">Primary platform</label>
          <select className="input-field text-sm" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button disabled={busy} onClick={() => processQueue(false)} className="btn-primary text-sm flex items-center gap-1">
            <ListOrdered className="w-4 h-4" /> Process queue
          </button>
          <button disabled={busy} onClick={() => processQueue(true)} className="btn-secondary text-sm">Dry-run queue</button>
        </div>
        <div>
          <p className="text-xs text-brand-text-dim mb-2">Batch platforms (ShadowCast: one variant → many platforms)</p>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map((p) => (
              <label key={p} className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={batchPlatforms.includes(p)} onChange={() => toggleBatchPlatform(p)} />
                {p}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CalendarClock className="w-4 h-4 text-brand-text-dim" />
          <input
            type="datetime-local"
            className="input-field text-sm"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
          <button disabled={busy} onClick={scheduleOne} className="btn-secondary text-sm">Schedule selected</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-border text-sm font-semibold">Postable variants</div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border text-left">
              <th className="px-4 py-2 text-xs text-brand-text-dim uppercase">Select</th>
              <th className="px-4 py-2 text-xs text-brand-text-dim uppercase">Job / variant</th>
              <th className="px-4 py-2 text-xs text-brand-text-dim uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {postable.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-brand-text-dim">No postable jobs</td></tr>
            ) : postable.flatMap((j) => {
              const variants = j.variants?.length ? j.variants : [{ hook_type: 'curiosity', video_format: 'short_form' }]
              return variants.map((v) => {
                const key = `${j.job_id}|${v.hook_type}|${v.video_format}|${v.product_slug || ''}`
                return (
                  <tr key={key} className="border-b border-brand-border/50">
                    <td className="px-4 py-3">
                      <input type="radio" name="variant" checked={selectedKey === key} onChange={() => setSelectedKey(key)} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{j.product_name || j.job_id}</p>
                      <p className="text-xs text-brand-text-dim">
                        {v.label || `${v.hook_type} · ${v.video_format}`}
                      </p>
                      <p className="text-xs text-brand-text-dim">{j.job_id}</p>
                      {j.status && <StatusBadge status={j.status} />}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={busy}
                        className="btn-primary text-xs flex items-center gap-1"
                        onClick={() => { setSelectedKey(key); void publishOne(false) }}
                      >
                        <Send className="w-3 h-3" /> Publish
                      </button>
                      <button disabled={busy} className="btn-secondary text-xs ml-2" onClick={() => { setSelectedKey(key); void publishOne(true) }}>
                        Dry-run
                      </button>
                      <button disabled={busy} className="btn-secondary text-xs ml-2" onClick={() => { setSelectedKey(key); void publishBatch(false) }}>
                        Batch
                      </button>
                    </td>
                  </tr>
                )
              })
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
