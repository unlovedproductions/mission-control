import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import {
  Video, Trash2, RefreshCw, Eye, Clock, Film, Download, Calendar, RotateCcw, Shield,
} from 'lucide-react'

interface Job {
  id: string
  product_id: string
  product_name: string
  status: string
  job_type: string
  script_model: string
  job_options: string
  short_form_path: string
  long_form_path: string
  script_json: string
  error_message: string
  created_at: string
  started_at: string
  completed_at: string
}

function parseJson(raw: string | undefined) {
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function parseJobMeta(job: Job) {
  const opts = parseJson(job.job_options)
  const script = parseJson(job.script_json)
  return { ...opts, ...script }
}

function scJobId(job: Job): string | null {
  const meta = parseJobMeta(job)
  return meta.shadowcast_job_id || null
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [scheduleJob, setScheduleJob] = useState<Job | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [readiness, setReadiness] = useState<any>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [audit, setAudit] = useState<any>(null)
  const [files, setFiles] = useState<any>(null)

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const data = await api.getJobs(filterStatus || undefined)
      setJobs(data.jobs)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchReadiness = async () => {
    try {
      setReadiness(await api.shadowcastReadiness())
    } catch {
      setReadiness(null)
    }
  }

  useEffect(() => { fetchJobs(); fetchReadiness() }, [filterStatus])

  useEffect(() => {
    const hasActive = jobs.some((j) => ['queued', 'generating_script', 'rendering'].includes(j.status))
    if (!hasActive) return
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [jobs])

  const handleDelete = async (id: string) => {
    if (!confirm('Cancel/delete this job? Soft-cancels MC poller; best-effort ShadowCast cancel.')) return
    try {
      await api.deleteJob(id)
      await fetchJobs()
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`)
    }
  }

  const handleRetry = async (job: Job) => {
    const id = scJobId(job)
    if (!id) return alert('No ShadowCast job id')
    setActionBusy('retry')
    try {
      await api.shadowcastRetryMissing(id)
      alert('Retry-missing submitted to ShadowCast')
      await fetchJobs()
    } catch (e: any) {
      alert(`Retry failed: ${e.message}`)
    } finally {
      setActionBusy(null)
    }
  }

  const handleAudit = async (job: Job) => {
    const id = scJobId(job)
    if (!id) return alert('No ShadowCast job id')
    setActionBusy('audit')
    try {
      setAudit(await api.shadowcastAudit(id))
      setFiles(await api.shadowcastFiles(id).catch(() => null))
    } catch (e: any) {
      alert(`Audit failed: ${e.message}`)
    } finally {
      setActionBusy(null)
    }
  }

  const handleSchedule = async () => {
    if (!scheduleJob || !scheduleDate) return
    setScheduling(true)
    try {
      const meta = parseJobMeta(scheduleJob)
      await api.createCalendarEvent({
        title: scheduleJob.product_name,
        scheduled_date: scheduleDate,
        product_id: scheduleJob.product_id,
        video_job_id: scheduleJob.id,
        platform: 'youtube',
        event_type: 'video_publish',
        shadowcast_job_id: meta.shadowcast_job_id || '',
        publish_target: 'youtube',
        description: `Scheduled from job ${scheduleJob.id.slice(0, 8)}`,
      })
      setScheduleJob(null)
      setScheduleDate('')
      alert('Calendar event created')
    } catch (e: any) {
      alert(`Schedule failed: ${e.message}`)
    } finally {
      setScheduling(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return <Clock className="w-5 h-5 text-brand-warning" />
      case 'generating_script': return <RefreshCw className="w-5 h-5 text-brand-warning animate-spin" />
      case 'rendering': return <Film className="w-5 h-5 text-brand-accent animate-pulse" />
      case 'completed': return <Video className="w-5 h-5 text-brand-success" />
      case 'partial': return <Film className="w-5 h-5 text-brand-warning" />
      default: return <Video className="w-5 h-5 text-brand-error" />
    }
  }

  const ready = readiness?.ready !== false
  const blockers = readiness?.blockers || readiness?.components

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video Production Queue</h1>
          <p className="text-brand-text-dim text-sm mt-1">Track script generation and video rendering jobs</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="input-field text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="generating_script">Generating Script</option>
            <option value="rendering">Rendering</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={() => { fetchJobs(); fetchReadiness() }} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {readiness && (
        <div className={`card border ${ready ? 'border-brand-success/30' : 'border-brand-warning/40'}`}>
          <div className="flex items-center gap-2 text-sm">
            <Shield className={`w-4 h-4 ${ready ? 'text-brand-success' : 'text-brand-warning'}`} />
            <span className="font-medium">ShadowCast readiness: {ready ? 'ready' : 'blocked'}</span>
          </div>
          {!ready && blockers && (
            <pre className="mt-2 text-xs text-brand-text-dim overflow-auto max-h-24">
              {typeof blockers === 'string' ? blockers : JSON.stringify(blockers, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 bg-brand-border rounded-lg" />
              <div className="flex-1"><div className="h-4 w-48 bg-brand-border rounded mb-2" /><div className="h-3 w-32 bg-brand-border rounded" /></div>
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="card text-center py-12">
            <Video className="w-10 h-10 mx-auto mb-3 text-brand-text-dim opacity-50" />
            <p className="text-brand-text-dim">No video jobs yet. Create one from the Product Pipeline.</p>
          </div>
        ) : (
          jobs.map((job) => {
            const meta = parseJobMeta(job)
            return (
              <div key={job.id} className="card flex items-center gap-4 hover:border-brand-accent/30 transition-colors cursor-pointer" onClick={() => { setSelectedJob(job); setAudit(null); setFiles(null) }}>
                <div className="w-10 h-10 rounded-lg bg-brand-surface flex items-center justify-center flex-shrink-0">
                  {getStatusIcon(job.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{job.product_name}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-brand-text-dim">
                      {job.job_type === 'both' ? 'Short + Long' : job.job_type}
                    </span>
                    {meta.video_preset && (
                      <span className="text-xs text-brand-text-dim">preset:{meta.video_preset}</span>
                    )}
                    {meta.current_step && (
                      <span className="text-xs text-brand-accent">{meta.current_step}</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={job.status} />
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {(job.status === 'completed' || job.status === 'partial') && (
                    <button onClick={() => setScheduleJob(job)} className="p-2 rounded-lg hover:bg-brand-surface text-brand-text-dim hover:text-brand-accent" title="Schedule">
                      <Calendar className="w-4 h-4" />
                    </button>
                  )}
                  {job.status === 'partial' && (
                    <button onClick={() => handleRetry(job)} className="p-2 rounded-lg hover:bg-brand-surface text-brand-text-dim hover:text-brand-warning" title="Retry missing">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => { setSelectedJob(job); handleAudit(job) }} className="p-2 rounded-lg hover:bg-brand-surface text-brand-text-dim" title="Details">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(job.id)} className="p-2 rounded-lg hover:bg-brand-surface text-brand-text-dim hover:text-brand-error">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {selectedJob && (() => {
        const meta = parseJobMeta(selectedJob)
        const hooks = meta.hook_types || []
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
            <div className="bg-brand-card border border-brand-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold">{selectedJob.product_name}</h2>
                  <p className="text-sm text-brand-text-dim">Job ID: {selectedJob.id.slice(0, 8)}...</p>
                  {meta.shadowcast_job_id && (
                    <p className="text-xs text-brand-text-dim mt-1">SC: {meta.shadowcast_job_id}</p>
                  )}
                </div>
                <StatusBadge status={selectedJob.status} size="md" />
              </div>

              <div className="flex gap-2 mb-4">
                {selectedJob.status === 'partial' && (
                  <button disabled={actionBusy === 'retry'} onClick={() => handleRetry(selectedJob)} className="btn-secondary text-sm flex items-center gap-1">
                    <RotateCcw className="w-3.5 h-3.5" /> Retry missing
                  </button>
                )}
                {meta.shadowcast_job_id && (
                  <button disabled={actionBusy === 'audit'} onClick={() => handleAudit(selectedJob)} className="btn-secondary text-sm">
                    Load audit / files
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-brand-surface rounded-lg p-3">
                  <p className="text-xs text-brand-text-dim">Type</p>
                  <p className="text-sm font-semibold capitalize">{selectedJob.job_type === 'both' ? 'Short + Long' : selectedJob.job_type}</p>
                </div>
                <div className="bg-brand-surface rounded-lg p-3">
                  <p className="text-xs text-brand-text-dim">Model</p>
                  <p className="text-sm font-semibold">{selectedJob.script_model || meta.script_model || 'Default'}</p>
                </div>
                {meta.video_preset && (
                  <div className="bg-brand-surface rounded-lg p-3">
                    <p className="text-xs text-brand-text-dim">Video preset</p>
                    <p className="text-sm font-semibold">{meta.video_preset}</p>
                  </div>
                )}
                {meta.content_style && (
                  <div className="bg-brand-surface rounded-lg p-3">
                    <p className="text-xs text-brand-text-dim">Style</p>
                    <p className="text-sm font-semibold">{String(meta.content_style).replace(/_/g, ' ')}</p>
                  </div>
                )}
                {hooks.length > 0 && (
                  <div className="bg-brand-surface rounded-lg p-3">
                    <p className="text-xs text-brand-text-dim">Hooks</p>
                    <p className="text-sm font-semibold">{hooks.join(', ')}</p>
                  </div>
                )}
              </div>

              {selectedJob.error_message && (
                <div className="mb-4 bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                  <p className="text-sm text-brand-error">{selectedJob.error_message}</p>
                </div>
              )}

              {selectedJob.short_form_path && (
                <div className="mb-2 bg-brand-surface rounded-lg p-3">
                  <a href={selectedJob.short_form_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-accent hover:underline">
                    <Download className="w-4 h-4" /> Download short form
                  </a>
                </div>
              )}
              {selectedJob.long_form_path && (
                <div className="mb-4 bg-brand-surface rounded-lg p-3">
                  <a href={selectedJob.long_form_path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-accent hover:underline">
                    <Download className="w-4 h-4" /> Download long form
                  </a>
                </div>
              )}

              {audit && (
                <div className="mb-4 bg-brand-surface rounded-lg p-3">
                  <p className="text-xs text-brand-text-dim mb-1">Audit</p>
                  <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(audit, null, 2)}</pre>
                </div>
              )}
              {files && (
                <div className="mb-4 bg-brand-surface rounded-lg p-3">
                  <p className="text-xs text-brand-text-dim mb-1">Files</p>
                  <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(files, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {scheduleJob && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setScheduleJob(null)}>
          <div className="bg-brand-card border border-brand-border rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Schedule publish</h2>
            <input type="datetime-local" className="input-field w-full mb-4" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary" onClick={() => setScheduleJob(null)}>Cancel</button>
              <button className="btn-primary" disabled={scheduling || !scheduleDate} onClick={handleSchedule}>
                {scheduling ? 'Saving...' : 'Create event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
