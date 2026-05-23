export const ROUTES = ['/', '/workspace', '/notes', '/ideas', '/focus', '/graph', '/search', '/login'];
export const APP_ROUTES = new Set(['/workspace', '/notes', '/ideas', '/focus', '/graph', '/search']);
export const CONSOLE_ROUTES = ['/', '/workspace', '/notes', '/ideas', '/focus', '/graph', '/search'];

const E2E_TOKEN = 'playwright-e2e-token';
const E2E_USER = {
  id: 'e2e-user',
  _id: 'e2e-user',
  name: 'E2E User',
  email: 'e2e@example.test',
  theme: 'dark'
};
const now = new Date('2026-01-01T12:00:00.000Z').toISOString();
const notes = [
  {
    _id: 'note-1',
    title: 'E2E seeded note',
    content: 'Seeded note content for non-destructive browser tests.',
    folder: 'Testing',
    tags: ['e2e'],
    pinned: false,
    favorite: true,
    createdAt: now,
    updatedAt: now
  }
];
const ideas = [
  {
    _id: 'idea-1',
    title: 'E2E seeded idea',
    description: 'Seeded idea content for non-destructive browser tests.',
    category: 'Testing',
    status: 'backlog',
    priority: 'medium',
    progress: 10,
    tags: ['e2e'],
    createdAt: now,
    updatedAt: now
  }
];
const productivity = {
  todos: [{ id: 'todo-1', text: 'Review Playwright coverage', priority: 'high', done: false }],
  reminders: [],
  focus: 'Keep E2E tests non-destructive.',
  pomodoro: { work: 25, break: 5 }
};

function json(route, data, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data)
  });
}

async function mockExternalAssets(page) {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: ''
  }));
  await page.route('https://fonts.gstatic.com/**', (route) => route.fulfill({
    status: 204,
    body: ''
  }));
  await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `
      window.google = {
        accounts: {
          id: {
            initialize() {},
            renderButton(element) {
              element.innerHTML = '<button type="button" data-testid="google-oauth" class="google-btn">Continue with Google</button>';
            }
          }
        }
      };
    `
  }));
}

async function mockApi(page) {
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const method = request.method();

    if (path === '/auth/me') return json(route, { user: E2E_USER });
    if (path === '/workspace/stats') {
      return json(route, {
        stats: {
          notes: notes.length,
          ideas: ideas.length,
          todos: productivity.todos.length,
          ideasInMotion: 0,
          recentNotes: notes.length,
          focusSessionsToday: 0,
          focusSessionsTotal: 0
        }
      });
    }
    if (path === '/workspace/activity') return json(route, { activity: [] });
    if (path === '/notes' && method === 'GET') return json(route, { notes });
    if (path === '/notes' && method === 'POST') return json(route, { note: notes[0] });
    if (path.startsWith('/notes/')) return json(route, { note: notes[0], ok: true });
    if (path === '/ideas' && method === 'GET') return json(route, { ideas });
    if (path === '/ideas' && method === 'POST') return json(route, { idea: ideas[0] });
    if (path.startsWith('/ideas/')) return json(route, { idea: ideas[0], ok: true });
    if (path === '/productivity') return json(route, { productivity });
    if (path === '/search') return json(route, { results: [] });
    if (path === '/graph/nodes') {
      return json(route, {
        nodes: [
          { id: 'note-1', type: 'note', label: notes[0].title, data: notes[0] },
          { id: 'idea-1', type: 'idea', label: ideas[0].title, data: ideas[0] }
        ],
        edges: [{ source: 'note-1', target: 'idea-1', weight: 1 }]
      });
    }
    if (path.startsWith('/graph/nodes/')) return json(route, { node: notes[0] });
    if (path.startsWith('/focus/')) return json(route, { ok: true, sessions: [], dailyFocus: null });

    return json(route, { ok: true });
  });
}

export async function preparePage(page, { authenticated = false } = {}) {
  await mockExternalAssets(page);
  await mockApi(page);
  if (authenticated) {
    await page.addInitScript((token) => {
      window.localStorage.setItem('mindvault_token', token);
    }, E2E_TOKEN);
  }
}

export async function gotoAppRoute(page, route) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  return response;
}

export function isMissingRoute(response) {
  return response && response.status() === 404;
}
