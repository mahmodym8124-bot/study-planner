import '../styles/app.css';
import gsap from 'gsap';
import i18n from './i18n.js';
import { api, storage } from './api.js';
import { state, setState, formatDate, uid } from './store.js';
import { icon, toast, escapeHTML, markdown, debounce, modal } from './ui.js';

const t = i18n.t.bind(i18n);

function setupLanguageMenu(menuId, toggleId, dropdownId) {
  const menu = document.getElementById(menuId);
  const toggle = document.getElementById(toggleId);
  const dropdown = document.getElementById(dropdownId);
  
  if (!menu || !toggle || !dropdown) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  dropdown.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lang = btn.dataset.lang;
      i18n.changeLanguage(lang);
      menu.classList.remove('open');
    });
  });

  document.addEventListener('click', () => {
    menu.classList.remove('open');
  });
}

i18n.on('languageChanged', () => {
  render();
});

const app = document.querySelector('#app');
let heroDispose = () => {};
let graphDispose = () => {};
let ambientDispose = () => {};
let scenesPromise;
let focusTimerId;


document.body.classList.toggle('light', state.theme === 'light');

const PRIORITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const IDEA_STATUS_I18N = {
  Backlog: 'ideas.statusBacklog',
  Active: 'ideas.statusActive',
  Review: 'ideas.statusReview',
  Done: 'ideas.statusDone'
};

const TODO_PRIORITY_I18N = {
  low: 'ideas.priorityLow',
  medium: 'ideas.priorityMedium',
  high: 'ideas.priorityHigh',
  critical: 'ideas.priorityCritical'
};

function tIdeaStatus(status) {
  const key = IDEA_STATUS_I18N[status];
  return key ? t(key) : String(status);
}

function tTodoPriority(p) {
  const k = String(p || 'medium').toLowerCase();
  return t(TODO_PRIORITY_I18N[k] || TODO_PRIORITY_I18N.medium);
}

window.addEventListener('mindvault:auth-expired', () => {
  if (!state.user) return;
  storage.token = null;
  setState({ user: null });
  toast(t('toast.sessionExpired'), 'error');
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
    const isOffline = storage.token.startsWith('offline-token:');
    try {
      const { user } = await api.me();
      setState({ user, isOffline });
      await loadWorkspace();
    } catch {
      storage.token = null;
      setState({ isOffline: false });
    }
  }

  route(location.hash.replace('#', '') || '/');
}

async function loadWorkspace() {
  const [stats, activity, notes, ideas, productivity] = await Promise.all([
    api.stats().catch(() => ({ stats: {} })),
    api.activity().catch(() => ({ activity: [] })),
    api.notes().catch(() => ({ notes: [] })),
    api.ideas().catch(() => ({ ideas: [] })),
    api.productivity().catch(() => ({ productivity: state.productivity }))
  ]);

  setState({
    stats: stats.stats || {},
    activity: activity.activity || [],
    notes: notes.notes || [],
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
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const langs = { 'en': 'English', 'ar': 'العربية', 'kmr': 'کوردی (بادینی)' };

  app.innerHTML = `
    <section class="landing">
      <nav class="nav surface">
        <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
        <div class="nav-links">
          <div class="lang-menu" id="lang-menu-landing">
            <button type="button" class="btn lang-toggle" id="lang-toggle-landing">${langs[currentLang]}</button>
            <div class="lang-dropdown" id="lang-dropdown-landing">
              ${['en', 'ar', 'kmr'].map(lang => `
                <button type="button" class="lang-option ${lang === currentLang ? 'active' : ''}" data-lang="${lang}">
                  ${langs[lang]}
                  ${lang === currentLang ? '<span class="checkmark">✓</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
          <a href="#/login">${t('landing.signIn')}</a>
          <a class="btn primary" href="#/signup">${t('landing.startWorkspace')}</a>
        </div>
      </nav>

      <main class="hero">
        <div>
          <span class="eyebrow">${icon('vault')} ${t('landing.eyebrow')}</span>
          <h1>${t('landing.headline')} <span class="gradient-text">${t('landing.headlineAccent')}</span></h1>
          <p>
            ${t('landing.intro')}
          </p>
          <div class="hero-actions">
            <a class="btn primary" href="#/signup">${icon('plus')} ${t('landing.createAccount')}</a>
            <a class="btn" href="#/login">${t('landing.openWorkspace')}</a>
          </div>
          <div class="hero-meta">
            <div class="mini-stat"><strong>${t('landing.miniNotes')}</strong><span class="muted">${t('landing.miniNotesSub')}</span></div>
            <div class="mini-stat"><strong>${t('landing.miniGraph')}</strong><span class="muted">${t('landing.miniGraphSub')}</span></div>
          </div>
        </div>

        <div id="visual" class="hero-visual">
          <div class="floating-card">
            <b>${t('landing.previewTitle')}</b>
            <p class="muted">${t('landing.previewBody')}</p>
          </div>
        </div>
      </main>

      <section class="features">
        <div class="feature"><b>${t('landing.feat1Title')}</b><span class="muted">${t('landing.feat1Body')}</span></div>
        <div class="feature"><b>${t('landing.feat2Title')}</b><span class="muted">${t('landing.feat2Body')}</span></div>
        <div class="feature"><b>${t('landing.feat3Title')}</b><span class="muted">${t('landing.feat3Body')}</span></div>
      </section>
    </section>
  `;
  
  setupLanguageMenu('lang-menu-landing', 'lang-toggle-landing', 'lang-dropdown-landing');

  const visual = document.querySelector('.hero-visual');
  loadScenes().then(({ createHeroScene }) => {
    if (document.body.contains(visual)) heroDispose = createHeroScene(visual);
  }).catch(() => {});
  gsap.from('.hero > *, .feature', { y: 18, opacity: 0, stagger: 0.06, duration: 0.5, ease: 'power2.out' });
}

function renderAuth(signup) {
  app.className = 'app-shell';
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const langs = { 'en': 'English', 'ar': 'العربية', 'kmr': 'کوردی (بادینی)' };
  
  app.innerHTML = `
    <section class="auth-page">
      <form class="auth-card surface" id="auth-form">
        <div class="auth-toolbar">
          <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
          <div class="lang-menu" id="lang-menu-auth">
            <button type="button" class="btn lang-toggle" id="lang-toggle-auth">${langs[currentLang]}</button>
            <div class="lang-dropdown" id="lang-dropdown-auth">
              ${['en', 'ar', 'kmr'].map(lang => `
                <button type="button" class="lang-option ${lang === currentLang ? 'active' : ''}" data-lang="${lang}">
                  ${langs[lang]}
                  ${lang === currentLang ? '<span class="checkmark">✓</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        <h1>${signup ? t('auth.createWorkspace') : t('auth.welcomeBack')}</h1>
        <p class="muted">${signup ? t('auth.signupHint') : t('auth.loginHint')}</p>
        ${signup ? `<div class="field"><label for="auth-name">${t('auth.name')}</label><input id="auth-name" class="input" name="name" autocomplete="name" required minlength="2" placeholder="${t('auth.namePlaceholder')}" /></div>` : ''}
        <div class="field"><label for="auth-email">${t('auth.email')}</label><input id="auth-email" class="input" type="email" name="email" autocomplete="${signup ? 'email' : 'username'}" required placeholder="${t('auth.emailPlaceholder')}" /></div>
        <div class="field"><label for="auth-password">${t('auth.password')}</label><input id="auth-password" class="input" type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="8" placeholder="${t('auth.passwordPlaceholder')}" /></div>
        <button class="btn primary" style="width:100%" type="submit">${signup ? t('auth.createAccount') : t('auth.signIn')}</button>
        <p class="switch-auth">
          ${signup ? t('auth.alreadyHave') : t('auth.newHere')}
          <button type="button" id="switch-auth">${signup ? t('auth.signInLink') : t('auth.createOne')}</button>
        </p>
      </form>
    </section>
  `;

  setupLanguageMenu('lang-menu-auth', 'lang-toggle-auth', 'lang-dropdown-auth');

  document.querySelector('#switch-auth').onclick = () => route(signup ? '/login' : '/signup');
  document.querySelector('#auth-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    
    const payload = Object.fromEntries(new FormData(form));
    try {
      btn.disabled = true;
      btn.textContent = signup ? t('auth.creating') : t('auth.opening');
      
      const data = signup ? await api.register(payload) : await api.login(payload);
      const isOffline = data.token.startsWith('offline-token:');
      storage.token = data.token;
      setState({ user: data.user, isOffline });
      
      if (isOffline) toast(t('toast.localOpened'), 'info');
      else toast(t('toast.workspaceOpened'));
      
      await loadWorkspace();
      route('/app/dashboard');
    } catch (error) {
      btn.disabled = false;
      btn.textContent = originalText;
      
      let message = error.message;
      if (message === 'Invalid email or password' && !signup) {
        message = t('auth.invalidCredentials');
      }
      if (error.errors && Array.isArray(error.errors) && error.errors[0]?.msg) {
        message = `${message}: ${error.errors[0].msg}`;
      }
      toast(message, 'error');
    }
  };
}

function navItems() {
  return [
    ['dashboard', t('nav.dashboard')],
    ['notes', t('nav.notes')],
    ['graph', t('nav.graph')],
    ['ideas', t('nav.ideas')],
    ['productivity', t('nav.productivity')]
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
  const quotes = t('studyQuotes', { returnObjects: true });
  if (!Array.isArray(quotes)) return '';
  const day = Math.floor(Date.now() / 86_400_000);
  return quotes[day % quotes.length];
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
  const activeIdeas = state.stats.ideasInMotion || state.ideas.filter((idea) => idea.status === 'Active' || idea.status === 'Review').length;
  const pinnedNotes = state.notes.filter((note) => note.pinned || note.favorite).length;
  const recentNotes = state.stats.recentNotes || state.notes.filter((note) => daysAgo(note.updatedAt || note.createdAt) <= 7).length;
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
    focusScore,
    focusSessionsToday: state.stats.focusSessionsToday || 0,
    focusSessionsTotal: state.stats.focusSessionsTotal || 0
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
    label: date.toLocaleDateString(i18n.resolvedLanguage || i18n.language || undefined, { weekday: 'short' }),
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
  const langLabel = i18n.language?.startsWith('ar') ? t('lang.toEnglish') : t('lang.toArabic');
  app.className = 'dashboard-shell';
  app.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/app/dashboard" aria-label="${t('a11y.dashboard')}"><span class="logo">${icon('vault')}</span><span>MindVault</span></a>
      <div class="workspace-pill">
        <span class="status-dot ${state.isOffline ? 'offline' : ''}"></span>
        <div>
          <b>${escapeHTML(state.user?.name || t('shell.workspace'))}</b>
          <span class="muted">${state.isOffline ? t('shell.localMode') : t('shell.dayStreak', { count: insights.streak || 0 })}</span>
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
        <button class="btn" id="lang-toggle" type="button">${langLabel}</button>
        <button class="btn" id="cmd-open">${icon('command')} ${t('nav.command')}</button>
        <button class="btn" id="theme-toggle">${icon('theme')} ${t('nav.theme')}</button>
        <button class="btn danger" id="logout">${icon('logout')} ${t('nav.logout')}</button>
      </div>
    </aside>
    <button class="sidebar-scrim" id="sidebar-scrim" aria-label="${t('a11y.closeMenu')}"></button>

    <main class="main">
      <header class="topbar surface">
        <button class="icon-button mobile-toggle" id="mobile-menu" aria-label="${t('a11y.openMenu')}">${icon('menu')}</button>
        <div class="search-wrap">
          ${icon('search')}
          <label class="sr-only" for="global-search">${t('a11y.searchLabel')}</label>
          <input class="input" id="global-search" type="search" autocomplete="off" placeholder="${t('shell.searchPlaceholder')}" />
          <span class="shortcut">${t('shell.shortcut')}</span>
        </div>
        <button class="btn" id="quick-note">${icon('plus')}<span class="hide-mobile">${t('nav.newNote')}</span></button>
        <div class="avatar">${escapeHTML(state.user?.name?.[0] || 'M')}</div>
      </header>
      <section id="view-root"></section>
    </main>

    <nav class="bottom-nav">
      ${[['dashboard', t('nav.home')], ['notes', t('nav.notes')], ['productivity', t('nav.productivity')], ['ideas', t('nav.ideas')]].map(([id, label]) => `
        <a class="bottom-nav-item ${view === id ? 'active' : ''}" href="#/app/${id}" aria-label="${label}">
          ${icon(id)}
          <span>${label}</span>
        </a>
      `).join('')}
    </nav>

    <div class="toast-stack" aria-live="polite"></div>
    <div class="command-backdrop" id="command">
      <div class="cmd surface">
        <label class="sr-only" for="cmd-input">${t('a11y.commandPalette')}</label>
        <input class="input" id="cmd-input" type="text" autocomplete="off" placeholder="${t('shell.cmdPlaceholder')}" />
        <div class="cmd-results" id="cmd-results"></div>
      </div>
    </div>
  `;

  bindShell();
  renderView(view);
  gsap.from('.main', { opacity: 0, y: 10, duration: 0.25, ease: 'power2.out' });
}

function bindShell() {
  document.querySelector('#lang-toggle').onclick = () => {
    i18n.changeLanguage(i18n.language?.startsWith('ar') ? 'en' : 'ar');
  };
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

  if (view === 'graph') return renderGraph(root);
  if (view === 'ideas') return renderIdeas(root);
  if (view === 'productivity') return renderProductivity(root);
  return renderDashboard(root);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return t('dash.greetingMorning');
  if (hour < 17) return t('dash.greetingAfternoon');
  return t('dash.greetingEvening');
}

function renderDashboard(root) {
  const firstName = state.user?.name?.split(' ')[0] || t('dash.there');
  const insights = dashboardInsights();
  const bars = weekActivityBars();
  const topTasks = openTodosByPriority(insights.todos).slice(0, 4);
  const activeIdeas = state.ideas.filter((idea) => ['Active', 'Review'].includes(idea.status)).slice(0, 3);
  const nextTask = topTasks[0];
  const quote = getStudyQuote();
  
  root.innerHTML = `
    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">${icon('spark')} <span class="greeting-badge">${new Date().toLocaleDateString(i18n.resolvedLanguage || i18n.language || undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span></p>
        <h2>${getGreeting()}, ${escapeHTML(firstName)}.</h2>
        <p class="muted">${t('dash.subtitle')}</p>
        <p class="study-quote">${escapeHTML(quote)}</p>
        <div class="hero-actions">
          <button class="btn primary" id="dash-note">${icon('plus')} ${t('dash.note')}</button>
          <button class="btn" id="dash-focus">${icon('focus')} ${t('dash.focus')}</button>
        </div>
      </div>
      <div class="focus-orb" style="--score:${insights.focusScore}">
        <span>${insights.focusScore}</span>
        <small>${t('dash.focusScore')}</small>
      </div>
    </section>

    ${nextTask ? `
      <div class="next-up-card">
        ${icon('focus')}
        <div class="next-up-text">
          <b class="gradient-text">${t('dash.upNext')}</b>
          <span>${escapeHTML(nextTask.text)}</span>
        </div>
        <button class="btn primary" id="dash-start-focus" data-focus-task="${escapeHTML(nextTask.text)}">${t('dash.startFocusing')}</button>
      </div>
    ` : ''}

    <div class="grid stats">
      ${[
        [t('dash.statNotes'), state.stats.notes || 0, t('dash.statRecentNotes', { n: insights.recentNotes }), 'var(--brand)', sparkFromPercent(state.stats.notes ? (insights.recentNotes / state.stats.notes) * 100 : 16)],
        [t('dash.statIdeas'), state.stats.ideas || 0, t('dash.statIdeasMotion', { n: insights.activeIdeas }), 'var(--accent)', sparkFromPercent(state.stats.ideas ? (insights.activeIdeas / state.stats.ideas) * 100 : 12)],
        [t('dash.statTasks'), insights.todos.length || 0, t('dash.statTasksDone', { pct: formatPercent(insights.completion) }), 'var(--success)', sparkFromPercent(insights.completion)],
        [t('dash.focus'), insights.focusSessionsToday || 0, t('focus.sessionsDoneMany', { count: insights.focusSessionsToday }), 'var(--info)', sparkFromPercent(Math.min((insights.focusSessionsToday / 4) * 100, 100))]
      ].map(([label, value, detail, color, spark]) => `
        <div class="card stat-card glass" style="--glow:${color}">
          <span class="muted eyebrow-small">${escapeHTML(label)}</span>
          <strong class="gradient-text-alt">${value}</strong>
          <small class="muted">${escapeHTML(detail)}</small>
          <div class="stat-spark">${statSparkline(spark)}</div>
        </div>
      `).join('')}
    </div>

    <div class="dashboard-grid">
      <section class="card insight-card wide">
        <div class="card-head">
          <div>
            <h3>${t('dash.rhythmTitle')}</h3>
            <p class="muted">${t('dash.rhythmBody')}</p>
          </div>
          <span class="metric-chip">${t('shell.dayStreak', { count: insights.streak || 0 })}</span>
        </div>
        <div class="bar-chart">
          ${bars.map((bar) => `
            <div class="bar-wrap" data-active="${bar.active}" title="${escapeHTML(bar.value === 1 ? t('dash.activityBarOne') : t('dash.activityBarMany', { count: bar.value }))}">
              <span class="bar" style="height:${bar.height}"></span>
              <small>${escapeHTML(bar.label)}</small>
              <em>${bar.value}</em>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="card insight-card">
        <div class="card-head">
          <h3>${t('dash.priorityTitle')}</h3>
          <span class="metric-chip">${insights.doneTodos}/${insights.todos.length || 0}</span>
        </div>
        <div class="task-stack">
          ${topTasks.map((todo) => `
            <button class="task-line" data-dashboard-todo="${todo.id}" aria-label="${t('a11y.markTaskDone')}">
              ${icon('check')}
              <span>${escapeHTML(todo.text)}</span>
            </button>
          `).join('') || emptyState('focus', t('dash.noActiveTasks'), t('dash.noActiveTasksBody'))}
        </div>
      </section>

      <section class="card insight-card glass">
        <div class="card-head">
          <h3>${t('dash.ideasMotionTitle')}</h3>
          <span class="metric-chip">${insights.activeIdeas}</span>
        </div>
        <div class="idea-stack">
          ${activeIdeas.map((idea) => `
            <button class="idea-row glass" data-open-idea="${idea._id}">
              <span class="status-badge">${escapeHTML(tIdeaStatus(idea.status))}</span>
              <b>${escapeHTML(idea.title)}</b>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${idea.progress || 0}%"></div>
              </div>
            </button>
          `).join('') || emptyState('ideas', t('dash.nothingActive'), t('dash.nothingActiveBody'))}
        </div>
      </section>

      <section class="card insight-card">
        <div class="card-head">
          <h3>${t('dash.activityTitle')}</h3>
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
          `).join('') || emptyState('activity', t('dash.noActivity'), t('dash.noActivityBody'))}
        </div>
      </section>
    </div>

    <section class="dashboard-section">
      <div class="section-head compact">
        <div>
          <h2>${t('dash.recentNotesTitle')}</h2>
          <p class="muted">${t('dash.recentNotesBody')}</p>
        </div>
        <button class="btn" id="dash-notes">${icon('notes')} ${t('dash.allNotes')}</button>
      </div>
      <div class="notes-grid">${state.notes.slice(0, 4).map(noteCard).join('') || emptyState('notes', t('dash.notebookEmpty'), t('dash.notebookEmptyBody'))}</div>
    </section>
  `;
  root.querySelector('#dash-note').onclick = () => openNoteEditor();
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
        ${note.pinned ? `<span class="tag">${t('dash.tagPinned')}</span>` : ''}
        ${note.favorite ? `<span class="tag">${t('dash.tagFavorite')}</span>` : ''}
        ${(note.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
      </div>
      <h3>${escapeHTML(note.title)}</h3>
      <p class="muted">${escapeHTML((note.content || '').slice(0, 130))}</p>
      <div class="card-meta">
        <span class="folder-pill" style="--folder-color:${folderColor(folder)}"><i></i>${escapeHTML(folder)}</span>
        <span>${formatDate(note.updatedAt || note.createdAt || new Date())}</span>
      </div>
      <div class="card-actions">
        <button class="icon-button" data-edit-note="${note._id}" aria-label="${t('a11y.editNote')}">${icon('edit')}</button>
        <button class="icon-button btn danger" data-delete-note="${note._id}" aria-label="${t('a11y.deleteNote')}">${icon('trash')}</button>
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
        <h2>${t('notes.title')}</h2>
        <p class="muted">${t('notes.subtitle')}</p>
      </div>
      <button class="btn primary" id="new-note">${icon('plus')} ${t('notes.newNote')}</button>
    </div>
    <div class="notes-grid">${state.notes.length ? state.notes.map(noteCard).join('') : emptyState('notes', t('notes.emptyTitle'), t('notes.emptyBody'))}</div>
  `;
  root.querySelector('#new-note').onclick = () => openNoteEditor();
  bindNoteCards(root);
}

async function openNoteEditor(note = {}) {
  modal(note._id ? t('notes.editTitle') : t('notes.createTitle'), `
    <div class="field"><label for="modal-note-title">${t('notes.fieldTitle')}</label><input class="input" id="modal-note-title" name="title" value="${escapeHTML(note.title || '')}" /></div>
    <div class="form-row">
      <div class="field"><label for="modal-note-folder">${t('notes.fieldFolder')}</label><input class="input" id="modal-note-folder" name="folder" value="${escapeHTML(note.folder || 'Personal')}" /></div>
      <div class="field"><label for="modal-note-tags">${t('notes.fieldTags')}</label><input class="input" id="modal-note-tags" name="tags" value="${escapeHTML((note.tags || []).join(', '))}" placeholder="${t('notes.tagsPlaceholder')}" /></div>
    </div>
    <div class="editor-tools">
      <label class="btn" for="modal-note-pinned"><input type="checkbox" id="modal-note-pinned" name="pinned" ${note.pinned ? 'checked' : ''}/> ${t('notes.pin')}</label>
      <label class="btn" for="modal-note-favorite"><input type="checkbox" id="modal-note-favorite" name="favorite" ${note.favorite ? 'checked' : ''}/> ${t('notes.favorite')}</label>
    </div>
    <div class="field"><label for="modal-note-content">${t('notes.markdown')}</label><textarea class="textarea" id="modal-note-content" name="content">${escapeHTML(note.content || '')}</textarea></div>
    <div class="card"><b>${t('notes.preview')}</b><div id="md-preview">${markdown(note.content || '')}</div></div>
  `, async (root) => {
    const form = root.querySelector('.modal-body');
    const payload = {
      title: form.querySelector('[name=title]').value || t('notes.untitled'),
      folder: form.querySelector('[name=folder]').value || 'Personal',
      tags: form.querySelector('[name=tags]').value.split(',').map((tag) => tag.trim()).filter(Boolean),
      content: form.querySelector('[name=content]').value,
      pinned: form.querySelector('[name=pinned]').checked,
      favorite: form.querySelector('[name=favorite]').checked
    };
    await api.saveNote(payload, note._id);
    toast(t('toast.noteSaved'));
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
  toast(t('toast.noteDeleted'));
  await loadWorkspace();
  renderView('notes');
}



function renderGraph(root) {
  const graphData = [
    ...state.notes.map((note) => ({ ...note, type: 'note', id: note._id })),
    ...state.ideas.map((idea) => ({ ...idea, type: 'idea', id: idea._id }))
  ];

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>${t('graph.title')}</h2>
        <p class="muted">${t('graph.subtitle')}</p>
      </div>
    </div>
    <div class="graph-layout">
      <div class="graph-panel card" id="graph"><div class="skeleton"></div></div>
      <aside class="card inspector" id="inspector">
        <h3>${t('graph.selectNode')}</h3>
        <p class="muted">${t('graph.selectHint')}</p>
      </aside>
    </div>
  `;

  const graph = root.querySelector('#graph');
  loadScenes().then(({ createKnowledgeGraph }) => {
    if (!document.body.contains(graph)) return;
    graphDispose = createKnowledgeGraph(graph, graphData, (node) => {
      const typeLabel = node.type === 'idea' ? t('graph.typeIdea') : t('graph.typeNote');
      const meta = escapeHTML(node.folder || node.status || t('graph.workspace'));
      root.querySelector('#inspector').innerHTML = `
        <h3>${escapeHTML(node.title)}</h3>
        <p class="muted">${escapeHTML(typeLabel)} - ${meta}</p>
        <div class="tags">${(node.tags || []).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</div>
        <p>${markdown((node.content || node.description || '').slice(0, 500))}</p>
      `;
    });
  }).catch(() => {
    graph.innerHTML = `<p class="muted">${t('graph.loadError')}</p>`;
  });
}

function renderIdeas(root) {
  const statuses = ['Backlog', 'Active', 'Review', 'Done'];
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>${t('ideas.title')}</h2>
        <p class="muted">${t('ideas.subtitle')}</p>
      </div>
      <button class="btn primary" id="new-idea">${icon('plus')} ${t('ideas.newIdea')}</button>
    </div>
    <div class="ideas-board">
      ${statuses.map((status) => `
        <section class="lane" data-status="${status}">
          <h3>${escapeHTML(tIdeaStatus(status))}<span class="muted">${state.ideas.filter((idea) => idea.status === status).length}</span></h3>
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
      <span class="priority">${escapeHTML(tTodoPriority(idea.priority))}</span>
      <h3>${escapeHTML(idea.title)}</h3>
      <p class="muted">${escapeHTML(idea.description || '')}</p>
      <progress max="100" value="${idea.progress || 0}" style="width:100%" aria-label="${t('a11y.ideaProgress')}"></progress>
    </article>
  `;
}

function openIdeaEditor(idea = {}) {
  const statusOpts = ['Backlog', 'Active', 'Review', 'Done'];
  const priorityOpts = ['Low', 'Medium', 'High', 'Critical'];
  modal(idea._id ? t('ideas.editTitle') : t('ideas.newTitle'), `
    <div class="field"><label for="modal-idea-title">${t('ideas.fieldTitle')}</label><input class="input" id="modal-idea-title" name="title" value="${escapeHTML(idea.title || '')}" /></div>
    <div class="field"><label for="modal-idea-description">${t('ideas.fieldDescription')}</label><textarea class="textarea" id="modal-idea-description" name="description">${escapeHTML(idea.description || '')}</textarea></div>
    <div class="form-row">
      <div class="field"><label for="modal-idea-status">${t('ideas.status')}</label><select class="select" id="modal-idea-status" name="status">${statusOpts.map((status) => `<option value="${status}" ${idea.status === status ? 'selected' : ''}>${escapeHTML(tIdeaStatus(status))}</option>`).join('')}</select></div>
      <div class="field"><label for="modal-idea-priority">${t('ideas.priority')}</label><select class="select" id="modal-idea-priority" name="priority">${priorityOpts.map((priority) => `<option value="${priority}" ${idea.priority === priority ? 'selected' : ''}>${escapeHTML(tTodoPriority(priority.toLowerCase()))}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="modal-idea-category">${t('ideas.category')}</label><input class="input" id="modal-idea-category" name="category" value="${escapeHTML(idea.category || 'General')}" /></div>
      <div class="field"><label for="modal-idea-progress">${t('ideas.progress')}</label><input class="input" id="modal-idea-progress" type="number" min="0" max="100" name="progress" value="${idea.progress || 0}" /></div>
    </div>
    <div class="field"><label for="modal-idea-tags">${t('ideas.tags')}</label><input class="input" id="modal-idea-tags" name="tags" value="${escapeHTML((idea.tags || []).join(', '))}" placeholder="${t('ideas.tagsPlaceholder')}" /></div>
  `, async (root) => {
    const form = root.querySelector('.modal-body');
    await api.saveIdea({
      title: form.querySelector('[name=title]').value || t('ideas.untitled'),
      description: form.querySelector('[name=description]').value,
      status: form.querySelector('[name=status]').value,
      priority: form.querySelector('[name=priority]').value,
      category: form.querySelector('[name=category]').value || 'General',
      progress: Number(form.querySelector('[name=progress]').value),
      tags: form.querySelector('[name=tags]').value.split(',').map((tag) => tag.trim()).filter(Boolean)
    }, idea._id);
    toast(t('toast.ideaSaved'));
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
        <h2>${t('focus.title')}</h2>
        <p class="muted">${t('focus.subtitle')}</p>
      </div>
    </div>
    <div class="grid productivity">
      <section class="card focus-timer-card">
        <div class="card-head">
          <h3>${t('focus.pomodoro')}</h3>
          <span class="metric-chip" id="timer-counter">${t('focus.workSession')}</span>
        </div>
        <div class="timer-ring-wrap">
          <svg class="timer-ring" viewBox="0 0 100 100">
            <circle class="timer-ring-bg" cx="50" cy="50" r="45"></circle>
            <circle class="timer-ring-progress" cx="50" cy="50" r="45" stroke-dasharray="283" stroke-dashoffset="0"></circle>
          </svg>
          <div class="timer-display">
            <div class="timer" id="timer">${String(workMinutes).padStart(2, '0')}:00</div>
            <span class="timer-mode-label muted" id="timer-mode">${t('focus.ready')}</span>
          </div>
        </div>
        <div class="actions" style="justify-content: center; margin-bottom: 1rem;">
          <button class="btn primary" id="timer-start" aria-label="${t('a11y.startFocusTimer')}">${t('focus.start')}</button>
          <button class="btn" id="timer-pause" aria-label="${t('a11y.pauseFocusTimer')}">${t('focus.pause')}</button>
          <button class="btn" id="timer-reset" aria-label="${t('a11y.resetFocusTimer')}">${t('focus.reset')}</button>
        </div>
        <div class="current-task-card">
          <span class="metric-chip">${t('focus.currentTask')}</span>
          <b>${currentTask ? escapeHTML(currentTask.text) : t('focus.noTask')}</b>
          <small class="muted">${currentTask ? escapeHTML(t('focus.priorityLine', { priority: tTodoPriority(currentTask.priority) })) : t('focus.addTaskHint')}</small>
        </div>
        <div class="timer-complete" id="timer-complete" aria-live="polite" hidden>
          <b>${t('focus.sessionComplete')}</b>
          <span>${t('focus.sessionCompleteBody')}</span>
        </div>
        <div class="form-row compact-row">
          <div class="field"><label for="work-minutes">${t('focus.workLabel')}</label><input class="input" type="number" min="5" max="120" id="work-minutes" value="${workMinutes}" /></div>
          <div class="field"><label for="break-minutes">${t('focus.breakLabel')}</label><input class="input" type="number" min="1" max="60" id="break-minutes" value="${breakMinutes}" /></div>
        </div>
        <button class="btn" style="width: 100%; margin-top: 0.5rem;" id="save-pomodoro">${icon('check')} ${t('focus.saveSettings')}</button>
      </section>
      <section class="card task-panel">
        <div class="card-head">
          <h3>${t('focus.tasks')}</h3>
          <span class="metric-chip">${doneTodos}/${todos.length || 0}</span>
        </div>
        <div class="task-progress-wrap">
          <span class="task-progress-label muted">${t('focus.completionProgress')}</span>
          <div class="task-progress">
            <div class="task-progress-fill" style="width: ${percentComplete}%"></div>
          </div>
          <div class="task-summary">${t('focus.taskSummary', { done: doneTodos, total: todos.length || 0, pct: formatPercent(percentComplete) })}</div>
        </div>
        <form id="todo-form" class="actions" style="display: grid; grid-template-columns: 1fr auto auto;">
          <div>
            <label class="sr-only" for="todo-text">${t('a11y.newTask')}</label>
            <input class="input" id="todo-text" name="todo" placeholder="${t('focus.addTaskPlaceholder')}" required style="width:100%" />
          </div>
          <div>
            <label class="sr-only" for="todo-priority">${t('a11y.taskPriority')}</label>
            <select class="select" id="todo-priority" name="priority" style="width: auto;">
            <option value="low">${t('ideas.priorityLow')}</option>
            <option value="medium" selected>${t('ideas.priorityMedium')}</option>
            <option value="high">${t('ideas.priorityHigh')}</option>
            <option value="critical">${t('ideas.priorityCritical')}</option>
          </select>
          </div>
          <button class="btn">${icon('plus')} ${t('focus.add')}</button>
        </form>
        <div class="todo-list">
          ${todos.map((todo) => `
            <div class="todo ${todo.done ? 'done' : ''}" data-todo="${todo.id}" data-priority="${todo.priority || 'medium'}">
              <button class="todo-check" data-toggle-todo="${todo.id}" aria-label="${t('a11y.toggleTask')}">${icon(todo.done ? 'check' : 'focus')}</button>
              <span>${escapeHTML(todo.text)}</span>
              <button class="icon-button" data-delete-todo="${todo.id}" aria-label="${t('a11y.deleteTask')}">${icon('trash')}</button>
            </div>
          `).join('') || emptyState('check', t('focus.noTasksTitle'), t('focus.noTasksBody'))}
        </div>
      </section>
      <section class="card focus-note-card">
        <div class="card-head">
          <h3>${t('focus.dailyFocusTitle')}</h3>
          <span class="metric-chip">${new Date().toLocaleDateString(i18n.resolvedLanguage || i18n.language || undefined, { weekday: 'short' })}</span>
        </div>
        <label class="sr-only" for="focus-text">${t('a11y.dailyFocus')}</label>
        <textarea class="textarea" id="focus-text" name="focus" placeholder="${t('focus.focusPlaceholder')}">${escapeHTML(productivity.focus || '')}</textarea>
        <button class="btn primary" id="save-focus">${t('focus.saveFocus')}</button>
      </section>
      <section class="card focus-summary-card">
        <h3>${t('focus.executionSummary')}</h3>
        <div class="summary-list">
          <div><span class="muted">${t('focus.completion')}</span><b>${formatPercent(percentComplete)}</b></div>
          <div><span class="muted">${t('focus.openTasks')}</span><b>${Math.max(0, todos.length - doneTodos)}</b></div>
          <div><span class="muted">${t('focus.focusNote')}</span><b>${productivity.focus?.trim() ? t('focus.set') : t('focus.empty')}</b></div>
        </div>
      </section>
    </div>
  `;
  bindProductivity(root);
}

function bindProductivity(root) {
  let mode = 'work';
  let isPaused = false;
  let totalSeconds = Number(state.productivity.pomodoro?.work || 25) * 60;
  let seconds = totalSeconds;
  let sessions = 0;
  let faceIsReady = true;

  const timerCircle = root.querySelector('.timer-ring-progress');
  const timerLabel = root.querySelector('#timer-mode');
  const timerCounter = root.querySelector('#timer-counter');
  const completionPanel = root.querySelector('#timer-complete');

  const display = () => {
    root.querySelector('#timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    const progress = seconds / totalSeconds;
    const offset = 283 - (progress * 283);
    if (timerCircle) {
      timerCircle.style.strokeDashoffset = offset;
      timerCircle.className.baseVal = `timer-ring-progress ${mode === 'break' ? 'break' : ''} ${isPaused ? 'paused' : ''}`;
    }
  };

  const nextMode = () => {
    if (mode === 'work') {
      sessions += 1;
      timerCounter.textContent = sessions === 1 ? t('focus.sessionsDoneOne') : t('focus.sessionsDoneMany', { count: sessions });
      completionPanel.hidden = false;
      completionPanel.querySelector('b').textContent = t('focus.workCompleteTitle');
      completionPanel.querySelector('span').textContent = t('focus.workCompleteBody');
      mode = 'break';
      totalSeconds = Number(state.productivity.pomodoro?.break || 5) * 60;
      timerLabel.textContent = t('focus.break');
      toast(t('toast.workComplete'));
    } else {
      mode = 'work';
      totalSeconds = Number(state.productivity.pomodoro?.work || 25) * 60;
      timerLabel.textContent = t('focus.focusing');
      completionPanel.hidden = false;
      completionPanel.querySelector('b').textContent = t('focus.breakCompleteTitle');
      completionPanel.querySelector('span').textContent = t('focus.breakCompleteBody');
      toast(t('toast.breakOver'));
    }
    seconds = totalSeconds;
    display();
  };

  root.querySelector('#timer-start').onclick = () => {
    completionPanel.hidden = true;
    if (isPaused) {
      isPaused = false;
      timerLabel.textContent = mode === 'work' ? t('focus.focusing') : t('focus.break');
      display();
    } else {
      if (faceIsReady) {
        mode = 'work';
        totalSeconds = Number(state.productivity.pomodoro?.work || 25) * 60;
        seconds = totalSeconds;
        faceIsReady = false;
      }
      timerLabel.textContent = mode === 'work' ? t('focus.focusing') : t('focus.break');
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
    timerLabel.textContent = t('focus.paused');
    display();
  };

  root.querySelector('#timer-reset').onclick = () => {
    clearInterval(focusTimerId);
    isPaused = false;
    mode = 'work';
    totalSeconds = Number(state.productivity.pomodoro?.work || 25) * 60;
    seconds = totalSeconds;
    faceIsReady = true;
    timerLabel.textContent = t('focus.ready');
    timerCounter.textContent = t('focus.workSession');
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
    toast(t('toast.timerSettingsSaved'));
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
    toast(t('toast.focusSaved'));
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
      { label: t('command.createNote'), action: () => openNoteEditor() },
      { label: t('command.openGraph'), action: () => route('/app/graph') },
      ...state.notes.map((note) => ({ label: `${t('command.notePrefix')} ${note.title}`, action: () => openNoteEditor(note) })),
      ...state.ideas.map((idea) => ({ label: `${t('command.ideaPrefix')} ${idea.title}`, action: () => openIdeaEditor(idea) }))
    ].filter((item) => item.label.toLowerCase().includes(query));

    results.innerHTML = items.slice(0, 12).map((item, index) => `
      <button class="cmd-item" data-idx="${index}">
        <span>${escapeHTML(item.label)}</span>
        <span>${t('command.enter')}</span>
      </button>
    `).join('') || `<p class="muted">${t('command.noMatches')}</p>`;
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
