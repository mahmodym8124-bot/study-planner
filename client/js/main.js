import '../styles/app.css';
import gsap from 'gsap';
import { api, storage } from './api.js';
import { state, setState, formatDate, uid } from './store.js';
import { icon, toast, escapeHTML, markdown, debounce, modal } from './ui.js';

const app = document.querySelector('#app');
let heroDispose = () => {};
let graphDispose = () => {};
let ambientDispose = () => {};
let scenesPromise;
let focusTimerId;

document.body.classList.toggle('light', state.theme === 'light');

const STUDY_QUOTES = [
  'Small focused blocks compound into real mastery.',
  'Clarity beats intensity when the work needs to last.',
  'Protect the next hour and the week starts to move.',
  'One finished task is better than five half-open loops.',
  'Review, refine, repeat. That is how knowledge sticks.'
];

const PRIORITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

window.addEventListener('mindvault:auth-expired', () => {
  if (!state.user) return;
  storage.token = null;
  setState({ user: null });
  toast('Session expired. Please sign in again.', 'error');
  route('/login');
});

function loadScenes() {
  scenesPromise ||= import('./three-scenes.js');
  return scenesPromise;
}

async function mountAmbientBackground() {
  const canvas = document.querySelector('#ambient-bg');
  if (!canvas) return;
  const { createAmbientBackground } = await loadScenes();
  ambientDispose();
  ambientDispose = createAmbientBackground(canvas);
}

function route(path = location.hash.replace('#', '') || '/') {
  let nextPath = path;
  if (!state.user && nextPath.startsWith('/app')) nextPath = '/login';
  if (state.user && ['/', '/landing', '/login', '/signup'].includes(nextPath)) nextPath = '/app/dashboard';
  history.replaceState(null, '', `#${nextPath}`);
  setState({ route: nextPath });
  render();
}

window.addEventListener('hashchange', () => route(location.hash.replace('#', '') || '/'));

async function bootstrap() {
  mountAmbientBackground().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});

  if (storage.token) {
    try {
      const { user } = await api.me();
      setState({ user });
      await loadWorkspace();
    } catch {
      storage.token = null;
    }
  }

  route(location.hash.replace('#', '') || '/');
}

async function loadWorkspace() {
  const [stats, activity, notes, files, ideas, productivity] = await Promise.all([
    api.stats().catch(() => ({ stats: {} })),
    api.activity().catch(() => ({ activity: [] })),
    api.notes().catch(() => ({ notes: [] })),
    api.files().catch(() => ({ files: [] })),
    api.ideas().catch(() => ({ ideas: [] })),
    api.productivity().catch(() => ({ productivity: state.productivity }))
  ]);

  setState({
    stats: stats.stats || {},
    activity: activity.activity || [],
    notes: notes.notes || [],
    files: files.files || [],
    ideas: ideas.ideas || [],
    productivity: productivity.productivity || state.productivity
  });
}

function render() {
  clearInterval(focusTimerId);
  heroDispose();
  graphDispose();
  heroDispose = () => {};
  graphDispose = () => {};

  if (state.route === '/' || state.route === '/landing') return renderLanding();
  if (state.route === '/login' || state.route === '/signup') return renderAuth(state.route === '/signup');
  return renderApp();
}

function renderLanding() {
  app.className = 'app-shell';
  app.innerHTML = `
    <section class="landing">
      <nav class="nav surface">
        <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
        <div class="nav-links">
          <a href="#/login">Sign in</a>
          <a class="btn primary" href="#/signup">Start workspace</a>
        </div>
      </nav>

      <main class="hero">
        <div>
          <span class="eyebrow">${icon('vault')} Notes, files, ideas, and focus in one place</span>
          <h1>A cleaner workspace for <span class="gradient-text">serious study.</span></h1>
          <p>
            MindVault gives you a focused command center for capturing notes, storing files,
            shaping ideas, and tracking daily work without a cluttered interface.
          </p>
          <div class="hero-actions">
            <a class="btn primary" href="#/signup">${icon('plus')} Create account</a>
            <a class="btn" href="#/login">Open workspace</a>
          </div>
          <div class="hero-meta">
            <div class="mini-stat"><strong>Notes</strong><span class="muted">Markdown capture</span></div>
            <div class="mini-stat"><strong>Files</strong><span class="muted">Protected uploads</span></div>
            <div class="mini-stat"><strong>Graph</strong><span class="muted">3D relationships</span></div>
          </div>
        </div>

        <div id="visual" class="hero-visual">
          <div class="floating-card">
            <b>Live workspace preview</b>
            <p class="muted">A calm interface with enough depth to feel polished, without visual noise.</p>
          </div>
        </div>
      </main>

      <section class="features">
        <div class="feature"><b>Capture faster</b><span class="muted">Create notes, upload files, and search your vault from the command palette.</span></div>
        <div class="feature"><b>Plan clearly</b><span class="muted">Move ideas through a compact board and keep your focus list visible.</span></div>
        <div class="feature"><b>Deploy ready</b><span class="muted">Vite, Express, MongoDB, JWT auth, and Vercel configuration are already wired.</span></div>
      </section>
    </section>
  `;

  const visual = document.querySelector('.hero-visual');
  loadScenes().then(({ createHeroScene }) => {
    if (document.body.contains(visual)) heroDispose = createHeroScene(visual);
  }).catch(() => {});
  gsap.from('.hero > *, .feature', { y: 18, opacity: 0, stagger: 0.06, duration: 0.5, ease: 'power2.out' });
}

function renderAuth(signup) {
  app.className = 'app-shell';
  app.innerHTML = `
    <section class="auth-page">
      <form class="auth-card surface" id="auth-form">
        <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
        <h1>${signup ? 'Create your workspace' : 'Welcome back'}</h1>
        <p class="muted">${signup ? 'Start organizing your study material in a few seconds.' : 'Sign in to continue your workspace.'}</p>
        ${signup ? '<div class="field"><label>Name</label><input class="input" name="name" required minlength="2" placeholder="Your name" /></div>' : ''}
        <div class="field"><label>Email</label><input class="input" type="email" name="email" required placeholder="you@example.com" /></div>
        <div class="field"><label>Password</label><input class="input" type="password" name="password" required minlength="8" placeholder="Minimum 8 characters" /></div>
        <button class="btn primary" style="width:100%" type="submit">${signup ? 'Create account' : 'Sign in'}</button>
        <p class="switch-auth">
          ${signup ? 'Already have an account?' : 'New to MindVault?'}
          <button type="button" id="switch-auth">${signup ? 'Sign in' : 'Create one'}</button>
        </p>
      </form>
    </section>
  `;

  document.querySelector('#switch-auth').onclick = () => route(signup ? '/login' : '/signup');
  document.querySelector('#auth-form').onsubmit = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const data = signup ? await api.register(payload) : await api.login(payload);
      storage.token = data.token;
      setState({ user: data.user });
      toast('Workspace opened');
      await loadWorkspace();
      route('/app/dashboard');
    } catch (error) {
      toast(error.message, 'error');
    }
  };
}

function navItems() {
  return [
    ['dashboard', 'Dashboard'],
    ['notes', 'Notes'],
    ['files', 'Files'],
    ['graph', 'Graph'],
    ['ideas', 'Ideas'],
    ['productivity', 'Focus']
  ];
}

function currentView() {
  return state.route.split('/').pop() || 'dashboard';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function priorityWeight(todo = {}) {
  return PRIORITY_WEIGHT[String(todo.priority || 'medium').toLowerCase()] || PRIORITY_WEIGHT.medium;
}

function openTodosByPriority(todos = state.productivity.todos || []) {
  return todos
    .filter((todo) => !todo.done)
    .slice()
    .sort((a, b) => priorityWeight(b) - priorityWeight(a));
}

function getStudyQuote() {
  const day = Math.floor(Date.now() / 86_400_000);
  return STUDY_QUOTES[day % STUDY_QUOTES.length];
}

function statSparkline(values) {
  return `
    <div class="stat-sparkline" aria-hidden="true">
      ${values.map((height) => `<span style="height:${Math.round(clamp(height, 12, 100))}%"></span>`).join('')}
    </div>
  `;
}

function sparkFromPercent(percent) {
  const value = clamp(percent, 8, 100);
  return [28, value * 0.45 + 16, value * 0.62 + 18, value * 0.78 + 12, value, Math.max(18, value - 10)];
}

function folderColor(folder = 'Personal') {
  const hash = [...folder].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `hsl(${hash % 360} 82% 66%)`;
}

function daysAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function computeStreak(activity = []) {
  const days = new Set(activity.map((item) => new Date(item.createdAt).toDateString()));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 30; i += 1) {
    if (!days.has(cursor.toDateString())) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function dashboardInsights() {
  const todos = state.productivity.todos || [];
  const doneTodos = todos.filter((todo) => todo.done).length;
  const activeIdeas = state.ideas.filter((idea) => idea.status === 'Active' || idea.status === 'Review').length;
  const pinnedNotes = state.notes.filter((note) => note.pinned || note.favorite).length;
  const recentNotes = state.notes.filter((note) => daysAgo(note.updatedAt || note.createdAt) <= 7).length;
  const streak = computeStreak(state.activity);
  const completion = todos.length ? (doneTodos / todos.length) * 100 : 0;
  const focusDepth = state.productivity.focus?.trim() ? 18 : 0;
  const focusScore = clamp(Math.round((completion * 0.44) + (Math.min(streak, 7) * 6) + Math.min(activeIdeas * 5, 20) + focusDepth), 0, 100);

  return {
    todos,
    doneTodos,
    activeIdeas,
    pinnedNotes,
    recentNotes,
    streak,
    completion,
    focusScore
  };
}

function weekActivityBars() {
  const labels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const counts = labels.map((date) => state.activity.filter((item) => new Date(item.createdAt).toDateString() === date.toDateString()).length);
  const max = Math.max(...counts, 1);
  return labels.map((date, index) => ({
    label: date.toLocaleDateString(undefined, { weekday: 'short' }),
    value: counts[index],
    active: counts[index] > 0,
    height: `${Math.max(12, (counts[index] / max) * 100)}%`
  }));
}

function emptyState(iconName, title, body, action = '') {
  return `
    <div class="empty-state">
      ${icon(iconName)}
      <b>${escapeHTML(title)}</b>
      <span class="muted">${escapeHTML(body)}</span>
      ${action}
    </div>
  `;
}

function renderApp() {
  const view = currentView();
  const insights = dashboardInsights();
  app.className = 'dashboard-shell';
  app.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/app/dashboard" aria-label="MindVault Dashboard"><span class="logo">${icon('vault')}</span><span>MindVault</span></a>
      <div class="workspace-pill">
        <span class="status-dot"></span>
        <div>
          <b>${escapeHTML(state.user?.name || 'Workspace')}</b>
          <span class="muted">${insights.streak || 0} day streak</span>
        </div>
      </div>
      <nav class="side-nav">
        ${navItems().map(([id, label]) => `
          <a class="side-link ${view === id ? 'active' : ''}" href="#/app/${id}">
            ${icon(id)} ${label}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="btn" id="cmd-open">${icon('command')} Command</button>
        <button class="btn" id="theme-toggle">${icon('theme')} Theme</button>
        <button class="btn danger" id="logout">${icon('logout')} Logout</button>
      </div>
    </aside>
    <button class="sidebar-scrim" id="sidebar-scrim" aria-label="Close menu"></button>

    <main class="main">
      <header class="topbar surface">
        <button class="icon-button mobile-toggle" id="mobile-menu" aria-label="Open menu">${icon('menu')}</button>
        <div class="search-wrap">
          ${icon('search')}
          <input class="input" id="global-search" placeholder="Search notes, files, ideas, tags..." />
          <span class="shortcut">Ctrl K</span>
        </div>
        <button class="btn" id="quick-note">${icon('plus')}<span class="hide-mobile">New note</span></button>
        <div class="avatar">${escapeHTML(state.user?.name?.[0] || 'M')}</div>
      </header>
      <section id="view-root"></section>
    </main>

    <nav class="bottom-nav">
      ${[['dashboard', 'Home'], ['notes', 'Notes'], ['productivity', 'Focus'], ['ideas', 'Ideas']].map(([id, label]) => `
        <a class="bottom-nav-item ${view === id ? 'active' : ''}" href="#/app/${id}" aria-label="${label}">
          ${icon(id)}
          <span>${label}</span>
        </a>
      `).join('')}
    </nav>

    <div class="toast-stack" aria-live="polite"></div>
    <div class="command-backdrop" id="command">
      <div class="cmd surface">
        <input class="input" id="cmd-input" placeholder="Type a command or search..." />
        <div class="cmd-results" id="cmd-results"></div>
      </div>
    </div>
  `;

  bindShell();
  renderView(view);
  gsap.from('.main', { opacity: 0, y: 10, duration: 0.25, ease: 'power2.out' });
}

function bindShell() {
  document.querySelector('#logout').onclick = () => {
    storage.token = null;
    setState({ user: null });
    route('/');
  };
  document.querySelector('#theme-toggle').onclick = () => {
    const theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mindvault_theme', theme);
    setState({ theme });
    document.body.classList.toggle('light', theme === 'light');
  };
  const sidebar = document.querySelector('#sidebar');
  const scrim = document.querySelector('#sidebar-scrim');
  const closeMenu = () => {
    sidebar.classList.remove('open');
    scrim.classList.remove('open');
  };
  document.querySelector('#mobile-menu').onclick = () => {
    sidebar.classList.add('open');
    scrim.classList.add('open');
  };
  scrim.onclick = closeMenu;
  document.querySelectorAll('.side-link').forEach((link) => {
    link.onclick = closeMenu;
  });
  document.querySelector('#quick-note').onclick = () => openNoteEditor();
  document.querySelector('#cmd-open').onclick = () => openCommand();
  window.onkeydown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openCommand();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      openNoteEditor();
    }
    if (event.key === 'Escape') {
      document.querySelector('#command')?.classList.remove('open');
      document.querySelector('.modal-backdrop')?.classList.remove('open');
      closeMenu();
    }
  };
  document.querySelector('#global-search').oninput = debounce(async (event) => {
    const q = event.target.value.trim();
    if (!q) return;
    const { results } = await api.search(q);
    setState({ searchResults: results });
    openCommand(q);
  }, 220);
}

function renderView(view) {
  const root = document.querySelector('#view-root');
  if (view === 'notes') return renderNotes(root);
  if (view === 'files') return renderFiles(root);
  if (view === 'graph') return renderGraph(root);
  if (view === 'ideas') return renderIdeas(root);
  if (view === 'productivity') return renderProductivity(root);
  return renderDashboard(root);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function renderDashboard(root) {
  const firstName = state.user?.name?.split(' ')[0] || 'there';
  const insights = dashboardInsights();
  const bars = weekActivityBars();
  const topTasks = openTodosByPriority(insights.todos).slice(0, 4);
  const activeIdeas = state.ideas.filter((idea) => ['Active', 'Review'].includes(idea.status)).slice(0, 3);
  const nextTask = topTasks[0];
  const quote = getStudyQuote();
  
  root.innerHTML = `
    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">${icon('spark')} <span class="greeting-badge">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span></p>
        <h2>${getGreeting()}, ${escapeHTML(firstName)}.</h2>
        <p class="muted">A live control room for notes, files, ideas, and deep work. Your highest-leverage next actions are ready.</p>
        <p class="study-quote">${escapeHTML(quote)}</p>
        <div class="hero-actions">
          <button class="btn primary" id="dash-note">${icon('plus')} Note</button>
          <button class="btn" id="dash-upload">${icon('upload')} Upload</button>
          <button class="btn" id="dash-focus">${icon('focus')} Focus</button>
        </div>
      </div>
      <div class="focus-orb" style="--score:${insights.focusScore}">
        <span>${insights.focusScore}</span>
        <small>Focus score</small>
      </div>
    </section>

    ${nextTask ? `
      <div class="next-up-card">
        ${icon('focus')}
        <div class="next-up-text">
          <b class="gradient-text">Up next</b>
          <span>${escapeHTML(nextTask.text)}</span>
        </div>
        <button class="btn primary" id="dash-start-focus" data-focus-task="${escapeHTML(nextTask.text)}">Start focusing</button>
      </div>
    ` : ''}

    <div class="grid stats">
      ${[
        ['Notes', state.stats.notes || 0, `${insights.recentNotes} active this week`, '#3dd6c6', sparkFromPercent(state.stats.notes ? (insights.recentNotes / state.stats.notes) * 100 : 16)],
        ['Files', state.stats.files || 0, 'Protected uploads', '#47a3ff', sparkFromPercent(Math.min((state.stats.files || 0) * 18, 100))],
        ['Ideas', state.stats.ideas || 0, `${insights.activeIdeas} in motion`, '#f7b955', sparkFromPercent(state.stats.ideas ? (insights.activeIdeas / state.stats.ideas) * 100 : 12)],
        ['Tasks', insights.todos.length || 0, `${formatPercent(insights.completion)} complete`, '#5ee0a3', sparkFromPercent(insights.completion)]
      ].map(([label, value, detail, color, spark]) => `
        <div class="card stat-card" style="--glow:${color}">
          <span class="muted">${escapeHTML(label)}</span>
          <strong>${value}</strong>
          <small>${escapeHTML(detail)}</small>
          ${statSparkline(spark)}
        </div>
      `).join('')}
    </div>

    <div class="dashboard-grid">
      <section class="card insight-card wide">
        <div class="card-head">
          <div>
            <h3>Study rhythm</h3>
            <p class="muted">Workspace activity over the last seven days.</p>
          </div>
          <span class="metric-chip">${insights.streak || 0} day streak</span>
        </div>
        <div class="bar-chart">
          ${bars.map((bar) => `
            <div class="bar-wrap" data-active="${bar.active}" title="${bar.value} activity item${bar.value === 1 ? '' : 's'}">
              <span class="bar" style="height:${bar.height}"></span>
              <small>${escapeHTML(bar.label)}</small>
              <em>${bar.value}</em>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="card insight-card">
        <div class="card-head">
          <h3>Priority stack</h3>
          <span class="metric-chip">${insights.doneTodos}/${insights.todos.length || 0}</span>
        </div>
        <div class="task-stack">
          ${topTasks.map((todo) => `
            <button class="task-line" data-dashboard-todo="${todo.id}" aria-label="Mark task done">
              ${icon('check')}
              <span>${escapeHTML(todo.text)}</span>
            </button>
          `).join('') || emptyState('focus', 'No active tasks', 'Add tasks in Focus to create a daily execution lane.')}
        </div>
      </section>

      <section class="card insight-card">
        <div class="card-head">
          <h3>Ideas in motion</h3>
          <span class="metric-chip">${insights.activeIdeas}</span>
        </div>
        <div class="idea-stack">
          ${activeIdeas.map((idea) => `
            <button class="idea-row" data-open-idea="${idea._id}">
              <span>${escapeHTML(idea.status)}</span>
              <b>${escapeHTML(idea.title)}</b>
              <progress max="100" value="${idea.progress || 0}"></progress>
            </button>
          `).join('') || emptyState('ideas', 'Nothing active', 'Move a research idea into Active or Review.')}
        </div>
      </section>

      <section class="card insight-card">
        <div class="card-head">
          <h3>Recent activity</h3>
          <span class="metric-chip">${state.activity.length}</span>
        </div>
        <div class="timeline">
          ${state.activity.slice(0, 8).map((item) => `
            <div class="timeline-item">
              <span class="dot"></span>
              <div>
                <b>${escapeHTML(item.action)}</b>
                <div class="muted">${escapeHTML(item.subject)} - ${formatDate(item.createdAt)}</div>
              </div>
            </div>
          `).join('') || emptyState('activity', 'No activity yet', 'Create a note, upload a file, or save focus work.')}
        </div>
      </section>
    </div>

    <section class="dashboard-section">
      <div class="section-head compact">
        <div>
          <h2>Recent notes</h2>
          <p class="muted">Fast access to your freshest study material.</p>
        </div>
        <button class="btn" id="dash-notes">${icon('notes')} All notes</button>
      </div>
      <div class="notes-grid">${state.notes.slice(0, 4).map(noteCard).join('') || emptyState('notes', 'Your notebook is empty', 'Capture a lecture, assignment, or research thread to start.')}</div>
    </section>
  `;
  root.querySelector('#dash-note').onclick = () => openNoteEditor();
  root.querySelector('#dash-upload').onclick = () => route('/app/files');
  root.querySelector('#dash-focus').onclick = () => route('/app/productivity');
  root.querySelector('#dash-notes').onclick = () => route('/app/notes');
  root.querySelector('#dash-start-focus')?.addEventListener('click', async (event) => {
    const text = event.currentTarget.dataset.focusTask;
    if (text) await saveProd({ focus: text });
    route('/app/productivity');
  });
  root.querySelectorAll('[data-dashboard-todo]').forEach((button) => {
    button.onclick = async () => {
      await saveProd({
        todos: (state.productivity.todos || []).map((todo) => todo.id === button.dataset.dashboardTodo ? { ...todo, done: true } : todo)
      });
      await loadWorkspace();
      renderDashboard(root);
    };
  });
  root.querySelectorAll('[data-open-idea]').forEach((button) => {
    button.onclick = () => openIdeaEditor(state.ideas.find((idea) => idea._id === button.dataset.openIdea));
  });
  bindNoteCards(root);
}

function noteCard(note) {
  const folder = note.folder || 'Personal';
  return `
    <article class="card note-card">
      <div class="tags">
        ${note.pinned ? '<span class="tag">Pinned</span>' : ''}
        ${note.favorite ? '<span class="tag">Favorite</span>' : ''}
        ${(note.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
      </div>
      <h3>${escapeHTML(note.title)}</h3>
      <p class="muted">${escapeHTML((note.content || '').slice(0, 130))}</p>
      <div class="card-meta">
        <span class="folder-pill" style="--folder-color:${folderColor(folder)}"><i></i>${escapeHTML(folder)}</span>
        <span>${formatDate(note.updatedAt || note.createdAt || new Date())}</span>
      </div>
      <div class="card-actions">
        <button class="icon-button" data-edit-note="${note._id}" aria-label="Edit note">${icon('edit')}</button>
        <button class="icon-button btn danger" data-delete-note="${note._id}" aria-label="Delete note">${icon('trash')}</button>
      </div>
    </article>
  `;
}

function bindNoteCards(root) {
  root.querySelectorAll('[data-edit-note]').forEach((button) => {
    button.onclick = () => openNoteEditor(state.notes.find((note) => note._id === button.dataset.editNote));
  });
  root.querySelectorAll('[data-delete-note]').forEach((button) => {
    button.onclick = () => deleteNote(button.dataset.deleteNote);
  });
}

function renderNotes(root) {
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Notes</h2>
        <p class="muted">Write markdown, organize folders, and mark important study material.</p>
      </div>
      <button class="btn primary" id="new-note">${icon('plus')} New note</button>
    </div>
    <div class="notes-grid">${state.notes.length ? state.notes.map(noteCard).join('') : emptyState('notes', 'No notes yet', 'Create a durable place for lectures, research, and revision plans.')}</div>
  `;
  root.querySelector('#new-note').onclick = () => openNoteEditor();
  bindNoteCards(root);
}

async function openNoteEditor(note = {}) {
  modal(note._id ? 'Edit note' : 'Create note', `
    <div class="field"><label>Title</label><input class="input" name="title" value="${escapeHTML(note.title || '')}" /></div>
    <div class="form-row">
      <div class="field"><label>Folder</label><input class="input" name="folder" value="${escapeHTML(note.folder || 'Personal')}" /></div>
      <div class="field"><label>Tags</label><input class="input" name="tags" value="${escapeHTML((note.tags || []).join(', '))}" placeholder="study, exam, research" /></div>
    </div>
    <div class="editor-tools">
      <label class="btn"><input type="checkbox" name="pinned" ${note.pinned ? 'checked' : ''}/> Pin</label>
      <label class="btn"><input type="checkbox" name="favorite" ${note.favorite ? 'checked' : ''}/> Favorite</label>
    </div>
    <div class="field"><label>Markdown content</label><textarea class="textarea" name="content">${escapeHTML(note.content || '')}</textarea></div>
    <div class="card"><b>Preview</b><div id="md-preview">${markdown(note.content || '')}</div></div>
  `, async (root) => {
    const form = root.querySelector('.modal-body');
    const payload = {
      title: form.querySelector('[name=title]').value || 'Untitled note',
      folder: form.querySelector('[name=folder]').value || 'Personal',
      tags: form.querySelector('[name=tags]').value.split(',').map((tag) => tag.trim()).filter(Boolean),
      content: form.querySelector('[name=content]').value,
      pinned: form.querySelector('[name=pinned]').checked,
      favorite: form.querySelector('[name=favorite]').checked
    };
    await api.saveNote(payload, note._id);
    toast('Note saved');
    await loadWorkspace();
    route('/app/notes');
  });

  setTimeout(() => {
    const textarea = document.querySelector('[name=content]');
    const preview = document.querySelector('#md-preview');
    if (textarea && preview) textarea.oninput = debounce(() => { preview.innerHTML = markdown(textarea.value); }, 120);
  }, 0);
}

async function deleteNote(id) {
  await api.deleteNote(id);
  toast('Note deleted');
  await loadWorkspace();
  renderView('notes');
}

function renderFiles(root) {
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Files</h2>
        <p class="muted">Upload study assets and keep them attached to your workspace.</p>
      </div>
    </div>
    <div class="dropzone" id="dropzone">
      <h3>${icon('upload')} Drop files here</h3>
      <p class="muted">or click to browse</p>
      <input type="file" id="file-input" multiple hidden />
    </div>
    <div class="files-grid">${state.files.length ? state.files.map(fileCard).join('') : emptyState('files', 'No files uploaded', 'Drop PDFs, references, and study assets here for protected access.')}</div>
  `;

  const dropzone = root.querySelector('#dropzone');
  const input = root.querySelector('#file-input');
  dropzone.onclick = () => input.click();
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });
  dropzone.addEventListener('drop', (event) => uploadFiles(event.dataTransfer.files));
  input.onchange = () => uploadFiles(input.files);
  root.querySelectorAll('[data-delete-file]').forEach((button) => {
    button.onclick = () => deleteFile(button.dataset.deleteFile);
  });
  root.querySelectorAll('[data-open-file]').forEach((button) => {
    button.onclick = async () => {
      try {
        await api.openFile(button.dataset.openFile);
      } catch (error) {
        toast(error.message, 'error');
      }
    };
  });
}

function fileCard(file) {
  const label = file.mimeType?.startsWith('image/') ? 'Image' : 'File';
  return `
    <article class="card file-card">
      <div class="file-thumb">${icon('files')}</div>
      <h3>${escapeHTML(file.originalName)}</h3>
      <p class="muted">${escapeHTML(file.folder || 'Uploads')} - ${label} - ${Math.round((file.size || 0) / 1024)} KB</p>
      <div class="tags">${(file.tags || []).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</div>
      <div class="card-actions">
        <button class="btn" data-open-file="${file._id}">Preview</button>
        <button class="icon-button btn danger" data-delete-file="${file._id}" aria-label="Delete file">${icon('trash')}</button>
      </div>
    </article>
  `;
}

async function uploadFiles(files) {
  try {
    for (const file of files) {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'Uploads');
      form.append('tags', 'imported');
      await api.upload(form);
    }
  } catch (error) {
    toast(error.message, 'error');
    return;
  }
  toast('Upload complete');
  await loadWorkspace();
  renderView('files');
}

async function deleteFile(id) {
  await api.deleteFile(id);
  toast('File deleted');
  await loadWorkspace();
  renderView('files');
}

function renderGraph(root) {
  const graphData = [
    ...state.notes.map((note) => ({ ...note, type: 'note', id: note._id })),
    ...state.files.map((file) => ({ ...file, title: file.originalName, type: 'file', id: file._id })),
    ...state.ideas.map((idea) => ({ ...idea, type: 'idea', id: idea._id }))
  ];

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Knowledge graph</h2>
        <p class="muted">Explore notes, files, and ideas as connected objects.</p>
      </div>
    </div>
    <div class="graph-layout">
      <div class="graph-panel card" id="graph"><div class="skeleton"></div></div>
      <aside class="card inspector" id="inspector">
        <h3>Select a node</h3>
        <p class="muted">Click a graph object to inspect its details.</p>
      </aside>
    </div>
  `;

  const graph = root.querySelector('#graph');
  loadScenes().then(({ createKnowledgeGraph }) => {
    if (!document.body.contains(graph)) return;
    graphDispose = createKnowledgeGraph(graph, graphData, (node) => {
      root.querySelector('#inspector').innerHTML = `
        <h3>${escapeHTML(node.title || node.originalName)}</h3>
        <p class="muted">${escapeHTML(node.type)} - ${escapeHTML(node.folder || node.status || 'Workspace')}</p>
        <div class="tags">${(node.tags || []).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</div>
        <p>${markdown((node.content || node.description || '').slice(0, 500))}</p>
      `;
    });
  }).catch(() => {
    graph.innerHTML = '<p class="muted">3D graph could not be loaded.</p>';
  });
}

function renderIdeas(root) {
  const statuses = ['Backlog', 'Active', 'Review', 'Done'];
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Ideas</h2>
        <p class="muted">A compact board for projects, research threads, and next steps.</p>
      </div>
      <button class="btn primary" id="new-idea">${icon('plus')} New idea</button>
    </div>
    <div class="ideas-board">
      ${statuses.map((status) => `
        <section class="lane" data-status="${status}">
          <h3>${status}<span class="muted">${state.ideas.filter((idea) => idea.status === status).length}</span></h3>
          ${state.ideas.filter((idea) => idea.status === status).map(ideaCard).join('')}
        </section>
      `).join('')}
    </div>
  `;

  root.querySelector('#new-idea').onclick = () => openIdeaEditor();
  root.querySelectorAll('.idea-card').forEach((card) => {
    card.draggable = true;
    card.ondragstart = (event) => event.dataTransfer.setData('text/plain', card.dataset.id);
    card.onclick = () => openIdeaEditor(state.ideas.find((idea) => idea._id === card.dataset.id));
  });
  root.querySelectorAll('.lane').forEach((lane) => {
    lane.ondragover = (event) => event.preventDefault();
    lane.ondrop = async (event) => {
      const idea = state.ideas.find((item) => item._id === event.dataTransfer.getData('text/plain'));
      await api.saveIdea({ ...idea, status: lane.dataset.status }, idea._id);
      await loadWorkspace();
      renderView('ideas');
    };
  });
}

function ideaCard(idea) {
  return `
    <article class="idea-card" data-id="${idea._id}">
      <span class="priority">${escapeHTML(idea.priority)}</span>
      <h3>${escapeHTML(idea.title)}</h3>
      <p class="muted">${escapeHTML(idea.description || '')}</p>
      <progress max="100" value="${idea.progress || 0}" style="width:100%"></progress>
    </article>
  `;
}

function openIdeaEditor(idea = {}) {
  modal(idea._id ? 'Edit idea' : 'New idea', `
    <div class="field"><label>Title</label><input class="input" name="title" value="${escapeHTML(idea.title || '')}" /></div>
    <div class="field"><label>Description</label><textarea class="textarea" name="description">${escapeHTML(idea.description || '')}</textarea></div>
    <div class="form-row">
      <div class="field"><label>Status</label><select class="select" name="status">${['Backlog', 'Active', 'Review', 'Done'].map((status) => `<option ${idea.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>
      <div class="field"><label>Priority</label><select class="select" name="priority">${['Low', 'Medium', 'High', 'Critical'].map((priority) => `<option ${idea.priority === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Category</label><input class="input" name="category" value="${escapeHTML(idea.category || 'General')}" /></div>
      <div class="field"><label>Progress</label><input class="input" type="number" min="0" max="100" name="progress" value="${idea.progress || 0}" /></div>
    </div>
    <div class="field"><label>Tags</label><input class="input" name="tags" value="${escapeHTML((idea.tags || []).join(', '))}" placeholder="research, thesis, lab" /></div>
  `, async (root) => {
    const form = root.querySelector('.modal-body');
    await api.saveIdea({
      title: form.querySelector('[name=title]').value || 'Untitled idea',
      description: form.querySelector('[name=description]').value,
      status: form.querySelector('[name=status]').value,
      priority: form.querySelector('[name=priority]').value,
      category: form.querySelector('[name=category]').value || 'General',
      progress: Number(form.querySelector('[name=progress]').value),
      tags: form.querySelector('[name=tags]').value.split(',').map((tag) => tag.trim()).filter(Boolean)
    }, idea._id);
    toast('Idea saved');
    await loadWorkspace();
    route('/app/ideas');
  });
}

function renderProductivity(root) {
  const productivity = state.productivity;
  const todos = productivity.todos || [];
  const doneTodos = todos.filter((todo) => todo.done).length;
  const percentComplete = todos.length ? (doneTodos / todos.length) * 100 : 0;
  const currentTask = openTodosByPriority(todos)[0];
  const workMinutes = productivity.pomodoro?.work || 25;
  const breakMinutes = productivity.pomodoro?.break || 5;
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Focus</h2>
        <p class="muted">Run the day from one clear execution surface: timer, tasks, and the one thing that matters.</p>
      </div>
    </div>
    <div class="grid productivity">
      <section class="card focus-timer-card">
        <div class="card-head">
          <h3>Pomodoro</h3>
          <span class="metric-chip" id="timer-counter">Work session</span>
        </div>
        <div class="timer-ring-wrap">
          <svg class="timer-ring" viewBox="0 0 100 100">
            <circle class="timer-ring-bg" cx="50" cy="50" r="45"></circle>
            <circle class="timer-ring-progress" cx="50" cy="50" r="45" stroke-dasharray="283" stroke-dashoffset="0"></circle>
          </svg>
          <div class="timer-display">
            <div class="timer" id="timer">${String(workMinutes).padStart(2, '0')}:00</div>
            <span class="timer-mode-label muted" id="timer-mode">Ready</span>
          </div>
        </div>
        <div class="actions" style="justify-content: center; margin-bottom: 1rem;">
          <button class="btn primary" id="timer-start" aria-label="Start focus timer">Start</button>
          <button class="btn" id="timer-pause" aria-label="Pause focus timer">Pause</button>
          <button class="btn" id="timer-reset" aria-label="Reset focus timer">Reset</button>
        </div>
        <div class="current-task-card">
          <span class="metric-chip">Current task</span>
          <b>${currentTask ? escapeHTML(currentTask.text) : 'No active task selected'}</b>
          <small class="muted">${currentTask ? `${escapeHTML(currentTask.priority || 'medium')} priority` : 'Add a task to give the timer a clear target.'}</small>
        </div>
        <div class="timer-complete" id="timer-complete" aria-live="polite" hidden>
          <b>Session complete</b>
          <span>Take a breath, then choose the next block.</span>
        </div>
        <div class="form-row compact-row">
          <div class="field"><label>Work</label><input class="input" type="number" min="5" max="120" id="work-minutes" value="${workMinutes}" /></div>
          <div class="field"><label>Break</label><input class="input" type="number" min="1" max="60" id="break-minutes" value="${breakMinutes}" /></div>
        </div>
        <button class="btn" style="width: 100%; margin-top: 0.5rem;" id="save-pomodoro">${icon('check')} Save settings</button>
      </section>
      <section class="card task-panel">
        <div class="card-head">
          <h3>Tasks</h3>
          <span class="metric-chip">${doneTodos}/${todos.length || 0}</span>
        </div>
        <div class="task-progress-wrap">
          <span class="task-progress-label muted">Completion progress</span>
          <div class="task-progress">
            <div class="task-progress-fill" style="width: ${percentComplete}%"></div>
          </div>
          <div class="task-summary">${doneTodos} of ${todos.length || 0} tasks complete (${formatPercent(percentComplete)})</div>
        </div>
        <form id="todo-form" class="actions" style="display: grid; grid-template-columns: 1fr auto auto;">
          <input class="input" name="todo" placeholder="Add a task" required />
          <select class="select" name="priority" style="width: auto;">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <button class="btn">${icon('plus')} Add</button>
        </form>
        <div class="todo-list">
          ${todos.map((todo) => `
            <div class="todo ${todo.done ? 'done' : ''}" data-todo="${todo.id}" data-priority="${todo.priority || 'medium'}">
              <button class="todo-check" data-toggle-todo="${todo.id}" aria-label="Toggle task">${icon(todo.done ? 'check' : 'focus')}</button>
              <span>${escapeHTML(todo.text)}</span>
              <button class="icon-button" data-delete-todo="${todo.id}" aria-label="Delete task">${icon('trash')}</button>
            </div>
          `).join('') || emptyState('check', 'No tasks queued', 'Add one clear task to start a focused session.')}
        </div>
      </section>
      <section class="card focus-note-card">
        <div class="card-head">
          <h3>Daily focus</h3>
          <span class="metric-chip">${new Date().toLocaleDateString(undefined, { weekday: 'short' })}</span>
        </div>
        <textarea class="textarea" id="focus-text" placeholder="What matters most today?">${escapeHTML(productivity.focus || '')}</textarea>
        <button class="btn primary" id="save-focus">Save focus</button>
      </section>
      <section class="card focus-summary-card">
        <h3>Execution summary</h3>
        <div class="summary-list">
          <div><span class="muted">Completion</span><b>${formatPercent(percentComplete)}</b></div>
          <div><span class="muted">Open tasks</span><b>${Math.max(0, todos.length - doneTodos)}</b></div>
          <div><span class="muted">Focus note</span><b>${productivity.focus?.trim() ? 'Set' : 'Empty'}</b></div>
        </div>
      </section>
    </div>
  `;
  bindProductivity(root);
}

function bindProductivity(root) {
  let mode = 'work'; // 'work' or 'break'
  let isPaused = false;
  let totalSeconds = Number(state.productivity.pomodoro?.work || 25) * 60;
  let seconds = totalSeconds;
  let sessions = 0;
  
  const timerCircle = root.querySelector('.timer-ring-progress');
  const timerLabel = root.querySelector('#timer-mode');
  const timerCounter = root.querySelector('#timer-counter');
  const completionPanel = root.querySelector('#timer-complete');
  
  const display = () => {
    root.querySelector('#timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    
    // Update SVG stroke-dashoffset (283 is the circumference for r=45)
    const progress = seconds / totalSeconds;
    const offset = 283 - (progress * 283);
    if (timerCircle) {
      timerCircle.style.strokeDashoffset = offset;
      timerCircle.className.baseVal = `timer-ring-progress ${mode === 'break' ? 'break' : ''} ${isPaused ? 'paused' : ''}`;
    }
  };

  const nextMode = () => {
    if (mode === 'work') {
      sessions++;
      timerCounter.textContent = `${sessions} session${sessions > 1 ? 's' : ''} completed`;
      completionPanel.hidden = false;
      completionPanel.querySelector('b').textContent = 'Work session complete';
      completionPanel.querySelector('span').textContent = 'Take the scheduled break before your next block.';
      mode = 'break';
      totalSeconds = Number(state.productivity.pomodoro?.break || 5) * 60;
      timerLabel.textContent = 'Break';
      toast('Work session complete! Take a break.');
    } else {
      mode = 'work';
      totalSeconds = Number(state.productivity.pomodoro?.work || 25) * 60;
      timerLabel.textContent = 'Focusing';
      completionPanel.hidden = false;
      completionPanel.querySelector('b').textContent = 'Break complete';
      completionPanel.querySelector('span').textContent = 'Ready for the next focused block.';
      toast('Break over. Back to focus!');
    }
    seconds = totalSeconds;
    display();
  };

  root.querySelector('#timer-start').onclick = () => {
    completionPanel.hidden = true;
    if (isPaused) {
      isPaused = false;
      timerLabel.textContent = mode === 'work' ? 'Focusing' : 'Break';
      display();
    } else {
      if (timerLabel.textContent === 'Ready') {
        mode = 'work';
        totalSeconds = Number(state.productivity.pomodoro?.work || 25) * 60;
        seconds = totalSeconds;
      }
      timerLabel.textContent = mode === 'work' ? 'Focusing' : 'Break';
    }
    clearInterval(focusTimerId);
    focusTimerId = setInterval(() => {
      if (isPaused) return;
      seconds = Math.max(0, seconds - 1);
      display();
      if (seconds === 0) {
        clearInterval(focusTimerId);
        nextMode();
      }
    }, 1000);
  };
  
  root.querySelector('#timer-pause').onclick = () => {
    isPaused = true;
    timerLabel.textContent = 'Paused';
    display();
  };
  
  root.querySelector('#timer-reset').onclick = () => {
    clearInterval(focusTimerId);
    isPaused = false;
    mode = 'work';
    totalSeconds = Number(state.productivity.pomodoro?.work || 25) * 60;
    seconds = totalSeconds;
    timerLabel.textContent = 'Ready';
    timerCounter.textContent = 'Work session';
    completionPanel.hidden = true;
    display();
  };
  
  root.querySelector('#save-pomodoro').onclick = async () => {
    await saveProd({
      pomodoro: {
        work: Number(root.querySelector('#work-minutes').value || 25),
        break: Number(root.querySelector('#break-minutes').value || 5)
      }
    });
    toast('Timer settings saved');
    renderView('productivity');
  };
  
  root.querySelector('#todo-form').onsubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = formData.get('todo');
    const priority = formData.get('priority');
    if (!text) return;
    await saveProd({ todos: [...(state.productivity.todos || []), { id: uid(), text, priority, done: false }] });
    renderView('productivity');
  };
  
  root.querySelectorAll('[data-toggle-todo]').forEach((element) => {
    element.onclick = async (event) => {
      event.stopPropagation();
      await saveProd({
        todos: (state.productivity.todos || []).map((todo) => todo.id === element.dataset.toggleTodo ? { ...todo, done: !todo.done } : todo)
      });
      renderView('productivity');
    };
  });
  
  root.querySelectorAll('[data-delete-todo]').forEach((element) => {
    element.onclick = async (event) => {
      event.stopPropagation();
      await saveProd({ todos: (state.productivity.todos || []).filter((todo) => todo.id !== element.dataset.deleteTodo) });
      renderView('productivity');
    };
  });
  
  root.querySelector('#save-focus').onclick = async () => {
    await saveProd({ focus: root.querySelector('#focus-text').value });
    toast('Focus saved');
  };
  
  display();
}

async function saveProd(patch) {
  const productivity = { ...state.productivity, ...patch };
  const response = await api.saveProductivity(productivity);
  setState({ productivity: response.productivity || productivity });
}

function openCommand(seed = '') {
  const root = document.querySelector('#command');
  const input = document.querySelector('#cmd-input');
  const results = document.querySelector('#cmd-results');
  root.classList.add('open');
  input.value = seed;
  input.focus();

  const renderResults = () => {
    const query = input.value.toLowerCase();
    const items = [
      { label: 'Create note', action: () => openNoteEditor() },
      { label: 'Upload files', action: () => route('/app/files') },
      { label: 'Open graph', action: () => route('/app/graph') },
      ...state.notes.map((note) => ({ label: `Note: ${note.title}`, action: () => openNoteEditor(note) })),
      ...state.files.map((file) => ({
        label: `File: ${file.originalName}`,
        action: async () => {
          try {
            await api.openFile(file._id);
          } catch (error) {
            toast(error.message, 'error');
          }
        }
      })),
      ...state.ideas.map((idea) => ({ label: `Idea: ${idea.title}`, action: () => openIdeaEditor(idea) }))
    ].filter((item) => item.label.toLowerCase().includes(query));

    results.innerHTML = items.slice(0, 12).map((item, index) => `
      <button class="cmd-item" data-idx="${index}">
        <span>${escapeHTML(item.label)}</span>
        <span>Enter</span>
      </button>
    `).join('') || '<p class="muted">No matches</p>';
    results.querySelectorAll('[data-idx]').forEach((button) => {
      button.onclick = () => {
        root.classList.remove('open');
        items[Number(button.dataset.idx)].action();
      };
    });
  };

  input.oninput = renderResults;
  root.onclick = (event) => {
    if (event.target === root) root.classList.remove('open');
  };
  renderResults();
}

bootstrap();
