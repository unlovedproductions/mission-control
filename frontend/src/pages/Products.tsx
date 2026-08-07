import { useEffect, useState } from 'react'
import { api, MARKETPLACES } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import {
  Package, Search, Download, Brain, Video, RefreshCw, ExternalLink, CloudDownload, Check, X, Bookmark, Sparkles,
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
  apf_product_id?: string
  recommended_content_style?: string
  product_info_json?: string
  enriched_payload?: string
  review_brief?: string
}

const HOOK_OPTIONS = [
  { id: 'curiosity', label: 'Curiosity' },
  { id: 'problem_agitation', label: 'Problem-Agitation' },
  { id: 'listicle', label: 'Listicle' },
  { id: 'urgency', label: 'Urgency' },
  { id: 'contrarian', label: 'Contrarian' },
  { id: 'data_bomb', label: 'Data Bomb' },
  { id: 'confession', label: 'Confession' },
  { id: 'comparison_trap', label: 'Comparison Trap' },
  { id: 'myth_buster', label: 'Myth Buster' },
]

const CONTENT_STYLES = [
  'honest_review', 'elimination', 'worth_it_or_waste', 'budget_challenge', 'vs_battle', 'standard',
]

const AUDIO_MOODS = ['auto', 'chill', 'energetic', 'dramatic', 'minimal']

function parseBrief(product: Product): Record<string, any> {
  if (!product.review_brief) return {}
  try {
    return typeof product.review_brief === 'string' ? JSON.parse(product.review_brief) : product.review_brief
  } catch {
    return {}
  }
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [reenriching, setReenriching] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [filterMarketplace, setFilterMarketplace] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [importMarketplace, setImportMarketplace] = useState('clickbank')
  const [jobModalProduct, setJobModalProduct] = useState<Product | null>(null)
  const [jobType, setJobType] = useState('both')
  const [hookTypes, setHookTypes] = useState<string[]>(['curiosity'])
  const [contentStyle, setContentStyle] = useState('')
  const [scriptModel, setScriptModel] = useState('')
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [audioMood, setAudioMood] = useState('auto')
  const [useTts, setUseTts] = useState(false)
  const [ttsProvider, setTtsProvider] = useState('auto')
  const [ttsVoice, setTtsVoice] = useState('')
  const [videoPreset, setVideoPreset] = useState('medium')
  const [creatingJob, setCreatingJob] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [tab, setTab] = useState<'products' | 'bookmarks'>('products')
  const [bookmarks, setBookmarks] = useState<any[]>([])
  const [enriching, setEnriching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [daemon, setDaemon] = useState<any>(null)
  const [ttsCatalog, setTtsCatalog] = useState<any>(null)

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterMarketplace) params.marketplace = filterMarketplace
      if (filterStatus) params.status = filterStatus
      if (searchQuery.trim()) params.q = searchQuery.trim()
      const data = await api.getProducts(params)
      setProducts(data.products)
      setTotal(data.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [filterMarketplace, filterStatus, searchQuery])

  useEffect(() => {
    api.ollamaModels().then((d) => {
      if (d.status === 'ok' && d.models) {
        setModels(d.models.map((m: any) => m.name))
      }
    }).catch(() => {})
    api.getConfig().then((c) => {
      if (c.default_script_model) setScriptModel(c.default_script_model)
    }).catch(() => {})
    api.apfDaemon().then(setDaemon).catch(() => {})
    api.shadowcastTtsProviders().then(setTtsCatalog).catch(() => {})
  }, [])

  const fetchBookmarks = async () => {
    try {
      const data = await api.getBookmarks()
      setBookmarks(data.bookmarks || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (tab === 'bookmarks') fetchBookmarks()
  }, [tab])

  const handleImport = async () => {
    setImporting(true)
    try {
      const result = await api.importProducts(importMarketplace, 20)
      await fetchProducts()
      alert(`Import complete: ${result.imported} new, ${result.updated || 0} updated`)
    } catch (e: any) {
      alert(`Import failed: ${e.message}`)
    } finally {
      setImporting(false)
    }
  }

  const handleScrape = async () => {
    if (importMarketplace === 'digistore24') {
      const d = daemon || (await api.apfDaemon().catch(() => null))
      setDaemon(d)
      if (!d || d.status !== 'online') {
        alert('Digistore daemon is offline (127.0.0.1:3219). Start it before scraping Digistore.')
        return
      }
    }
    setScraping(true)
    try {
      await api.refreshProducts(importMarketplace)
      alert(`Scrape started for ${importMarketplace}. Wait a few minutes, then Import.`)
    } catch (e: any) {
      alert(`Scrape failed: ${e.message}`)
    } finally {
      setScraping(false)
    }
  }

  const handleEnrich = async () => {
    setEnriching(true)
    try {
      const apfIds = selectedIds
        .map((id) => products.find((p) => p.id === id)?.apf_product_id)
        .filter(Boolean)
        .map((id) => Number(id))
      await api.queueEnrichment(apfIds.length ? apfIds : undefined)
      alert(apfIds.length ? `Enrichment queued for ${apfIds.length} products` : 'Enrichment queued for all pending')
    } catch (e: any) {
      alert(`Enrich failed: ${e.message}`)
    } finally {
      setEnriching(false)
    }
  }

  const handleReenrich = async (id: string) => {
    setReenriching(id)
    try {
      await api.reenrichProduct(id)
      await fetchProducts()
      if (selectedProduct?.id === id) {
        const data = await api.getProducts()
        const updated = data.products.find((p: Product) => p.id === id)
        if (updated) setSelectedProduct(updated)
      }
    } catch (e: any) {
      alert(`Re-enrich failed: ${e.message}`)
    } finally {
      setReenriching(null)
    }
  }

  const handleStatus = async (id: string, status: string) => {
    try {
      await api.updateProductStatus(id, status)
      await fetchProducts()
      if (selectedProduct?.id === id) {
        setSelectedProduct({ ...selectedProduct, status })
      }
    } catch (e: any) {
      alert(`Status update failed: ${e.message}`)
    }
  }

  const handleAnalyze = async (id: string) => {
    setAnalyzing(id)
    try {
      const result = await api.analyzeProduct(id)
      await fetchProducts()
      if (selectedProduct?.id === id) {
        setSelectedProduct({ ...selectedProduct, ai_analysis: result.analysis, status: 'analyzed' })
      }
    } catch (e: any) {
      alert(`Analysis failed: ${e.message}`)
    } finally {
      setAnalyzing(null)
    }
  }

  const openJobModal = (product: Product) => {
    setJobModalProduct(product)
    setJobType('both')
    setHookTypes(['curiosity'])
    setContentStyle(product.recommended_content_style || '')
  }

  const toggleHook = (id: string) => {
    setHookTypes((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((h) => h !== id)
        return next.length ? next : prev
      }
      return [...prev, id]
    })
  }

  const handleCreateJob = async () => {
    if (!jobModalProduct) return
    setCreatingJob(true)
    try {
      await api.createJob(jobModalProduct.id, jobType, scriptModel || undefined, {
        hook_types: hookTypes,
        content_style: contentStyle || undefined,
        audio_enabled: audioEnabled,
        audio_mood: audioMood,
        use_tts: useTts,
        tts_provider: ttsProvider || 'auto',
        tts_voice: ttsVoice || null,
        video_preset: videoPreset,
      })
      alert(`Video job queued for "${jobModalProduct.name}"`)
      setJobModalProduct(null)
    } catch (e: any) {
      alert(`Failed to create job: ${e.message}`)
    } finally {
      setCreatingJob(false)
    }
  }

  const filtered = products

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Pipeline</h1>
          <p className="text-brand-text-dim text-sm mt-1">Scrape APF → import → enrich → approve → render</p>
          <p className="text-xs text-brand-text-dim mt-1">
            Enrichment queue is fire-and-forget until APF exposes products.enrichmentQueue. 9 APF marketplaces.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="input-field text-sm" value={importMarketplace} onChange={(e) => setImportMarketplace(e.target.value)}>
            {MARKETPLACES.map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
          <button onClick={handleScrape} disabled={scraping} className="btn-secondary flex items-center gap-2" title={importMarketplace === 'digistore24' && daemon?.status !== 'online' ? 'Daemon offline' : undefined}>
            {scraping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
            {scraping ? 'Scraping...' : 'Scrape APF'}
          </button>
          <button onClick={handleEnrich} disabled={enriching} className="btn-secondary flex items-center gap-2">
            {enriching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Enrich
          </button>
          <button onClick={handleImport} disabled={importing} className="btn-primary flex items-center gap-2">
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>

      {importMarketplace === 'digistore24' && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${daemon?.status === 'online' ? 'border-brand-success/30 text-brand-success' : 'border-brand-warning/40 text-brand-warning'}`}>
          Digistore daemon: {daemon?.status || 'unknown'} ({daemon?.url || '127.0.0.1:3219'})
        </div>
      )}

      <div className="flex gap-2">
        <button className={tab === 'products' ? 'btn-primary text-sm' : 'btn-secondary text-sm'} onClick={() => setTab('products')}>
          Products
        </button>
        <button className={tab === 'bookmarks' ? 'btn-primary text-sm flex items-center gap-1' : 'btn-secondary text-sm flex items-center gap-1'} onClick={() => setTab('bookmarks')}>
          <Bookmark className="w-3.5 h-3.5" /> Bookmarks
        </button>
      </div>

      {tab === 'bookmarks' ? (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border text-left">
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookmarks.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-brand-text-dim text-sm">No bookmarks from APF.</td></tr>
              ) : bookmarks.map((b: any) => {
                const pid = b.productId ?? b.product_id ?? b.id
                const status = b.status || 'interested'
                return (
                  <tr key={String(pid)} className="border-b border-brand-border/50">
                    <td className="px-4 py-3 text-sm">{b.name || b.productName || `Product ${pid}`}</td>
                    <td className="px-4 py-3"><StatusBadge status={status} /></td>
                    <td className="px-4 py-3">
                      <select
                        className="input-field text-xs"
                        value={status}
                        onChange={async (e) => {
                          try {
                            await api.updateBookmarkStatus(Number(pid), e.target.value)
                            await fetchBookmarks()
                          } catch (err: any) {
                            alert(err.message)
                          }
                        }}
                      >
                        {['interested', 'researching', 'promoting', 'archived'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        className="ml-2 text-xs text-brand-error"
                        onClick={async () => {
                          await api.removeBookmark(Number(pid))
                          await fetchBookmarks()
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dim" />
          <input type="text" placeholder="Search products..." className="input-field w-full pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select className="input-field text-sm" value={filterMarketplace} onChange={(e) => setFilterMarketplace(e.target.value)}>
          <option value="">All Marketplaces</option>
          {MARKETPLACES.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
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

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-border text-left">
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase w-8"></th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase">Product</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase">Marketplace</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase">Style</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-brand-text-dim uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-brand-border/50 animate-pulse">
                  <td colSpan={6} className="px-4 py-3"><div className="h-4 w-full bg-brand-border rounded" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-brand-text-dim">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Scrape APF, then Import to populate products.</p>
                </td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr key={product.id} className="border-b border-brand-border/50 hover:bg-brand-surface/50 cursor-pointer" onClick={() => setSelectedProduct(product)}>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, product.id] : prev.filter((id) => id !== product.id),
                        )
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium truncate max-w-[250px]">{product.name}</p>
                    <p className="text-xs text-brand-text-dim">{product.category}</p>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{product.marketplace}</td>
                  <td className="px-4 py-3 text-xs text-brand-text-dim">{product.recommended_content_style?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={product.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleAnalyze(product.id)} disabled={analyzing === product.id} className="p-1.5 rounded-lg hover:bg-brand-card text-brand-text-dim hover:text-brand-accent" title="Analyze">
                        {analyzing === product.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openJobModal(product)} className="p-1.5 rounded-lg hover:bg-brand-card text-brand-text-dim hover:text-brand-success" title="Create job">
                        <Video className="w-4 h-4" />
                      </button>
                      {product.apf_product_id && (
                        <button
                          className="p-1.5 rounded-lg hover:bg-brand-card text-brand-text-dim"
                          title="Bookmark in APF"
                          onClick={async () => {
                            try {
                              await api.addBookmark(Number(product.apf_product_id))
                              alert('Bookmarked')
                            } catch (e: any) {
                              alert(e.message)
                            }
                          }}
                        >
                          <Bookmark className="w-4 h-4" />
                        </button>
                      )}
                      {product.url && (
                        <a href={product.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-brand-card text-brand-text-dim">
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
      </>
      )}

      <p className="text-xs text-brand-text-dim">Showing {filtered.length} of {total} products</p>

      {selectedProduct && (() => {
        const brief = parseBrief(selectedProduct)
        return (
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
                  <p className="text-xs text-brand-text-dim">Gem Score</p>
                  <p className="text-lg font-bold">{selectedProduct.gravity_score || '—'}</p>
                </div>
              </div>

              {selectedProduct.recommended_content_style && (
                <div className="mb-4 bg-brand-accent/10 border border-brand-accent/20 rounded-lg p-3">
                  <p className="text-xs text-brand-accent font-semibold uppercase">Recommended Style</p>
                  <p className="text-sm mt-1">{selectedProduct.recommended_content_style.replace(/_/g, ' ')}</p>
                </div>
              )}

              {brief.review_summary && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-brand-text-dim mb-2">Review Brief</h3>
                  <p className="text-sm bg-brand-surface rounded-lg p-3">{brief.review_summary}</p>
                  {brief.best_video_angles?.length > 0 && (
                    <ul className="mt-2 text-xs text-brand-text-dim list-disc list-inside">
                      {brief.best_video_angles.slice(0, 3).map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {selectedProduct.ai_analysis && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-brand-accent mb-2">AI Analysis</h3>
                  <div className="text-sm bg-brand-surface rounded-lg p-3 whitespace-pre-wrap">{selectedProduct.ai_analysis}</div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-brand-border flex-wrap">
                <button onClick={() => handleStatus(selectedProduct.id, 'approved')} className="btn-secondary flex items-center gap-2 text-brand-success">
                  <Check className="w-4 h-4" /> Approve
                </button>
                <button onClick={() => handleStatus(selectedProduct.id, 'rejected')} className="btn-secondary flex items-center gap-2 text-brand-error">
                  <X className="w-4 h-4" /> Reject
                </button>
                <button onClick={() => handleReenrich(selectedProduct.id)} disabled={reenriching === selectedProduct.id} className="btn-secondary flex items-center gap-2">
                  {reenriching === selectedProduct.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                  Re-enrich
                </button>
                <button onClick={() => handleAnalyze(selectedProduct.id)} disabled={analyzing === selectedProduct.id} className="btn-secondary flex items-center gap-2">
                  {analyzing === selectedProduct.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  Analyze
                </button>
                <button onClick={() => { openJobModal(selectedProduct); setSelectedProduct(null) }} className="btn-primary flex items-center gap-2">
                  <Video className="w-4 h-4" /> Create Job
                </button>
                <button onClick={() => setSelectedProduct(null)} className="btn-secondary ml-auto">Close</button>
              </div>
            </div>
          </div>
        )
      })()}

      {jobModalProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setJobModalProduct(null)}>
          <div className="bg-brand-card border border-brand-border rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-bold">Create Video Job</h2>
              <p className="text-sm text-brand-text-dim mt-1">{jobModalProduct.name}</p>
            </div>
            <div>
              <label className="text-xs text-brand-text-dim uppercase">Format</label>
              <select className="input-field w-full mt-1" value={jobType} onChange={(e) => setJobType(e.target.value)}>
                <option value="both">Short + Long</option>
                <option value="short">Short only</option>
                <option value="long">Long only</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-brand-text-dim uppercase">Script model</label>
              <select className="input-field w-full mt-1" value={scriptModel} onChange={(e) => setScriptModel(e.target.value)}>
                {models.length === 0 && <option value={scriptModel}>{scriptModel || 'default'}</option>}
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-brand-text-dim uppercase">Content style</label>
              <select className="input-field w-full mt-1" value={contentStyle} onChange={(e) => setContentStyle(e.target.value)}>
                <option value="">Use product recommendation</option>
                {CONTENT_STYLES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-brand-text-dim uppercase mb-2 block">Hooks</label>
              <div className="flex flex-wrap gap-2">
                {HOOK_OPTIONS.map((h) => (
                  <button key={h.id} type="button" onClick={() => toggleHook(h.id)}
                    className={`text-xs px-2 py-1 rounded border ${hookTypes.includes(h.id) ? 'border-brand-accent text-brand-accent bg-brand-accent/10' : 'border-brand-border text-brand-text-dim'}`}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={audioEnabled} onChange={(e) => setAudioEnabled(e.target.checked)} /> Music & SFX
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useTts} onChange={(e) => setUseTts(e.target.checked)} /> Voiceover
              </label>
            </div>
            {audioEnabled && (
              <div>
                <label className="text-xs text-brand-text-dim uppercase">Music mood</label>
                <select className="input-field w-full mt-1" value={audioMood} onChange={(e) => setAudioMood(e.target.value)}>
                  {AUDIO_MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-brand-text-dim uppercase">Video preset</label>
              <select className="input-field w-full mt-1" value={videoPreset} onChange={(e) => setVideoPreset(e.target.value)}>
                <option value="fast">Fast</option>
                <option value="medium">Medium</option>
                <option value="best">Best</option>
              </select>
            </div>
            {useTts && (
              <>
                <div>
                  <label className="text-xs text-brand-text-dim uppercase">TTS provider</label>
                  <select className="input-field w-full mt-1" value={ttsProvider} onChange={(e) => setTtsProvider(e.target.value)}>
                    <option value="auto">auto</option>
                    {(ttsCatalog?.providers || ttsCatalog?.tts_providers || ['kokoro', 'piper', 'openai', 'gtts']).map((p: string) => (
                      <option key={p} value={typeof p === 'string' ? p : p}>{typeof p === 'string' ? p : String(p)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-brand-text-dim uppercase">TTS voice (optional)</label>
                  <input className="input-field w-full mt-1" value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} placeholder="provider default" />
                </div>
              </>
            )}
            <div className="flex items-center gap-3 pt-2 border-t border-brand-border">
              <button onClick={handleCreateJob} disabled={creatingJob} className="btn-primary flex items-center gap-2">
                {creatingJob ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                {creatingJob ? 'Queuing...' : 'Queue Job'}
              </button>
              <button onClick={() => setJobModalProduct(null)} className="btn-secondary ml-auto">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
