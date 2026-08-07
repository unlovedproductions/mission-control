const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mc_dashboard_token');
  return token ? { 'X-Dashboard-Token': token } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : detail
          ? JSON.stringify(detail)
          : `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

export interface JobCreateOptions {
  hook_types?: string[];
  content_style?: string;
  audio_enabled?: boolean;
  audio_mood?: string;
  use_tts?: boolean;
  tts_provider?: string;
  tts_voice?: string | null;
  video_preset?: string;
}

export const MARKETPLACES = [
  'warriorplus',
  'digistore24',
  'clickbank',
  'shareasale',
  'cj',
  'awin',
  'impact',
  'amazon',
  'rakuten',
] as const;

export const api = {
  health: () => request<any>('/health'),
  authStatus: () => request<{ required: boolean }>('/auth/status'),
  authUnlock: (token: string) =>
    request<{ ok: boolean }>('/auth/unlock', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  getConfig: () => request<Record<string, string>>('/config'),
  updateConfig: (key: string, value: string) =>
    request<any>('/config', { method: 'PUT', body: JSON.stringify({ key, value }) }),

  serviceStatus: () => request<any>('/status/services'),

  ollamaModels: () => request<any>('/ollama/models'),
  ollamaPull: (model: string) =>
    request<any>(`/ollama/pull?model_name=${encodeURIComponent(model)}`, { method: 'POST' }),
  ollamaRunning: () => request<any>('/ollama/running'),

  getProducts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/products${qs}`);
  },
  importProducts: (marketplace: string, limit: number = 20) =>
    request<any>('/products/import', {
      method: 'POST',
      body: JSON.stringify({ marketplace, limit }),
    }),
  refreshProducts: (marketplace: string) =>
    request<any>('/products/refresh', {
      method: 'POST',
      body: JSON.stringify({ marketplace }),
    }),
  searchProducts: (q: string, marketplace: string) =>
    request<any>(`/products/search?q=${encodeURIComponent(q)}&marketplace=${encodeURIComponent(marketplace)}`),
  reenrichProduct: (id: string) =>
    request<any>(`/products/${id}/reenrich`, { method: 'POST' }),
  analyzeProduct: (id: string) =>
    request<any>(`/products/${id}/analyze`, { method: 'POST' }),
  updateProductStatus: (id: string, status: string) =>
    request<any>(`/products/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' }),

  queueEnrichment: (productIds?: number[]) =>
    request<any>('/apf/enrich', {
      method: 'POST',
      body: JSON.stringify({ product_ids: productIds ?? null }),
    }),
  apfProductDetail: (apfId: number) =>
    request<any>(`/apf/products/${apfId}/detail`),
  apfDaemon: () => request<any>('/apf/daemon'),
  apfRefreshRuns: () => request<any>('/apf/refresh-runs/latest'),
  getBookmarks: () => request<any>('/apf/bookmarks'),
  addBookmark: (productId: number) =>
    request<any>('/apf/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId }),
    }),
  removeBookmark: (productId: number) =>
    request<any>(`/apf/bookmarks/${productId}`, { method: 'DELETE' }),
  updateBookmarkStatus: (productId: number, status: string) =>
    request<any>(`/apf/bookmarks/${productId}/status?status=${encodeURIComponent(status)}`, {
      method: 'PUT',
    }),

  getApfCredentials: () => request<any>('/apf/credentials'),
  saveApfCredential: (platform: string, apiKey: string) =>
    request<any>('/apf/credentials', {
      method: 'PUT',
      body: JSON.stringify({ platform, api_key: apiKey }),
    }),

  shadowcastHooks: () => request<any>('/shadowcast/hooks'),
  shadowcastContentStyles: () => request<any>('/shadowcast/content-styles'),
  shadowcastProviders: () => request<any>('/shadowcast/providers'),
  shadowcastReadiness: () => request<any>('/shadowcast/readiness'),
  shadowcastTtsProviders: () => request<any>('/shadowcast/tts-providers'),
  shadowcastRetryMissing: (scJobId: string) =>
    request<any>(`/shadowcast/jobs/${scJobId}/retry-missing`, { method: 'POST' }),
  shadowcastAudit: (scJobId: string) =>
    request<any>(`/shadowcast/jobs/${scJobId}/audit`),
  shadowcastFiles: (scJobId: string) =>
    request<any>(`/shadowcast/jobs/${scJobId}/files`),

  getJobs: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<any>(`/jobs${qs}`);
  },
  createJob: (
    productId: string,
    jobType: string = 'both',
    scriptModel?: string,
    options?: JobCreateOptions,
  ) =>
    request<any>('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        job_type: jobType,
        script_model: scriptModel,
        ...(options || {}),
      }),
    }),
  getJob: (id: string) => request<any>(`/jobs/${id}`),
  deleteJob: (id: string) => request<any>(`/jobs/${id}`, { method: 'DELETE' }),

  getCalendar: (month?: number, year?: number) => {
    const params: string[] = [];
    if (month) params.push(`month=${month}`);
    if (year) params.push(`year=${year}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return request<any>(`/calendar${qs}`);
  },
  createCalendarEvent: (event: {
    title: string;
    description?: string;
    scheduled_date: string;
    product_id?: string;
    video_job_id?: string;
    platform?: string;
    event_type?: string;
    shadowcast_job_id?: string;
    publish_target?: string;
  }) => request<any>('/calendar', { method: 'POST', body: JSON.stringify(event) }),
  updateCalendarStatus: (id: string, status: string) =>
    request<any>(`/calendar/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' }),
  deleteCalendarEvent: (id: string) =>
    request<any>(`/calendar/${id}`, { method: 'DELETE' }),

  analyticsOverview: () => request<any>('/analytics/overview'),
  getActivity: (limit: number = 50) => request<any>(`/activity?limit=${limit}`),

  oauthStatus: () => request<any>('/publish/oauth/status'),
  postableJobs: () => request<any>('/publish/postable'),
  publish: (body: {
    job_id: string;
    platform: string;
    hook_type: string;
    video_format?: string;
    product_slug?: string;
    dry_run?: boolean;
  }) => request<any>('/publish', { method: 'POST', body: JSON.stringify(body) }),
  publishBatch: (body: {
    job_id: string;
    hook_type: string;
    platforms: string[];
    video_format?: string;
    product_slug?: string;
    dry_run?: boolean;
  }) => request<any>('/publish/batch', { method: 'POST', body: JSON.stringify(body) }),
  socialQueue: () => request<any>('/publish/social/queue'),
  socialSchedule: (body: {
    job_id: string;
    platform: string;
    scheduled_time: string;
    hook_type?: string;
    video_format?: string;
    caption?: string;
    hashtags?: string[];
    product_slug?: string;
  }) => request<any>('/publish/social/schedule', { method: 'POST', body: JSON.stringify(body) }),
  socialQueueProcess: (dryRun = false) =>
    request<any>(`/publish/social/queue/process?dry_run=${dryRun}`, { method: 'POST' }),
  scAnalyticsDashboard: () => request<any>('/publish/analytics/dashboard'),
  scAnalyticsHooks: () => request<any>('/publish/analytics/hooks'),
  scAnalyticsFormats: () => request<any>('/publish/analytics/formats'),
  scAnalyticsRevenue: () => request<any>('/publish/analytics/revenue'),

  opsOverview: () => request<any>('/ops/overview'),
  opsSchedules: () => request<any>('/ops/schedules'),
  updateSchedule: (body: Record<string, unknown>) =>
    request<any>('/ops/schedules', { method: 'PUT', body: JSON.stringify(body) }),
};
