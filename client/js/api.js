const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'mindvault_token';
const AUTH_EXPIRED_EVENT = 'mindvault:auth-expired';
const OFFLINE_STORE_KEY = 'mindvault_offline_store_v1';
const OFFLINE_TOKEN_PREFIX = 'offline-token:';
const OFFLINE_HOST = window.location.hostname.endsWith('github.io');
const previewLocks = new Set();
const PREVIEW_LOCK_MS = 1200;

export const storage = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set token(value) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }
};

function makeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function defaultProductivity() {
  return { todos: [], reminders: [], focus: '', pomodoro: { work: 25, break: 5 } };
}

function defaultOfflineStore() {
  return {
    users: [],
    notesByUser: {},
    filesByUser: {},
    ideasByUser: {},
    productivityByUser: {},
    activityByUser: {}
  };
}

function offlineUid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readOfflineStore() {
  const raw = localStorage.getItem(OFFLINE_STORE_KEY);
  if (!raw) return defaultOfflineStore();
  try {
    return { ...defaultOfflineStore(), ...JSON.parse(raw) };
  } catch {
    return defaultOfflineStore();
  }
}

function writeOfflineStore(store) {
  localStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(store));
}

function ensureArrayMapEntry(store, key, userId) {
  store[key][userId] ||= [];
  return store[key][userId];
}

function ensureProductivityEntry(store, userId) {
  store.productivityByUser[userId] ||= defaultProductivity();
  return store.productivityByUser[userId];
}

function toSafeUser(user) {
  return { id: user.id, name: user.name, email: user.email, theme: user.theme || 'dark' };
}

function userIdFromToken(token = storage.token) {
  if (!token || !token.startsWith(OFFLINE_TOKEN_PREFIX)) return null;
  return token.slice(OFFLINE_TOKEN_PREFIX.length) || null;
}

function requireOfflineUser(store) {
  const userId = userIdFromToken();
  if (!userId) throw makeError('Authentication required', 401);
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) throw makeError('Authentication required', 401);
  return user;
}

function pushActivity(store, userId, action, subject, type = 'workspace') {
  const activity = ensureArrayMapEntry(store, 'activityByUser', userId);
  activity.unshift({
    _id: offlineUid(),
    action,
    subject,
    type,
    createdAt: nowIso()
  });
  if (activity.length > 50) activity.length = 50;
}

function compareByUpdatedDesc(a, b) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function compareNotes(a, b) {
  if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
  return compareByUpdatedDesc(a, b);
}

function queryValue(queryString, name) {
  return new URLSearchParams(queryString || '').get(name) || '';
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(makeError('Unable to process file', 400));
    reader.readAsDataURL(file);
  });
}

async function offlineRequest(path, { method = 'GET', body } = {}) {
  const store = readOfflineStore();
  const [pathname, query = ''] = String(path).split('?');
  const stamp = nowIso();

  if (pathname === '/auth/register' && method === 'POST') {
    const email = normalizeEmail(body?.email);
    if (!email || !body?.password || !body?.name) throw makeError('Name, email, and password are required', 422);
    if (store.users.some((user) => user.email === email)) throw makeError('Email is already registered', 409);
    const user = { id: offlineUid(), name: String(body.name).trim(), email, password: String(body.password), theme: 'dark', createdAt: stamp };
    store.users.push(user);
    ensureProductivityEntry(store, user.id);
    pushActivity(store, user.id, 'Created vault', 'MindVault account', 'auth');
    writeOfflineStore(store);
    return { token: `${OFFLINE_TOKEN_PREFIX}${user.id}`, user: toSafeUser(user) };
  }

  if (pathname === '/auth/login' && method === 'POST') {
    const email = normalizeEmail(body?.email);
    const password = String(body?.password || '');
    const user = store.users.find((entry) => entry.email === email);
    if (!user || user.password !== password) throw makeError('Invalid email or password', 401);
    pushActivity(store, user.id, 'Unlocked vault', 'Signed in', 'auth');
    writeOfflineStore(store);
    return { token: `${OFFLINE_TOKEN_PREFIX}${user.id}`, user: toSafeUser(user) };
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const user = requireOfflineUser(store);
    return { user: toSafeUser(user) };
  }

  const user = requireOfflineUser(store);
  const userId = user.id;
  const notes = ensureArrayMapEntry(store, 'notesByUser', userId);
  const files = ensureArrayMapEntry(store, 'filesByUser', userId);
  const ideas = ensureArrayMapEntry(store, 'ideasByUser', userId);
  const productivity = ensureProductivityEntry(store, userId);
  const activity = ensureArrayMapEntry(store, 'activityByUser', userId);

  if (pathname === '/workspace/stats' && method === 'GET') {
    return {
      stats: {
        notes: notes.length,
        files: files.length,
        ideas: ideas.length,
        todos: productivity.todos?.length || 0,
        reminders: productivity.reminders?.length || 0
      }
    };
  }

  if (pathname === '/workspace/activity' && method === 'GET') {
    return { activity: clone(activity.slice(0, 25)) };
  }

  if (pathname === '/workspace/search' && method === 'GET') {
    const q = queryValue(query, 'q').trim().toLowerCase();
    if (!q) return { results: [] };
    const includes = (value) => String(value || '').toLowerCase().includes(q);
    return {
      results: [
        ...notes.filter((item) => includes(item.title) || includes(item.content) || (item.tags || []).some(includes) || includes(item.folder))
          .slice(0, 12)
          .map((item) => ({ type: 'note', item: clone(item) })),
        ...files.filter((item) => includes(item.originalName) || includes(item.mimeType) || (item.tags || []).some(includes) || includes(item.folder))
          .slice(0, 12)
          .map((item) => ({ type: 'file', item: clone(item) })),
        ...ideas.filter((item) => includes(item.title) || includes(item.description) || (item.tags || []).some(includes) || includes(item.category))
          .slice(0, 12)
          .map((item) => ({ type: 'idea', item: clone(item) }))
      ]
    };
  }

  if (pathname === '/notes' && method === 'GET') {
    return { notes: clone(notes.slice().sort(compareNotes)) };
  }

  if (pathname === '/notes' && method === 'POST') {
    const note = {
      _id: offlineUid(),
      user: userId,
      title: String(body?.title || 'Untitled'),
      content: String(body?.content || ''),
      folder: String(body?.folder || 'Personal'),
      tags: Array.isArray(body?.tags) ? body.tags : [],
      pinned: Boolean(body?.pinned),
      favorite: Boolean(body?.favorite),
      links: Array.isArray(body?.links) ? body.links : [],
      createdAt: stamp,
      updatedAt: stamp
    };
    notes.unshift(note);
    pushActivity(store, userId, 'Created note', note.title, 'note');
    writeOfflineStore(store);
    return { note: clone(note) };
  }

  if (pathname.startsWith('/notes/') && method === 'PUT') {
    const id = pathname.split('/')[2];
    const index = notes.findIndex((item) => item._id === id);
    if (index < 0) throw makeError('Note not found', 404);
    const next = { ...notes[index], ...body, updatedAt: stamp };
    notes[index] = next;
    pushActivity(store, userId, 'Updated note', next.title, 'note');
    writeOfflineStore(store);
    return { note: clone(next) };
  }

  if (pathname.startsWith('/notes/') && method === 'DELETE') {
    const id = pathname.split('/')[2];
    const index = notes.findIndex((item) => item._id === id);
    if (index < 0) throw makeError('Note not found', 404);
    const [deleted] = notes.splice(index, 1);
    pushActivity(store, userId, 'Deleted note', deleted.title, 'note');
    writeOfflineStore(store);
    return { ok: true };
  }

  if (pathname === '/files' && method === 'GET') {
    return { files: clone(files.slice().sort(compareByUpdatedDesc)) };
  }

  if (pathname === '/files' && method === 'POST') {
    if (!(body instanceof FormData)) throw makeError('File is required', 400);
    const file = body.get('file');
    if (!(file instanceof File)) throw makeError('File is required', 400);
    const tags = String(body.get('tags') || '').split(',').map((tag) => tag.trim().slice(0, 32)).filter(Boolean).slice(0, 20);
    const folder = String(body.get('folder') || 'Uploads').trim().slice(0, 80) || 'Uploads';
    const dataUrl = file.size <= 2_000_000 ? await fileToDataUrl(file) : '';
    const entry = {
      _id: offlineUid(),
      user: userId,
      originalName: file.name,
      filename: file.name,
      storageProvider: 'offline',
      mimeType: file.type || 'application/octet-stream',
      size: file.size || 0,
      folder,
      tags,
      dataUrl,
      url: '',
      createdAt: stamp,
      updatedAt: stamp
    };
    files.unshift(entry);
    pushActivity(store, userId, 'Uploaded file', entry.originalName, 'file');
    writeOfflineStore(store);
    return { file: clone(entry) };
  }

  if (pathname.startsWith('/files/') && method === 'DELETE') {
    const id = pathname.split('/')[2];
    const index = files.findIndex((item) => item._id === id);
    if (index < 0) throw makeError('File not found', 404);
    const [deleted] = files.splice(index, 1);
    pushActivity(store, userId, 'Deleted file', deleted.originalName, 'file');
    writeOfflineStore(store);
    return { ok: true };
  }

  if (pathname === '/ideas' && method === 'GET') {
    return { ideas: clone(ideas.slice().sort(compareByUpdatedDesc)) };
  }

  if (pathname === '/ideas' && method === 'POST') {
    const idea = {
      _id: offlineUid(),
      user: userId,
      title: String(body?.title || 'Untitled idea'),
      description: String(body?.description || ''),
      category: String(body?.category || 'General'),
      status: String(body?.status || 'Backlog'),
      priority: String(body?.priority || 'medium'),
      progress: Number(body?.progress || 0),
      tags: Array.isArray(body?.tags) ? body.tags : [],
      createdAt: stamp,
      updatedAt: stamp
    };
    ideas.unshift(idea);
    pushActivity(store, userId, 'Created idea', idea.title, 'idea');
    writeOfflineStore(store);
    return { idea: clone(idea) };
  }

  if (pathname.startsWith('/ideas/') && method === 'PUT') {
    const id = pathname.split('/')[2];
    const index = ideas.findIndex((item) => item._id === id);
    if (index < 0) throw makeError('Idea not found', 404);
    const next = { ...ideas[index], ...body, updatedAt: stamp };
    ideas[index] = next;
    pushActivity(store, userId, 'Updated idea', next.title, 'idea');
    writeOfflineStore(store);
    return { idea: clone(next) };
  }

  if (pathname.startsWith('/ideas/') && method === 'DELETE') {
    const id = pathname.split('/')[2];
    const index = ideas.findIndex((item) => item._id === id);
    if (index < 0) throw makeError('Idea not found', 404);
    const [deleted] = ideas.splice(index, 1);
    pushActivity(store, userId, 'Deleted idea', deleted.title, 'idea');
    writeOfflineStore(store);
    return { ok: true };
  }

  if (pathname === '/productivity' && method === 'GET') {
    return { productivity: clone(productivity) };
  }

  if (pathname === '/productivity' && method === 'PUT') {
    const payload = {};
    for (const key of ['todos', 'reminders', 'focus', 'pomodoro']) {
      if (body?.[key] !== undefined) payload[key] = body[key];
    }
    store.productivityByUser[userId] = { ...productivity, ...payload };
    pushActivity(store, userId, 'Updated focus system', 'Productivity', 'productivity');
    writeOfflineStore(store);
    return { productivity: clone(store.productivityByUser[userId]) };
  }

  throw makeError('Request failed', 404);
}

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

  try {
    const response = await fetch(`${API_BASE}${path}`, opts);
    const data = await parseJSON(response);

    if (!response.ok) {
      const shouldFallback = OFFLINE_HOST && response.status === 401 && !data.message;
      if (shouldFallback) return offlineRequest(path, { method, body, headers });
      if (response.status === 401) window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (error) {
    if (OFFLINE_HOST) return offlineRequest(path, { method, body, headers });
    throw error;
  }
}

function offlinePreviewSource(file) {
  if (typeof file?.dataUrl === 'string' && file.dataUrl.startsWith('data:')) return file.dataUrl;
  if (typeof file?.url === 'string' && file.url.startsWith('data:')) return file.url;
  return '';
}

function resolveOfflineFilePreview(id) {
  const store = readOfflineStore();
  const user = requireOfflineUser(store);
  const files = ensureArrayMapEntry(store, 'filesByUser', user.id);
  const file = files.find((entry) => entry._id === id);
  if (!file) throw makeError('File not found', 404);
  const source = offlinePreviewSource(file);
  if (!source) throw makeError('Preview is available for files up to 2MB in offline mode', 413);
  return source;
}

function sourceToOpenUrl(source) {
  if (typeof source !== 'string' || !source.startsWith('data:')) return { url: source, revoke: false };
  try {
    const commaIndex = source.indexOf(',');
    if (commaIndex < 0) return { url: source, revoke: false };
    const header = source.slice(5, commaIndex);
    const payload = source.slice(commaIndex + 1);
    const mime = header.split(';')[0] || 'application/octet-stream';
    const isBase64 = header.includes(';base64');
    const raw = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
    return { url: URL.createObjectURL(new Blob([bytes], { type: mime })), revoke: true };
  } catch {
    return { url: source, revoke: false };
  }
}

function openPreviewSource(source, viewer = null) {
  const { url, revoke } = sourceToOpenUrl(source);
  if (viewer && !viewer.closed) {
    viewer.location = url;
    if (revoke) setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.assign(url);
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

async function openOfflineFile(id, viewer = null) {
  openPreviewSource(resolveOfflineFilePreview(id), viewer);
}

async function openFile(id) {
  if (!id || previewLocks.has(id)) return;
  previewLocks.add(id);

  let viewer = null;
  try {
    if (OFFLINE_HOST) {
      try {
        openPreviewSource(resolveOfflineFilePreview(id));
        return;
      } catch {
        // Fallback to remote stream when no local preview source exists.
      }
    } else {
      viewer = window.open('', '_blank', 'noopener,noreferrer');
    }

    const headers = {};
    if (storage.token) headers.Authorization = `Bearer ${storage.token}`;

    const response = await fetch(`${API_BASE}/files/${id}/content`, { headers, cache: 'no-store' });
    if (!response.ok) {
      const data = await parseJSON(response);
      const shouldFallback = OFFLINE_HOST && response.status === 401 && !data.message;
      if (shouldFallback) return openOfflineFile(id, viewer);
      if (viewer && !viewer.closed) viewer.close();
      throw new Error(data.message || 'Unable to open file');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    openPreviewSource(url, viewer);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    if (viewer && !viewer.closed) viewer.close();
    if (OFFLINE_HOST) return openOfflineFile(id);
    throw error;
  } finally {
    setTimeout(() => previewLocks.delete(id), PREVIEW_LOCK_MS);
  }
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
