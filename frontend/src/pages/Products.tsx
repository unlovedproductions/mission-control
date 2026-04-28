import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import {
  Package, Search, Download, Brain, Video, Filter, RefreshCw, ExternalLink, ChevronDown,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  marketplace: string
  price: string
  commission: string
  gravity_score: number
  category: string
  url: string
  description: string
  status: string
  ai_analysis: string
  created_at: string
}

const MARKETPLACES = ['warriorplus', 'digistore24', 'clickbank', 'shareasale']

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [filterMarketplace, setFilterMarketplace] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [importMarketplace, setImportMarketplace] = useState('clickbank')

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterMarketplace) params.marketplace = filterMarketplace
      if (filterStatus) params.status = filterStatus
      const data = await api.getProducts(params)
      setProducts(data.products)
      setTotal(data.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [filterMarketplace, filterStatus])

  const handleImport = async () => {
    setImporting(true)
    try {
      await api.importProducts(importMarketplace, 20)
      await fetchProducts()
    } catch (e: any) {
      alert(`Import failed: ${e.message}. Make sure APF is running.`)
    } finally {
      setImporting(false)
    }
  }

  const handleAnalyze = async (id: string) => {
    setAnalyzing(id)
    try {
      const result = await api.analyzeProduct(id)
      await fetchProducts()
      const updated = products.find((p) => p.id === id)
      if (updated) setSelectedProduct({ ...updated, ai_analysis: result.analysis, status: 'analyzed' })
    } catch (e: any) {
      alert(`Analysis failed: ${e.message}. Make sure Ollama is running.`)
    } finally {
      setAnalyzing(null)
    }
  }

  const handleCreateJob = async (product: Product) => {
    try {
      await api.createJob(product.id, 'both')
      alert(`Video job queued for "${product.name}"`)
    } catch (e: any) {
      alert(`Failed to create job: ${e.message}`)
    }
  }

  const filtered = products.filter((p) =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Pipeline</h1>
          <p className="text-brand-text-dim text-sm mt-1">Import from APF, analyze, and send to ShadowCast</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input-field text-sm"
            value={importMarketplace}
            onChange={(e) => setImportMarketplace(e.target.value)}
          >
            {MARKETPLACES.map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
          <button onClick={handleImport} disabled={importing} className="btn-primary flex items-center gap-2">
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {importing ? 'Importing...' : 'Import from APF'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dim" />
          <input
            type="text"
            placeholder="Search products..."
            className="input-field w-full pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="input-field text-sm" value={filterMarketplace} onChange={(e) => setFilterMarketplace(e.target.value)}>
          <option value="">All Marketplaces</option>
          {MARKETPLACES.map((m) => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
        <select className="input-field text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="analyzed">Analyzed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={fetchProducts} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Product Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border text-left">
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase tracking-wider">Product</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase tracking-wider">Marketplace</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase tracking-wider">Commission</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-brand-border/50 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-40 bg-brand-border rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-brand-border rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-12 bg-brand-border rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-12 bg-brand-border rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-brand-border rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-brand-border rounded" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-brand-text-dim">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No products found. Import some from APF to get started.</p>
                </td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-brand-border/50 hover:bg-brand-surface/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedProduct(product)}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium truncate max-w-[250px]">{product.name}</p>
                    <p className="text-xs text-brand-text-dim truncate max-w-[250px]">{product.category}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm capitalize">{product.marketplace}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{product.price || '—'}</td>
                  <td className="px-4 py-3 text-sm">{product.commission || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={product.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleAnalyze(product.id)}
                        disabled={analyzing === product.id}
                        className="p-1.5 rounded-lg hover:bg-brand-card text-brand-text-dim hover:text-brand-accent transition-colors"
                        title="Analyze with AI"
                      >
                        {analyzing === product.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCreateJob(product)}
                        className="p-1.5 rounded-lg hover:bg-brand-card text-brand-text-dim hover:text-brand-success transition-colors"
                        title="Create video job"
                      >
                        <Video className="w-4 h-4" />
                      </button>
                      {product.url && (
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-brand-card text-brand-text-dim hover:text-brand-text transition-colors"
                          title="Open product page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Total Count */}
      <p className="text-xs text-brand-text-dim">
        Showing {filtered.length} of {total} products
      </p>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedProduct(null)}>
          <div className="bg-brand-card border border-brand-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedProduct.name}</h2>
                <p className="text-sm text-brand-text-dim capitalize">{selectedProduct.marketplace} · {selectedProduct.category}</p>
              </div>
              <StatusBadge status={selectedProduct.status} size="md" />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Price</p>
                <p className="text-lg font-bold">{selectedProduct.price || '—'}</p>
              </div>
              <div className="bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Commission</p>
                <p className="text-lg font-bold">{selectedProduct.commission || '—'}</p>
              </div>
              <div className="bg-brand-surface rounded-lg p-3">
                <p className="text-xs text-brand-text-dim">Gravity</p>
                <p className="text-lg font-bold">{selectedProduct.gravity_score || '—'}</p>
              </div>
            </div>

            {selectedProduct.description && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-brand-text-dim mb-2">Description</h3>
                <p className="text-sm bg-brand-surface rounded-lg p-3">{selectedProduct.description}</p>
              </div>
            )}

            {selectedProduct.ai_analysis && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-brand-accent mb-2">AI Analysis</h3>
                <div className="text-sm bg-brand-surface rounded-lg p-3 whitespace-pre-wrap">{selectedProduct.ai_analysis}</div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-brand-border">
              <button
                onClick={() => { handleAnalyze(selectedProduct.id); }}
                disabled={analyzing === selectedProduct.id}
                className="btn-secondary flex items-center gap-2"
              >
                {analyzing === selectedProduct.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {analyzing === selectedProduct.id ? 'Analyzing...' : 'Analyze'}
              </button>
              <button onClick={() => { handleCreateJob(selectedProduct); }} className="btn-primary flex items-center gap-2">
                <Video className="w-4 h-4" /> Create Video Job
              </button>
              <button onClick={() => setSelectedProduct(null)} className="btn-secondary ml-auto">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
