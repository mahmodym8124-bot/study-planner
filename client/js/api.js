const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'mindvault_token';
const AUTH_EXPIRED_EVENT = 'mindvault:auth-expired';

export const storage = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set token(value) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }
};

async function parseJSON(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const opts = {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...headers
    }
  };

  if (storage.token) opts.headers.Authorization = `Bearer ${storage.token}`;

  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, opts);
  const data = await parseJSON(response);

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

async function openFile(id) {
  const viewer = window.open('', '_blank', 'noopener,noreferrer');
  const headers = {};
  if (storage.token) headers.Authorization = `Bearer ${storage.token}`;

  const response = await fetch(`${API_BASE}/files/${id}/content`, { headers, cache: 'no-store' });
  if (!response.ok) {
    if (viewer) viewer.close();
    const data = await parseJSON(response);
    throw new Error(data.message || 'Unable to open file');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  if (viewer) viewer.location = url;
  else window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),
  stats: () => request('/workspace/stats'),
  activity: () => request('/workspace/activity'),
  search: (q) => request(`/workspace/search?q=${encodeURIComponent(q)}`),
  notes: () => request('/notes'),
  saveNote: (payload, id) => request(id ? `/notes/${id}` : '/notes', { method: id ? 'PUT' : 'POST', body: payload }),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  files: () => request('/files'),
  upload: (form) => request('/files', { method: 'POST', body: form }),
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),
  openFile,
  ideas: () => request('/ideas'),
  saveIdea: (payload, id) => request(id ? `/ideas/${id}` : '/ideas', { method: id ? 'PUT' : 'POST', body: payload }),
  deleteIdea: (id) => request(`/ideas/${id}`, { method: 'DELETE' }),
  productivity: () => request('/productivity'),
  saveProductivity: (payload) => request('/productivity', { method: 'PUT', body: payload })
};
