import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Settings, Save, RefreshCw, CheckCircle, Server, Brain, Film, ShoppingBag, Lock, Key } from 'lucide-react'

interface ConfigField {
  key: string
  label: string
  description: string
  icon: any
  group: string
  secret?: boolean
}

const CONFIG_FIELDS: ConfigField[] = [
  { key: 'shadowcast_url', label: 'ShadowCast URL', description: 'Base URL for the ShadowCast backend', icon: Film, group: 'Services' },
  { key: 'apf_url', label: 'APF URL', description: 'Base URL for the APF Node.js backend', icon: ShoppingBag, group: 'Services' },
  { key: 'ollama_url', label: 'Ollama URL', description: 'Base URL for the Ollama API', icon: Brain, group: 'Services' },
  { key: 'internal_service_secret', label: 'Internal Service Secret', description: 'Shared secret — must match APF and ShadowCast INTERNAL_SERVICE_SECRET', icon: Lock, group: 'Services', secret: true },
  { key: 'apf_session_cookie', label: 'APF Session Cookie (fallback)', description: 'Optional app_session_id if service key is unavailable', icon: Key, group: 'Services', secret: true },
  { key: 'default_script_model', label: 'Script Generation Model', description: 'Ollama model for video scripts', icon: Brain, group: 'Models' },
  { key: 'default_analysis_model', label: 'Product Analysis Model', description: 'Ollama model for product analysis', icon: Brain, group: 'Models' },
  { key: 'default_creative_model', label: 'Creative Writing Model', description: 'Alternative script styles', icon: Brain, group: 'Models' },
  { key: 'heavy_reasoning_model', label: 'Heavy Reasoning Model', description: 'Larger model for complex analysis', icon: Brain, group: 'Models' },
  { key: 'default_hook_types', label: 'Default Hook Types', description: 'Comma-separated hook ids (e.g. curiosity,listicle)', icon: Brain, group: 'Pipeline' },
  { key: 'default_content_style', label: 'Default Content Style', description: 'Default ShadowCast content style for jobs', icon: Brain, group: 'Pipeline' },
]

const MARKETPLACES = ['warriorplus', 'digistore24', 'clickbank', 'shareasale']

export default function SettingsPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [secretsConfigured, setSecretsConfigured] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Record<string, any>>({})
  const [credInputs, setCredInputs] = useState<Record<string, string>>({})
  const [savingCred, setSavingCred] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.getConfig(), api.getApfCredentials().catch(() => ({ credentials: {} }))])
      .then(([cfg, creds]) => {
        const next: Record<string, string> = { ...cfg }
        const configured: Record<string, boolean> = {}
        // Never bind masked secret display values into inputs — saving them
        // would overwrite the real INTERNAL_SERVICE_SECRET / session cookie.
        for (const field of CONFIG_FIELDS) {
          if (field.secret) {
            configured[field.key] = Boolean(cfg[field.key])
            next[field.key] = ''
          }
        }
        setConfig(next)
        setSecretsConfigured(configured)
        setCredentials(creds.credentials || {})
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (key: string) => {
    const field = CONFIG_FIELDS.find((f) => f.key === key)
    if (field?.secret && !(config[key] || '').trim()) {
      alert('Enter a new secret to update. Leave blank to keep the current value.')
      return
    }
    setSaving(key)
    try {
      const result = await api.updateConfig(key, config[key])
      if (result?.reason === 'refused_masked_secret') {
        alert('Refused to save a masked secret. Enter the real value.')
        return
      }
      setSaved(key)
      if (field?.secret) {
        setSecretsConfigured((prev) => ({ ...prev, [key]: true }))
        setConfig((prev) => ({ ...prev, [key]: '' }))
      }
      setTimeout(() => setSaved(null), 2000)
    } catch (e: any) {
      alert(`Save failed: ${e.message}`)
    } finally {
      setSaving(null)
    }
  }

  const handleSaveCredential = async (platform: string) => {
    const apiKey = credInputs[platform]
    if (!apiKey) return
    setSavingCred(platform)
    try {
      await api.saveApfCredential(platform, apiKey)
      setCredInputs({ ...credInputs, [platform]: '' })
      const creds = await api.getApfCredentials()
      setCredentials(creds.credentials || {})
    } catch (e: any) {
      alert(`Credential save failed: ${e.message}`)
    } finally {
      setSavingCred(null)
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
        <p className="text-brand-text-dim text-sm mt-1">Configure endpoints, secrets, and pipeline defaults</p>
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
                  <p className="text-xs text-brand-text-dim mb-2">
                    {field.description}
                    {field.secret && secretsConfigured[field.key] ? ' — currently set' : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type={field.secret ? 'password' : 'text'}
                      className="input-field flex-1 font-mono text-sm"
                      value={config[field.key] || ''}
                      placeholder={field.secret ? (secretsConfigured[field.key] ? 'Leave blank to keep current' : '••••••••') : ''}
                      onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                    />
                    <button onClick={() => handleSave(field.key)} disabled={saving === field.key}
                      className={`p-2 rounded-lg transition-colors ${saved === field.key ? 'bg-green-900/30 text-brand-success' : 'bg-brand-surface hover:bg-brand-card text-brand-text-dim hover:text-brand-accent'}`}>
                      {saving === field.key ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved === field.key ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-4 flex items-center gap-2">
          <Key className="w-4 h-4" /> APF Marketplace Credentials
        </h3>
        <div className="space-y-4">
          {MARKETPLACES.map((platform) => (
            <div key={platform} className="flex items-center gap-3">
              <div className="w-32 text-sm capitalize">{platform}</div>
              <span className="text-xs text-brand-text-dim w-20">
                {credentials[platform]?.isActive ? 'Active' : 'Not set'}
              </span>
              <input
                type="password"
                className="input-field flex-1 text-sm"
                placeholder="API key..."
                value={credInputs[platform] || ''}
                onChange={(e) => setCredInputs({ ...credInputs, [platform]: e.target.value })}
              />
              <button onClick={() => handleSaveCredential(platform)} disabled={savingCred === platform} className="btn-secondary text-sm">
                {savingCred === platform ? 'Saving...' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card border-brand-error/20">
        <h3 className="text-sm font-semibold text-brand-error uppercase tracking-wider mb-2">Danger Zone</h3>
        <p className="text-xs text-brand-text-dim mb-3">Reset settings to defaults. Secrets are cleared — set INTERNAL_SERVICE_SECRET in env or re-enter manually.</p>
        <button
          onClick={async () => {
            if (!confirm('Reset all settings to defaults?')) return
            const defaults: Record<string, string> = {
              shadowcast_url: 'http://localhost:8000',
              apf_url: 'http://localhost:3000',
              ollama_url: 'http://localhost:11434',
              internal_service_secret: '',
              apf_session_cookie: '',
              default_script_model: 'llama3.1:8b',
              default_analysis_model: 'llama3.1:8b',
              default_creative_model: 'mistral:7b-instruct',
              heavy_reasoning_model: 'mixtral:8x7b-instruct-v0.1-q4_K_M',
              default_hook_types: 'curiosity',
              default_content_style: 'honest_review',
            }
            for (const [key, value] of Object.entries(defaults)) {
              await api.updateConfig(key, value)
            }
            setConfig({ ...defaults })
            setSecretsConfigured({})
          }}
          className="btn-secondary text-sm text-brand-error border-brand-error/30"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
