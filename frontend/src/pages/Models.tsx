import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Brain, Download, RefreshCw, Cpu, HardDrive, Zap, CheckCircle } from 'lucide-react'

interface OllamaModel {
  name: string
  model: string
  size: number
  digest: string
  modified_at: string
  details?: {
    format: string
    family: string
    parameter_size: string
    quantization_level: string
  }
}

interface RunningModel {
  name: string
  size: number
  size_vram: number
}

const RECOMMENDED_MODELS = [
  {
    name: 'llama3:8b',
    description: 'Best all-rounder for script generation and product analysis. Fast inference on RTX 3080.',
    vram: '~5GB',
    use: 'Script Generation, Product Analysis',
    speed: 'Fast',
  },
  {
    name: 'mistral:7b',
    description: 'Strong creative writing model. Good for varied script styles and hooks.',
    vram: '~4.5GB',
    use: 'Creative Writing, Alternative Scripts',
    speed: 'Fast',
  },
  {
    name: 'mixtral:8x7b-instruct-v0.1-q4_K_M',
    description: 'Mixture of experts model. Smarter reasoning but slower. Fits in 16GB VRAM with Q4 quantization.',
    vram: '~14GB',
    use: 'Heavy Reasoning, Complex Analysis',
    speed: 'Slower',
  },
  {
    name: 'codestral:22b-v0.1-q4_K_M',
    description: 'Code-focused model. Useful for generating structured JSON scripts and technical content.',
    vram: '~13GB',
    use: 'Structured Output, Technical Scripts',
    speed: 'Moderate',
  },
  {
    name: 'llama3.1:8b',
    description: 'Updated Llama 3 with 128K context. Better for long-form video scripts.',
    vram: '~5GB',
    use: 'Long-Form Scripts, Extended Context',
    speed: 'Fast',
  },
]

export default function Models() {
  const [models, setModels] = useState<OllamaModel[]>([])
  const [running, setRunning] = useState<RunningModel[]>([])
  const [recommended, setRecommended] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [ollamaOnline, setOllamaOnline] = useState(false)
  const [pulling, setPulling] = useState<string | null>(null)

  const fetchModels = async () => {
    try {
      const data = await api.ollamaModels()
      if (data.status === 'ok') {
        setModels(data.models || [])
        setRecommended(data.recommended || {})
        setOllamaOnline(true)
      } else {
        setOllamaOnline(false)
      }
    } catch {
      setOllamaOnline(false)
    }

    try {
      const runData = await api.ollamaRunning()
      setRunning(runData.models || [])
    } catch {}

    setLoading(false)
  }

  useEffect(() => { fetchModels() }, [])

  const handlePull = async (modelName: string) => {
    setPulling(modelName)
    try {
      await api.ollamaPull(modelName)
      // Poll for completion
      setTimeout(fetchModels, 5000)
    } catch (e: any) {
      alert(`Pull failed: ${e.message}`)
    } finally {
      setPulling(null)
    }
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '—'
    const gb = bytes / (1024 * 1024 * 1024)
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }

  const isInstalled = (name: string) => models.some((m) => m.name === name || m.model === name)
  const isRunning = (name: string) => running.some((m) => m.name.startsWith(name.split(':')[0]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ollama Model Manager</h1>
          <p className="text-brand-text-dim text-sm mt-1">
            Manage local LLM models — optimized for RTX 3080 16GB VRAM
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${ollamaOnline ? 'bg-green-900/20 text-brand-success' : 'bg-red-900/20 text-brand-error'}`}>
            <span className={`w-2 h-2 rounded-full ${ollamaOnline ? 'bg-brand-success' : 'bg-brand-error'}`} />
            Ollama {ollamaOnline ? 'Online' : 'Offline'}
          </div>
          <button onClick={fetchModels} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Hardware Info Card */}
      <div className="card bg-gradient-to-r from-brand-card to-brand-surface">
        <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-3">Your Hardware</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-brand-accent" />
            <div>
              <p className="text-xs text-brand-text-dim">GPU</p>
              <p className="text-sm font-semibold">RTX 3080 16GB</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-brand-warning" />
            <div>
              <p className="text-xs text-brand-text-dim">CUDA Cores</p>
              <p className="text-sm font-semibold">6,144</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xs text-brand-text-dim">System RAM</p>
              <p className="text-sm font-semibold">32GB DDR4</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-xs text-brand-text-dim">Max Model Size</p>
              <p className="text-sm font-semibold">~13B Q4 / 8B FP16</p>
            </div>
          </div>
        </div>
      </div>

      {/* Currently Running */}
      {running.length > 0 && (
        <div className="card border-brand-success/20">
          <h3 className="text-sm font-semibold text-brand-success uppercase tracking-wider mb-3">Currently Loaded in VRAM</h3>
          <div className="space-y-2">
            {running.map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-brand-surface rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-success animate-pulse" />
                  <span className="text-sm font-semibold font-mono">{m.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-brand-text-dim">
                  <span>Total: {formatSize(m.size)}</span>
                  <span>VRAM: {formatSize(m.size_vram)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installed Models */}
      <div className="card">
        <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-3">
          Installed Models ({models.length})
        </h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-brand-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <p className="text-brand-text-dim text-sm py-4">
            {ollamaOnline ? 'No models installed. Pull one from the recommendations below.' : 'Ollama is offline. Start it with: ollama serve'}
          </p>
        ) : (
          <div className="space-y-2">
            {models.map((model) => (
              <div key={model.digest || model.name} className="flex items-center justify-between bg-brand-surface rounded-lg p-3">
                <div>
                  <p className="text-sm font-semibold font-mono">{model.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {model.details && (
                      <>
                        <span className="text-xs text-brand-text-dim">{model.details.parameter_size}</span>
                        <span className="text-xs text-brand-text-dim">{model.details.quantization_level}</span>
                        <span className="text-xs text-brand-text-dim">{model.details.family}</span>
                      </>
                    )}
                    <span className="text-xs text-brand-text-dim">{formatSize(model.size)}</span>
                  </div>
                </div>
                {isRunning(model.name) && (
                  <span className="badge-success">Running</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Models */}
      <div className="card">
        <h3 className="text-sm font-semibold text-brand-accent uppercase tracking-wider mb-3">
          Recommended for Your RTX 3080
        </h3>
        <div className="space-y-3">
          {RECOMMENDED_MODELS.map((rec) => {
            const installed = isInstalled(rec.name)
            return (
              <div key={rec.name} className={`bg-brand-surface rounded-lg p-4 border ${installed ? 'border-green-800/30' : 'border-brand-border'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold font-mono">{rec.name}</p>
                      {installed && <CheckCircle className="w-4 h-4 text-brand-success" />}
                    </div>
                    <p className="text-xs text-brand-text-dim mt-1">{rec.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-brand-text-dim">VRAM: {rec.vram}</span>
                      <span className="text-xs text-brand-text-dim">Use: {rec.use}</span>
                      <span className="text-xs text-brand-text-dim">Speed: {rec.speed}</span>
                    </div>
                  </div>
                  {!installed && (
                    <button
                      onClick={() => handlePull(rec.name)}
                      disabled={pulling === rec.name}
                      className="btn-primary flex items-center gap-2 text-sm ml-4"
                    >
                      {pulling === rec.name ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {pulling === rec.name ? 'Pulling...' : 'Pull'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
