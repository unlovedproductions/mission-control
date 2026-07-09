const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
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
}

export const api = {
  health: () => request<any>('/health'),
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

  getApfCredentials: () => request<any>('/apf/credentials'),
  saveApfCredential: (platform: string, apiKey: string) =>
    request<any>('/apf/credentials', {
      method: 'PUT',
      body: JSON.stringify({ platform, api_key: apiKey }),
    }),

  shadowcastHooks: () => request<any>('/shadowcast/hooks'),
  shadowcastContentStyles: () => request<any>('/shadowcast/content-styles'),
  shadowcastProviders: () => request<any>('/shadowcast/providers'),

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
  }) => request<any>('/calendar', { method: 'POST', body: JSON.stringify(event) }),
  deleteCalendarEvent: (id: string) =>
    request<any>(`/calendar/${id}`, { method: 'DELETE' }),

  analyticsOverview: () => request<any>('/analytics/overview'),
  getActivity: (limit: number = 50) => request<any>(`/activity?limit=${limit}`),
};
