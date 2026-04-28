import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import { Video, Trash2, RefreshCw, Eye, Clock, Film } from 'lucide-react'

interface Job {
  id: string
  product_id: string
  product_name: string
  status: string
  job_type: string
  script_model: string
  short_form_path: string
  long_form_path: string
  script_json: string
  error_message: string
  created_at: string
  started_at: string
  completed_at: string
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

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

  useEffect(() => { fetchJobs() }, [filterStatus])

  // Auto-refresh for active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => ['queued', 'generating_script', 'rendering'].includes(j.status))
    if (!hasActive) return
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [jobs])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job?')) return
    try {
      await api.deleteJob(id)
      await fetchJobs()
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return <Clock className="w-5 h-5 text-brand-warning" />
      case 'generating_script': return <RefreshCw className="w-5 h-5 text-brand-warning animate-spin" />
      case 'rendering': return <Film className="w-5 h-5 text-brand-accent animate-pulse" />
      case 'completed': return <Video className="w-5 h-5 text-brand-success" />
      default: return <Video className="w-5 h-5 text-brand-error" />
    }
  }

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
            <option value="failed">Failed</option>
          </select>
          <button onClick={fetchJobs} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 bg-brand-border rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-brand-border rounded mb-2" />
                <div className="h-3 w-32 bg-brand-border rounded" />
              </div>
            </div>
          ))
        ) : jobs.length === 0 ? (
          <div className="card text-center py-12">
            <Video className="w-10 h-10 mx-auto mb-3 text-brand-text-dim opacity-50" />
            <p className="text-brand-text-dim">No video jobs yet. Create one from the Product Pipeline.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="card flex items-center gap-4 hover:border-brand-accent/30 transition-colors cursor-pointer"
              onClick={() => setSelectedJob(job)}
            >
              <div className="w-10 h-10 rounded-lg bg-brand-surface flex items-center justify-center flex-shrink-0">
                {getStatusIcon(job.status)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{job.product_name}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-brand-text-dim">
                    {job.job_type === 'both' ? 'Short + Long' : job.job_type === 'short' ? 'Short Form' : 'Long Form'}
                  </span>
                  <span className="text-xs text-brand-text-dim">Model: {job.script_model || 'default'}</span>
                  <span className="text-xs text-brand-text-dim">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <StatusBadge status={job.status} />
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setSelectedJob(job)}
                  className="p-2 rounded-lg hover:bg-brand-surface text-brand-text-dim hover:text-brand-text transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="p-2 rounded-lg hover:bg-brand-surface text-brand-text-dim hover:text-brand-error transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-brand-card border border-brand-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedJob.product_name}</h2>
                <p className="text-sm text-brand-text-dim">Job ID: {selectedJob.id.slice(0, 8)}...</p>
              </div>
              <StatusBadge status={selectedJob.status} size="md" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Type</p>
                <p className="text-sm font-semibold capitalize">{selectedJob.job_type === 'both' ? 'Short + Long' : selectedJob.job_type}</p>
              </div>
              <div className="bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Model</p>
                <p className="text-sm font-semibold">{selectedJob.script_model || 'Default'}</p>
              </div>
              <div className="bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Created</p>
                <p className="text-sm font-semibold">{new Date(selectedJob.created_at).toLocaleString()}</p>
              </div>
              <div className="bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Completed</p>
                <p className="text-sm font-semibold">{selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleString() : '—'}</p>
              </div>
            </div>

            {selectedJob.error_message && (
              <div className="mb-4 bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                <p className="text-sm text-brand-error font-semibold mb-1">Error</p>
                <p className="text-sm text-brand-error/80">{selectedJob.error_message}</p>
              </div>
            )}

            {selectedJob.short_form_path && (
              <div className="mb-2 bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Short Form Output</p>
                <p className="text-sm font-mono truncate">{selectedJob.short_form_path}</p>
              </div>
            )}
            {selectedJob.long_form_path && (
              <div className="mb-4 bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Long Form Output</p>
                <p className="text-sm font-mono truncate">{selectedJob.long_form_path}</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-brand-border">
              <button onClick={() => setSelectedJob(null)} className="btn-secondary ml-auto">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
