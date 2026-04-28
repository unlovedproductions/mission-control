import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import { Server, Cpu, Film, ShoppingBag } from 'lucide-react'

interface ServiceInfo {
  status: string
  url: string
}

export default function ServiceStatus() {
  const [services, setServices] = useState<Record<string, ServiceInfo>>({})
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await api.serviceStatus()
      setServices(data)
    } catch {
      setServices({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 15000)
    return () => clearInterval(interval)
  }, [])

  const icons: Record<string, any> = {
    shadowcast: Film,
    apf: ShoppingBag,
    ollama: Cpu,
  }

  const labels: Record<string, string> = {
    shadowcast: 'ShadowCast',
    apf: 'APF',
    ollama: 'Ollama',
  }

  if (loading) {
    return (
      <div className="flex gap-3">
        {['shadowcast', 'apf', 'ollama'].map((s) => (
          <div key={s} className="card flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-brand-border" />
            <div className="h-4 w-20 bg-brand-border rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-3 flex-wrap">
      {Object.entries(services).map(([key, info]) => {
        const Icon = icons[key] || Server
        const isOnline = info.status === 'online'
        return (
          <div
            key={key}
            className={`card flex items-center gap-3 min-w-[180px] ${
              isOnline ? 'border-green-800/30' : 'border-red-800/30'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                isOnline ? 'bg-green-900/30 text-brand-success' : 'bg-red-900/30 text-brand-error'
              }`}
            >
              <Icon size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold">{labels[key] || key}</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-brand-success' : 'bg-brand-error'}`}
                />
                <span className="text-xs text-brand-text-dim">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
