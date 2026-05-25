import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Settings, Save, RefreshCw, CheckCircle, Server, Brain, Film, ShoppingBag, Lock } from 'lucide-react'

interface ConfigField {
  key: string
  label: string
  description: string
  icon: any
  group: string
}

const CONFIG_FIELDS: ConfigField[] = [
  { key: 'shadowcast_url', label: 'ShadowCast URL', description: 'Base URL for the ShadowCast Flask backend', icon: Film, group: 'Services' },
  { key: 'apf_url', label: 'APF URL', description: 'Base URL for the APF Node.js backend', icon: ShoppingBag, group: 'Services' },
  { key: 'ollama_url', label: 'Ollama URL', description: 'Base URL for the Ollama API', icon: Brain, group: 'Services' },
  { key: 'internal_service_secret', label: 'Internal Service Secret', description: 'Shared secret for mission-control to talk to APF and ShadowCast', icon: Lock, group: 'Services' },
  { key: 'default_script_model', label: 'Script Generation Model', description: 'Ollama model used for generating video scripts', icon: Brain, group: 'Models' },
  { key: 'default_analysis_model', label: 'Product Analysis Model', description: 'Ollama model used for analyzing affiliate products', icon: Brain, group: 'Models' },
  { key: 'default_creative_model', label: 'Creative Writing Model', description: 'Ollama model for creative/alternative script styles', icon: Brain, group: 'Models' },
  { key: 'heavy_reasoning_model', label: 'Heavy Reasoning Model', description: 'Larger model for complex analysis (uses more VRAM)', icon: Brain, group: 'Models' },
]

export default function SettingsPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    api.getConfig().then(setConfig).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleSave = async (key: string) => {
    setSaving(key)
    try {
      await api.updateConfig(key, config[key])
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } catch (e: any) {
      alert(`Save failed: ${e.message}`)
    } finally {
      setSaving(null)
    }
  }

  const groups = [...new Set(CONFIG_FIELDS.map((f) => f.group))]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="space-y-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card animate-pulse"><div className="h-16 bg-brand-border rounded" /></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-brand-text-dim text-sm mt-1">Configure API endpoints and default models</p>
      </div>

      {groups.map((group) => (
        <div key={group} className="card">
          <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-4 flex items-center gap-2">
            {group === 'Services' ? <Server className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
            {group}
          </h3>
          <div className="space-y-4">
            {CONFIG_FIELDS.filter((f) => f.group === group).map((field) => (
              <div key={field.key} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-brand-surface flex items-center justify-center flex-shrink-0 mt-1">
                  <field.icon className="w-4 h-4 text-brand-accent" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-semibold">{field.label}</label>
                  <p className="text-xs text-brand-text-dim mb-2">{field.description}</p>
                  <div className="flex items-center gap-2">
                    <input
                      className="input-field flex-1 font-mono text-sm"
                      value={config[field.key] || ''}
                      onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                    />
                    <button
                      onClick={() => handleSave(field.key)}
                      disabled={saving === field.key}
                      className={`p-2 rounded-lg transition-colors ${
                        saved === field.key
                          ? 'bg-green-900/30 text-brand-success'
                          : 'bg-brand-surface hover:bg-brand-card text-brand-text-dim hover:text-brand-accent'
                      }`}
                    >
                      {saving === field.key ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : saved === field.key ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Reset to Defaults */}
      <div className="card border-brand-error/20">
        <h3 className="text-sm font-semibold text-brand-error uppercase tracking-wider mb-2">Danger Zone</h3>
        <p className="text-xs text-brand-text-dim mb-3">Reset all settings to their default values. This cannot be undone.</p>
        <button
          onClick={async () => {
            if (!confirm('Reset all settings to defaults?')) return
            const defaults: Record<string, string> = {
              shadowcast_url: 'http://localhost:5000',
              apf_url: 'http://localhost:3001',
              ollama_url: 'http://localhost:11434',
              default_script_model: 'llama3:8b',
              default_analysis_model: 'llama3:8b',
              default_creative_model: 'mistral:7b',
              heavy_reasoning_model: 'mixtral:8x7b-instruct-v0.1-q4_K_M',
            }
            for (const [key, value] of Object.entries(defaults)) {
              await api.updateConfig(key, value)
            }
            setConfig(defaults)
          }}
          className="px-4 py-2 rounded-lg border border-brand-error/30 text-brand-error text-sm hover:bg-red-900/20 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
