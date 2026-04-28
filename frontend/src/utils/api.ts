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

export const api = {
  // Health & Config
  health: () => request<any>('/health'),
  getConfig: () => request<Record<string, string>>('/config'),
  updateConfig: (key: string, value: string) =>
    request<any>('/config', { method: 'PUT', body: JSON.stringify({ key, value }) }),

  // Service Status
  serviceStatus: () => request<any>('/status/services'),

  // Ollama
  ollamaModels: () => request<any>('/ollama/models'),
  ollamaPull: (model: string) =>
    request<any>(`/ollama/pull?model_name=${encodeURIComponent(model)}`, { method: 'POST' }),
  ollamaRunning: () => request<any>('/ollama/running'),

  // Products
  getProducts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/products${qs}`);
  },
  importProducts: (marketplace: string, limit: number = 20) =>
    request<any>('/products/import', {
      method: 'POST',
      body: JSON.stringify({ marketplace, limit }),
    }),
  analyzeProduct: (id: string) =>
    request<any>(`/products/${id}/analyze`, { method: 'POST' }),
  updateProductStatus: (id: string, status: string) =>
    request<any>(`/products/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PUT' }),

  // Video Jobs
  getJobs: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<any>(`/jobs${qs}`);
  },
  createJob: (productId: string, jobType: string = 'both', scriptModel?: string) =>
    request<any>('/jobs', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, job_type: jobType, script_model: scriptModel }),
    }),
  getJob: (id: string) => request<any>(`/jobs/${id}`),
  deleteJob: (id: string) => request<any>(`/jobs/${id}`, { method: 'DELETE' }),

  // Calendar
  getCalendar: (month?: number, year?: number) => {
    const params: string[] = [];
    if (month) params.push(`month=${month}`);
    if (year) params.push(`year=${year}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return request<any>(`/calendar${qs}`);
  },
  createCalendarEvent: (event: any) =>
    request<any>('/calendar', { method: 'POST', body: JSON.stringify(event) }),
  deleteCalendarEvent: (id: string) =>
    request<any>(`/calendar/${id}`, { method: 'DELETE' }),

  // Analytics
  analyticsOverview: () => request<any>('/analytics/overview'),

  // Activity
  getActivity: (limit: number = 50) => request<any>(`/activity?limit=${limit}`),
};
