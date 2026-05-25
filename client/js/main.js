import '../styles/app.css';
import '../styles/error-boundary.css';
import '../styles/graph.css';
import gsap from 'gsap';
import {
  initGlobalInteractions,
  animatePageTransition,
  staggerEntrance,
  openSidebarAnimation,
  closeSidebarAnimation
} from './animation.js';
import i18n from './i18n.js';
import { api, clearAllAppData, getDailyScore, incrementDailyScore, storage } from './api.js';
import { state, setState, formatDate, uid } from './store.js';
import { icon, toast, escapeHTML, markdown, debounce, modal } from './ui.js';
import { setupLanguageMenu } from './language-menu.js';
import { globalErrorBoundary, setupErrorMonitoring } from './error-utils.js';
import { createGraphExperience } from './graph.js';

const t = i18n.t.bind(i18n);
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
let googleIdentityPromise;

// Expose error boundary globally for API error handling
window.__errorBoundary = globalErrorBoundary;

// Initialize error monitoring and boundaries
setupErrorMonitoring({
  enabled: true,
  onError: (errorObj) => {
    if (import.meta.env.MODE === 'development') {
      console.warn('Error boundary captured:', errorObj);
    }
  }
});

i18n.on('languageChanged', () => {
  const container = document.querySelector('#app');
  if (container) container.className = '';
  render();
});

const app = document.querySelector('#app');
let heroDispose = () => {};
let graphDispose = () => {};
let ambientDispose = () => {};
let ambientMounted = false;
let scenesPromise;
let focusTimerId;
let graphController = null;
let graphUi = { closeInspector: () => {}, closeHelp: () => {} };


document.body.classList.toggle('light', state.theme === 'light');

const PRIORITY_WEIGHT = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const IDEA_STATUS_I18N = {
  backlog: 'ideas.statusBacklog',
  active: 'ideas.statusActive',
  review: 'ideas.statusReview',
  completed: 'ideas.statusDone'
};

const TODO_PRIORITY_I18N = {
  low: 'ideas.priorityLow',
  medium: 'ideas.priorityMedium',
  high: 'ideas.priorityHigh',
  critical: 'ideas.priorityCritical'
};

const APP_VIEW_IDS = ['dashboard', 'notes', 'graph', 'ideas', 'productivity'];
const NAV_LABEL_KEYS = {
  dashboard: 'nav.dashboard',
  notes: 'nav.notes',
  graph: 'nav.graph',
  ideas: 'nav.ideas',
  productivity: 'nav.productivity'
};
const PUBLIC_ROUTES = new Set([
  '/',
  '/landing',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/privacy',
  '/terms'
]);
const DIRECT_ROUTE_ALIASES = new Map([
  ['/', '/'],
  ['/landing', '/landing'],
  ['/login', '/login'],
  ['/signup', '/signup'],
  ['/forgot-password', '/forgot-password'],
  ['/reset-password', '/reset-password'],
  ['/verify-email', '/verify-email'],
  ['/privacy', '/privacy'],
  ['/terms', '/terms'],
  ['/workspace', '/app/dashboard'],
  ['/notes', '/app/notes'],
  ['/ideas', '/app/ideas'],
  ['/focus', '/app/productivity'],
  ['/graph', '/app/graph'],
  ['/search', '/app/dashboard']
]);

function tIdeaStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  const canonical = normalized === 'done' ? 'completed' : normalized;
  const key = IDEA_STATUS_I18N[canonical];
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
  if (window.__MINDVAULT_E2E__) {
    const noopScene = () => () => {};
    return Promise.resolve({
      createAmbientBackground: noopScene,
      createHeroScene: noopScene
    });
  }
  scenesPromise ||= import('./three-scenes.js');
  return scenesPromise;
}

async function mountAmbientBackground() {
  if (ambientMounted) return;
  const canvas = document.querySelector('#ambient-bg');
  if (!canvas) return;
  const { createAmbientBackground } = await loadScenes();
  ambientDispose();
  ambientDispose = createAmbientBackground(canvas);
  ambientMounted = true;
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleIdentityPromise) return googleIdentityPromise;
  googleIdentityPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]');
    const script = existing || document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google sign-in failed to load'));
    if (!existing) document.head.appendChild(script);
  });
  return googleIdentityPromise;
}

async function setupGoogleAuthButton() {
  const block = document.querySelector('#google-auth-block');
  const button = document.querySelector('#google-signin-button');
  if (!block || !button) return;
  if (!GOOGLE_CLIENT_ID) {
    block.hidden = true;
    return;
  }

  try {
    const google = await loadGoogleIdentity();
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        if (!credential) return;
        try {
          const data = await api.googleLogin({ credential });
          storage.token = data.token;
          setState({ user: data.user, isOffline: false });
          toast(t('toast.workspaceOpened'));
          renderLoadingScreen(t('state.workspaceLoadingTitle'), t('state.workspaceLoadingBody'));
          await loadWorkspace();
          route('/app/dashboard');
        } catch (error) {
          toast(error.message || t('auth.googleFailed'), 'error');
        }
      }
    });
    button.innerHTML = '';
    const buttonWidth = Math.min(400, Math.max(200, Math.round(block.getBoundingClientRect().width || 300)));
    google.accounts.id.renderButton(button, {
      type: 'standard',
      theme: state.theme === 'light' ? 'outline' : 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: buttonWidth,
      locale: i18n.resolvedLanguage || i18n.language || 'en'
    });
  } catch (err) {
    console.warn('Google Sign-In failed to load or render:', err);
    block.hidden = true;
  }
}

function unmountAmbientBackground() {
  if (!ambientMounted) return;
  ambientDispose();
  ambientDispose = () => {};
  ambientMounted = false;
}

function route(path = location.hash.replace('#', '') || '/') {
  let nextPath = path;
  if (!state.user && nextPath.startsWith('/app')) nextPath = '/login';
  if (state.user && ['/', '/landing', '/login', '/signup', '/forgot-password'].includes(routePath(nextPath))) nextPath = '/app/dashboard';
  history.replaceState(null, '', `#${nextPath}`);
  setState({ route: nextPath });
  render();
}

function routePath(value = state.route || '/') {
  return String(value).split('?')[0] || '/';
}

function routeQuery(value = state.route || '/') {
  const raw = String(value);
  const idx = raw.indexOf('?');
  return idx >= 0 ? raw.slice(idx + 1) : '';
}

function routeFromLocation() {
  if (location.hash) return location.hash.replace('#', '') || '/';
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const routeAlias = DIRECT_ROUTE_ALIASES.get(normalizedPath);
  if (!routeAlias) return '/';
  const query = location.search || '';
  if (!query) return routeAlias;
  return routeAlias.includes('?') ? `${routeAlias}&${query.slice(1)}` : `${routeAlias}${query}`;
}

function passwordStrength(value = '') {
  const password = String(value);
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return 'weak';
  if (score <= 3) return 'medium';
  return 'strong';
}

window.addEventListener('hashchange', () => route(location.hash.replace('#', '') || '/'));

document.body.addEventListener('click', (e) => {
  const toggleBtn = e.target.closest('.password-toggle-btn');
  if (toggleBtn) {
    e.preventDefault();
    const wrapper = toggleBtn.closest('.password-input-wrapper');
    const input = wrapper ? wrapper.querySelector('input') : null;
    if (input) {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggleBtn.innerHTML = icon(isPassword ? 'eyeOff' : 'eye');
    }
  }
});

async function bootstrap() {
  try {
    initGlobalInteractions();
    renderLoadingScreen();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});
    }

    const initialRoute = routeFromLocation();
    // Support direct-path links in hash-based routing.
    if (!location.hash && initialRoute !== '/') {
      history.replaceState(null, '', `#${initialRoute}`);
    }

    if (storage.token) {
      const isOffline = storage.token.startsWith('offline-token:');
      try {
        renderLoadingScreen(t('state.workspaceLoadingTitle'), t('state.workspaceLoadingBody'));
        const { user } = await api.me();
        setState({ user, isOffline });
        await loadWorkspace();
      } catch {
        storage.token = null;
        setState({ isOffline: false });
      }
    }

    route(routeFromLocation());
  } catch (error) {
    globalErrorBoundary.captureError(error, 'bootstrap-error', {});
    renderErrorPage({
      title: t('state.startupErrorTitle'),
      body: t('state.startupErrorBody')
    });
  }
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

function sortNotesForView(notes) {
  return [...notes].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });
}

function sortIdeasForView(ideas) {
  return [...ideas].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}

function renderCurrentAppView() {
  const root = document.querySelector('#view-root');
  if (!root) return;
  const view = currentView();
  if (APP_VIEW_IDS.includes(view)) renderView(view);
}

function refreshWorkspaceInBackground(view) {
  void loadWorkspace()
    .then(() => {
      if (!view || currentView() === view) renderCurrentAppView();
    })
    .catch(() => {});
}

function renderStatePage({
  root = app,
  inShell = false,
  kind = 'info',
  iconName = 'vault',
  code = '',
  title,
  body,
  loading = false,
  primaryLabel,
  primaryHref,
  reload = false,
  secondaryLabel,
  secondaryHref
} = {}) {
  const pageClass = `state-page${inShell ? ' in-shell' : ''}`;
  if (!inShell) {
    mountAmbientBackground().catch(() => {});
    app.className = `app-shell ${kind}-state`;
  }

  root.innerHTML = `
    <section class="${pageClass}" aria-live="${loading ? 'polite' : 'assertive'}">
      <div class="state-card ${kind}-state-card">
        ${loading ? '<div class="loading-spinner" aria-hidden="true"></div>' : `<div class="icon-circle">${icon(iconName)}</div>`}
        ${code ? `<span class="state-code">${escapeHTML(code)}</span>` : ''}
        <h1>${escapeHTML(title || t('state.errorTitle'))}</h1>
        <p>${escapeHTML(body || t('state.errorBody'))}</p>
        ${(primaryLabel || secondaryLabel) ? `
          <div class="actions">
            ${primaryLabel ? (reload
              ? `<button type="button" class="btn primary" data-state-reload>${escapeHTML(primaryLabel)}</button>`
              : `<a class="btn primary" href="${primaryHref || '#/'}">${escapeHTML(primaryLabel)}</a>`) : ''}
            ${secondaryLabel ? `<a class="btn" href="${secondaryHref || '#/'}">${escapeHTML(secondaryLabel)}</a>` : ''}
          </div>
        ` : ''}
      </div>
    </section>
  `;

  root.querySelector('[data-state-reload]')?.addEventListener('click', () => location.reload());
}

function renderLoadingScreen(title = t('state.loadingTitle'), body = t('state.loadingBody')) {
  renderStatePage({
    kind: 'loading',
    loading: true,
    title,
    body
  });
}

function renderErrorPage({
  title = t('state.errorTitle'),
  body = t('state.errorBody'),
  code = t('state.errorCode'),
  inShell = false,
  root = app
} = {}) {
  renderStatePage({
    root,
    inShell,
    kind: 'error',
    iconName: 'spark',
    code,
    title,
    body,
    primaryLabel: t('state.refresh'),
    reload: true,
    secondaryLabel: state.user ? t('state.goDashboard') : t('state.goHome'),
    secondaryHref: state.user ? '#/app/dashboard' : '#/'
  });
}

function renderNotFound(root = app, { inShell = false } = {}) {
  renderStatePage({
    root,
    inShell,
    kind: 'not-found',
    iconName: 'search',
    code: t('state.notFoundCode'),
    title: t('state.notFoundTitle'),
    body: t('state.notFoundBody'),
    primaryLabel: state.user ? t('state.goDashboard') : t('state.goHome'),
    primaryHref: state.user ? '#/app/dashboard' : '#/',
    secondaryLabel: state.user ? t('nav.notes') : t('landing.signIn'),
    secondaryHref: state.user ? '#/app/notes' : '#/login'
  });
}

function render() {
  try {
    clearInterval(focusTimerId);
    heroDispose();
    graphDispose();
    heroDispose = () => {};
    graphDispose = () => {};
    graphController = null;
    graphUi = { closeInspector: () => {}, closeHelp: () => {} };

    const currentRoute = routePath();
    if (!PUBLIC_ROUTES.has(currentRoute) && !currentRoute.startsWith('/app')) return renderNotFound();
    if (currentRoute === '/' || currentRoute === '/landing') return renderLanding();
    if (currentRoute === '/login' || currentRoute === '/signup') return renderAuth(currentRoute === '/signup');
    if (currentRoute === '/forgot-password') return renderForgotPassword();
    if (currentRoute === '/reset-password') return renderResetPassword();
    if (currentRoute === '/verify-email') return renderVerifyEmail();
    if (currentRoute === '/privacy') return renderPrivacy();
    if (currentRoute === '/terms') return renderTerms();
    if (!currentRoute.startsWith('/app')) return renderNotFound();
    return renderApp();
  } catch (error) {
    globalErrorBoundary.captureError(error, 'render-error', { route: state.route });
    renderErrorPage({
      title: t('state.renderErrorTitle'),
      body: t('state.renderErrorBody')
    });
  }
}

function renderLanding() {
  try {
    mountAmbientBackground().catch(() => {});
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
  } catch (error) {
    globalErrorBoundary.captureError(error, 'render-landing', {});
    renderErrorPage({
      title: t('state.renderErrorTitle'),
      body: t('state.renderErrorBody')
    });
  }
}

function renderAuth(signup) {
  try {
    mountAmbientBackground().catch(() => {});
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
        <div class="google-auth-block" id="google-auth-block">
          <div id="google-signin-button" class="google-signin-button" aria-label="${t('auth.continueWithGoogle')}"></div>
          <div class="auth-divider"><span>${t('auth.or')}</span></div>
        </div>
        ${signup ? `<div class="field"><label for="auth-name">${t('auth.name')}</label><input id="auth-name" class="input" name="name" autocomplete="name" required minlength="2" placeholder="${t('auth.namePlaceholder')}" /></div>` : ''}
        <div class="field"><label for="auth-email">${t('auth.email')}</label><input id="auth-email" class="input" type="email" name="email" autocomplete="${signup ? 'email' : 'username'}" required placeholder="${t('auth.emailPlaceholder')}" /></div>
        <div class="field">
          <label for="auth-password">${t('auth.password')}</label>
          <div class="password-input-wrapper">
            <input id="auth-password" class="input" type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="8" placeholder="${t('auth.passwordPlaceholder')}" />
            <button type="button" class="password-toggle-btn" tabindex="-1" aria-label="Toggle password visibility">${icon('eye')}</button>
          </div>
        </div>
        ${signup ? '' : `<p class="auth-inline-action"><button type="button" id="forgot-password-link">${t('auth.forgotPassword')}</button></p>`}
        <button class="btn primary" style="width:100%" type="submit">${signup ? t('auth.createAccount') : t('auth.signIn')}</button>
        <p class="switch-auth">
          ${signup ? t('auth.alreadyHave') : t('auth.newHere')}
          <button type="button" id="switch-auth">${signup ? t('auth.signInLink') : t('auth.createOne')}</button>
        </p>
        <div class="auth-legal-footer" style="text-align: center; margin-top: 1.75rem; padding-top: 1rem; border-top: 1px solid var(--color-border); font-size: 0.8rem; color: var(--color-muted); opacity: 0.8; line-height: 1.4;">
          ${t('auth.legalAgreement')}
          <div style="margin-top: 0.25rem;">
            <a href="#/terms" style="color: var(--color-primary); text-decoration: underline;">${t('auth.termsOfService')}</a>
            <span style="margin: 0 0.5rem;">&bull;</span>
            <a href="#/privacy" style="color: var(--color-primary); text-decoration: underline;">${t('auth.privacyPolicy')}</a>
          </div>
        </div>
      </form>
    </section>
  `;

  setupLanguageMenu('lang-menu-auth', 'lang-toggle-auth', 'lang-dropdown-auth');
  setupGoogleAuthButton();

  document.querySelector('#switch-auth').onclick = () => route(signup ? '/login' : '/signup');
  if (!signup) {
    document.querySelector('#forgot-password-link').onclick = () => route('/forgot-password');
  }
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
      if (signup) {
        toast(data.message || 'Account created. Please check your email to verify your account.', 'info');
        route('/login');
        return;
      }

      const isOffline = data.token.startsWith('offline-token:');
      storage.token = data.token;
      setState({ user: data.user, isOffline });
      
      if (isOffline) toast(t('toast.localOpened'), 'info');
      else toast(t('toast.workspaceOpened'));
      
      renderLoadingScreen(t('state.workspaceLoadingTitle'), t('state.workspaceLoadingBody'));
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
  } catch (error) {
    globalErrorBoundary.captureError(error, 'render-auth', { signup });
    renderErrorPage({
      title: t('state.renderErrorTitle'),
      body: t('state.renderErrorBody')
    });
  }
}

function renderVerifyEmail() {
  mountAmbientBackground().catch(() => {});
  const token = new URLSearchParams(routeQuery()).get('token') || '';
  app.className = 'app-shell';
  app.innerHTML = `
    <section class="auth-page">
      <div class="auth-card surface">
        <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
        <h1>${t('auth.verifyTitle')}</h1>
        <p class="muted" id="verify-status">${t('auth.verifyStatusPlaceholder')}</p>
        <button class="btn primary" style="width:100%" type="button" id="verify-action">${t('auth.verifyAction')}</button>
        <button class="btn" style="width:100%;margin-top:10px;" type="button" id="verify-login">${t('auth.backToSignIn')}</button>
      </div>
    </section>
  `;

  const statusEl = document.querySelector('#verify-status');
  const verifyBtn = document.querySelector('#verify-action');
  const loginBtn = document.querySelector('#verify-login');
  loginBtn.onclick = () => route('/login');

  if (!token) {
    statusEl.textContent = t('auth.verifyFailed');
    verifyBtn.disabled = true;
    toast(t('auth.verifyFailed'), 'error');
    return;
  }

  verifyBtn.onclick = async () => {
    verifyBtn.disabled = true;
    verifyBtn.textContent = t('auth.verifying');
    try {
      await api.verifyEmail(token);
      const message = t('auth.verifySuccess');
      statusEl.textContent = message;
      toast(message);
      verifyBtn.textContent = t('auth.verified');
    } catch (error) {
      console.error('Email verification failed:', error);
      const message = t('auth.verifyFailed');
      statusEl.textContent = message;
      toast(message, 'error');
      verifyBtn.disabled = false;
      verifyBtn.textContent = t('auth.verifyAction');
    }
  };
}

function renderPrivacy() {
  mountAmbientBackground().catch(() => {});
  app.className = 'app-shell';
  app.innerHTML = `
    <section class="auth-page legal-page">
      <div class="auth-card surface legal-card" style="max-width: 700px; text-align: left; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem;">
          <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
          <button class="btn" id="legal-back-btn">${t('auth.backToSignIn')}</button>
        </div>
        <h1 style="font-size: 2rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Privacy Policy</h1>
        <p class="muted" style="margin-bottom: 1.5rem; font-size: 0.9rem;">Last Updated: May 20, 2026</p>
        
        <div class="legal-content" style="max-height: 450px; overflow-y: auto; padding-right: 10px; font-size: 0.95rem; color: var(--color-text); line-height: 1.6;">
          <p style="margin-bottom: 1rem;">Welcome to MindVault ("we", "our", or "us"). We are committed to protecting your privacy and ensuring a secure experience. This Privacy Policy explains how we collect, use, and safeguard your information when you use our Study Planner application.</p>
          
          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">1. Information We Collect</h3>
          <p style="margin-bottom: 1rem;">When you sign up or log in using Google OAuth (Google Sign-In), we collect the following personal information provided by Google Identity Services:</p>
          <ul style="margin-left: 1.5rem; margin-bottom: 1rem; list-style-type: disc;">
            <li style="margin-bottom: 0.5rem;"><strong>Email Address:</strong> Used to uniquely identify your account, send important notifications, and facilitate secure authentication.</li>
            <li style="margin-bottom: 0.5rem;"><strong>Full Name:</strong> Used to personalize your study workspace dashboard and user interface.</li>
            <li style="margin-bottom: 0.5rem;"><strong>Profile Picture:</strong> Used solely to display your avatar in the app dashboard header.</li>
          </ul>
          <p style="margin-bottom: 1rem;">We do not collect or request any other sensitive personal data or search histories.</p>
          
          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">2. How We Use Your Information</h3>
          <p style="margin-bottom: 1rem;">The information we collect is utilized strictly for the following purposes:</p>
          <ul style="margin-left: 1.5rem; margin-bottom: 1rem; list-style-type: disc;">
            <li style="margin-bottom: 0.5rem;">To provision, manage, and secure your personal Study Planner workspace.</li>
            <li style="margin-bottom: 0.5rem;">To authenticate your identity and keep you logged in safely.</li>
            <li style="margin-bottom: 0.5rem;">To provide, maintain, and improve app features like notes, tasks, graphs, and study analytics.</li>
          </ul>

          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">3. Data Storage & Security</h3>
          <p style="margin-bottom: 1rem;">Your security is our priority. We implement modern, high-grade security protocols (including HTTPS, bcrypt encryption, and secure JWT-based tokens) to prevent unauthorized access, alteration, or exposure of your details.</p>
          
          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">4. Third-Party Sharing</h3>
          <p style="margin-bottom: 1rem;">We do NOT sell, trade, rent, or disclose your personal data to third parties, advertising networks, or data brokers. All user data remains confidential within MindVault.</p>

          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">5. Your Rights & Data Deletion</h3>
          <p style="margin-bottom: 1rem;">You have the right to request deletion of your account and all associated personal information at any time. To request deletion, please contact our support team at <a href="mailto:support@mindvault.example.com" style="color: var(--color-primary); text-decoration: underline;">support@mindvault.example.com</a> or use the support option inside your account dashboard.</p>
        </div>
      </div>
    </section>
  `;
  document.querySelector('#legal-back-btn').onclick = () => {
    if (state.user) {
      route('/app/dashboard');
    } else {
      route('/login');
    }
  };
}

function renderTerms() {
  mountAmbientBackground().catch(() => {});
  app.className = 'app-shell';
  app.innerHTML = `
    <section class="auth-page legal-page">
      <div class="auth-card surface legal-card" style="max-width: 700px; text-align: left; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--color-border); padding-bottom: 1rem;">
          <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
          <button class="btn" id="legal-back-btn">${t('auth.backToSignIn')}</button>
        </div>
        <h1 style="font-size: 2rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Terms of Service</h1>
        <p class="muted" style="margin-bottom: 1.5rem; font-size: 0.9rem;">Last Updated: May 20, 2026</p>
        
        <div class="legal-content" style="max-height: 450px; overflow-y: auto; padding-right: 10px; font-size: 0.95rem; color: var(--color-text); line-height: 1.6;">
          <p style="margin-bottom: 1rem;">By accessing and using MindVault ("the Service"), you agree to be bound by these Terms of Service. Please read them carefully.</p>
          
          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">1. Acceptance of Terms</h3>
          <p style="margin-bottom: 1rem;">By creating an account or logging in via Google Sign-In, you confirm that you accept these terms and agree to comply with them. If you do not agree, you must not access or use the Service.</p>
          
          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">2. User Conduct & Accounts</h3>
          <p style="margin-bottom: 1rem;">When creating an account, you agree to:</p>
          <ul style="margin-left: 1.5rem; margin-bottom: 1rem; list-style-type: disc;">
            <li style="margin-bottom: 0.5rem;">Provide accurate and complete information using secure Google Sign-in.</li>
            <li style="margin-bottom: 0.5rem;">Use the Study Planner strictly for educational, academic, or personal organizer purposes.</li>
            <li style="margin-bottom: 0.5rem;">Not engage in any unlawful activity or attempt to breach the system's security systems.</li>
          </ul>
          
          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">3. Intellectual Property</h3>
          <p style="margin-bottom: 1rem;">All features, interactive components, source code, designs, and visual layout are the exclusive intellectual property of MindVault. You retain full ownership and intellectual rights over any study notes, ideas, or files you create inside your planner.</p>
          
          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">4. Limitation of Liability</h3>
          <p style="margin-bottom: 1rem;">The Service is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use the Study Planner application.</p>

          <h3 style="color: var(--color-primary); margin: 1.5rem 0 0.5rem; font-size: 1.15rem;">5. Changes to the Terms</h3>
          <p style="margin-bottom: 1rem;">We reserve the right to modify these Terms of Service at any time. Your continued use of the application following updates constitutes your acceptance of the new terms.</p>
        </div>
      </div>
    </section>
  `;
  document.querySelector('#legal-back-btn').onclick = () => {
    if (state.user) {
      route('/app/dashboard');
    } else {
      route('/login');
    }
  };
}

function renderForgotPassword() {
  mountAmbientBackground().catch(() => {});
  app.className = 'app-shell';
  app.innerHTML = `
    <section class="auth-page">
      <form class="auth-card surface" id="forgot-form">
        <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
        <h1>${t('auth.forgotTitle')}</h1>
        <p class="muted">${t('auth.forgotHint')}</p>
        <div class="field">
          <label for="forgot-email">${t('auth.email')}</label>
          <input id="forgot-email" class="input" type="email" name="email" required autocomplete="email" placeholder="${t('auth.emailPlaceholder')}" />
        </div>
        <button class="btn primary" style="width:100%" type="submit">${t('auth.sendResetLink')}</button>
        <p class="switch-auth">
          <button type="button" id="forgot-back">${t('auth.backToSignIn')}</button>
        </p>
      </form>
    </section>
  `;

  document.querySelector('#forgot-back').onclick = () => route('/login');
  document.querySelector('#forgot-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = t('auth.sendingReset');
    try {
      const payload = Object.fromEntries(new FormData(form));
      const response = await api.forgotPassword(payload);
      toast(response.message || t('auth.resetSent'), 'info');
      route('/login');
    } catch (error) {
      toast(error.message || t('auth.resetFailed'), 'error');
      button.disabled = false;
      button.textContent = original;
    }
  };
}

function renderResetPassword() {
  mountAmbientBackground().catch(() => {});
  const token = new URLSearchParams(routeQuery()).get('token') || '';
  app.className = 'app-shell';
  app.innerHTML = `
    <section class="auth-page">
      <form class="auth-card surface" id="reset-form">
        <a class="brand" href="#/"><span class="logo">${icon('vault')}</span>MindVault</a>
        <h1>${t('auth.resetTitle')}</h1>
        <p class="muted">${t('auth.resetHint')}</p>
        <input type="text" name="username" autocomplete="username" style="display: none;" aria-hidden="true" />
        <div class="field">
          <label for="reset-password">${t('auth.newPassword')}</label>
          <div class="password-input-wrapper">
            <input id="reset-password" class="input" type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="${t('auth.passwordPlaceholder')}" />
            <button type="button" class="password-toggle-btn" tabindex="-1" aria-label="Toggle password visibility">${icon('eye')}</button>
          </div>
        </div>
        <div class="field">
          <label for="reset-confirm">${t('auth.confirmPassword')}</label>
          <div class="password-input-wrapper">
            <input id="reset-confirm" class="input" type="password" name="confirmPassword" required minlength="8" autocomplete="new-password" placeholder="${t('auth.passwordPlaceholder')}" />
            <button type="button" class="password-toggle-btn" tabindex="-1" aria-label="Toggle password visibility">${icon('eye')}</button>
          </div>
        </div>
        <p class="auth-hint" id="password-strength">${t('auth.passwordStrength')}: ${t('auth.strengthWeak')}</p>
        <button class="btn primary" style="width:100%" type="submit">${t('auth.updatePassword')}</button>
        <p class="switch-auth">
          <button type="button" id="reset-back">${t('auth.backToSignIn')}</button>
        </p>
      </form>
    </section>
  `;

  const passwordInput = document.querySelector('#reset-password');
  const confirmInput = document.querySelector('#reset-confirm');
  const strength = document.querySelector('#password-strength');
  const setStrength = () => {
    const level = passwordStrength(passwordInput.value);
    const labels = {
      weak: t('auth.strengthWeak'),
      medium: t('auth.strengthMedium'),
      strong: t('auth.strengthStrong')
    };
    strength.textContent = `${t('auth.passwordStrength')}: ${labels[level]}`;
    strength.dataset.level = level;
  };

  setStrength();
  passwordInput.addEventListener('input', setStrength);

  document.querySelector('#reset-back').onclick = () => route('/login');
  document.querySelector('#reset-form').onsubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      toast(t('auth.resetTokenMissing'), 'error');
      return;
    }
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    if (password.length < 8) {
      toast(t('auth.passwordTooShort'), 'error');
      return;
    }
    if (password !== confirmPassword) {
      toast(t('auth.passwordMismatch'), 'error');
      return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = t('auth.resettingPassword');
    try {
      const response = await api.resetPassword({ token, password });
      toast(response.message || t('auth.passwordResetSuccess'));
      storage.token = null;
      setState({ user: null });
      route('/login');
    } catch (error) {
      toast(error.message || t('auth.resetFailed'), 'error');
      button.disabled = false;
      button.textContent = original;
    }
  };
}

function navItems() {
  return APP_VIEW_IDS.map((id) => [id, t(NAV_LABEL_KEYS[id])]);
}

function currentView() {
  const path = routePath();
  if (path === '/app') return 'dashboard';
  if (!path.startsWith('/app/')) return 'dashboard';
  return path.split('/').filter(Boolean)[1] || 'dashboard';
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

function scoreableActivity(activity = []) {
  return activity.filter((item) => String(item.entityType || item.type || '').toLowerCase() !== 'auth');
}

function computeStreak(activity = []) {
  const days = new Set(scoreableActivity(activity).map((item) => new Date(item.createdAt).toDateString()));
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
  const activeIdeas = state.stats.ideasInMotion || state.ideas.filter((idea) => ['active', 'review'].includes(String(idea.status || '').toLowerCase())).length;
  const pinnedNotes = state.notes.filter((note) => note.pinned || note.favorite).length;
  const recentNotes = state.stats.recentNotes || state.notes.filter((note) => daysAgo(note.updatedAt || note.createdAt) <= 7).length;
  const streak = computeStreak(state.activity);
  const completion = todos.length ? (doneTodos / todos.length) * 100 : 0;
  const focusScore = getDailyScore();

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

function recordDailyAction() {
  incrementDailyScore();
  if (currentView() === 'dashboard') renderCurrentAppView();
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
  unmountAmbientBackground();
  const view = currentView();
  const insights = dashboardInsights();
  const currentLang = i18n.language?.split('-')[0] || 'en';
  const langs = {
    en: t('lang.toEnglish'),
    ar: t('lang.toArabic'),
    kmr: t('lang.toKurdish')
  };
  const langLabel = langs[currentLang] || langs.en;

  const viewRootExists = app.querySelector('#view-root') && app.classList.contains('dashboard-shell');

  if (!viewRootExists) {
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
          <div class="lang-menu" id="lang-menu-sidebar">
            <button class="btn lang-toggle" id="lang-toggle-sidebar" type="button">${langLabel}</button>
            <div class="lang-dropdown" id="lang-dropdown-sidebar">
              ${['en', 'ar', 'kmr'].map((lang) => `
                <button type="button" class="lang-option ${lang === currentLang ? 'active' : ''}" data-lang="${lang}">
                  ${langs[lang]}
                  ${lang === currentLang ? '<span class="checkmark">✓</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
          <button class="btn" id="cmd-open">${icon('command')} ${t('nav.command')}</button>
          <button class="btn" id="theme-toggle">${icon('theme')} ${t('nav.theme')}</button>
          <button class="btn danger" id="logout">${icon('logout')} ${t('nav.logout')}</button>
        </div>
      </aside>
      <button class="sidebar-scrim modal-layer" id="sidebar-scrim" aria-label="${t('a11y.closeMenu')}"></button>

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
      <div class="command-backdrop modal-layer" id="command">
        <div class="cmd surface">
          <label class="sr-only" for="cmd-input">${t('a11y.commandPalette')}</label>
          <input class="input" id="cmd-input" type="text" autocomplete="off" placeholder="${t('shell.cmdPlaceholder')}" />
          <div class="cmd-results" id="cmd-results"></div>
          <div class="cmd-danger-zone">
            <b>Danger Zone</b>
            <button class="btn danger" id="clear-all-data" type="button">Clear All Data & Reset</button>
          </div>
        </div>
      </div>
    `;

    setupLanguageMenu('lang-menu-sidebar', 'lang-toggle-sidebar', 'lang-dropdown-sidebar');
    bindShell();
    gsap.fromTo(app, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  } else {
    // Persistent Shell Optimization: Just update active classes in navigation without replacing HTML
    app.querySelectorAll('.side-link').forEach((link) => {
      const href = link.getAttribute('href');
      const active = href === `#/app/${view}`;
      link.classList.toggle('active', active);
    });
    app.querySelectorAll('.bottom-nav-item').forEach((link) => {
      const href = link.getAttribute('href');
      const active = href === `#/app/${view}`;
      link.classList.toggle('active', active);
    });
    // Update active user day streak
    const streakText = state.isOffline ? t('shell.localMode') : t('shell.dayStreak', { count: insights.streak || 0 });
    const pillTextEl = app.querySelector('.workspace-pill span.muted');
    if (pillTextEl) pillTextEl.textContent = streakText;
  }

  // Animate inner page navigation transition on view change
  animatePageTransition(app.querySelector('#view-root'), () => {
    renderView(view);
  });
}

function bindShell() {
  // Language menu handled by lang-menu dropdowns (landing/auth/sidebar). No direct toggle needed here.
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
  const mobileMenu = document.querySelector('#mobile-menu');
  const closeMenu = () => {
    closeSidebarAnimation(sidebar, scrim);
  };
  const openMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSidebarAnimation(sidebar, scrim);
  };
  mobileMenu.addEventListener('click', openMenu);
  mobileMenu.addEventListener('touchend', (e) => {
    e.preventDefault();
    openMenu(e);
  });
  scrim.addEventListener('click', closeMenu);
  scrim.addEventListener('touchend', (e) => {
    e.preventDefault();
    closeMenu();
  });
  document.querySelectorAll('.side-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });
  document.querySelector('#quick-note').onclick = () => openNoteEditor();
  document.querySelector('#cmd-open').onclick = () => openCommand();
  document.querySelector('#clear-all-data').onclick = async () => {
    if (window.confirm('This will delete all notes, scores, and streaks. This cannot be undone.')) {
      try {
        await clearAllAppData();
      } catch (error) {
        toast(error.message || 'Could not clear app data', 'error');
      }
    }
  };
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
      graphUi.closeInspector();
      graphUi.closeHelp();
      closeMenu();
    }
  };
  document.querySelector('#global-search').oninput = debounce(async (event) => {
    const q = event.target.value.trim();
    if (currentView() === 'graph' && graphController?.applySearch) {
      graphController.applySearch(q);
      return;
    }
    if (!q) return;
    const { results } = await api.search(q);
    setState({ searchResults: results });
    openCommand(q);
  }, 220);
}

function renderView(view) {
  const root = document.querySelector('#view-root');
  if (!APP_VIEW_IDS.includes(view)) return renderNotFound(root, { inShell: true });
  if (view === 'dashboard') return renderDashboard(root);
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
  const activeIdeas = state.ideas.filter((idea) => ['active', 'review'].includes(String(idea.status || '').toLowerCase())).slice(0, 3);
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
          ${state.activity.slice(0, 5).map((item) => `
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
    if (text) saveProd({ focus: text });
    route('/app/productivity');
  });
  root.querySelectorAll('[data-dashboard-todo]').forEach((button) => {
    button.onclick = () => {
      saveProd({
        todos: (state.productivity.todos || []).map((todo) => todo.id === button.dataset.dashboardTodo ? { ...todo, done: true } : todo)
      });
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
    const previousNotes = state.notes;
    const stamp = new Date().toISOString();
    const optimisticId = note._id || `pending-${uid()}`;
    const optimisticNote = {
      ...note,
      ...payload,
      _id: optimisticId,
      user: note.user || state.user?._id || state.user?.id,
      createdAt: note.createdAt || stamp,
      updatedAt: stamp
    };

    setState({
      notes: sortNotesForView(note._id
        ? previousNotes.map((item) => item._id === note._id ? optimisticNote : item)
        : [optimisticNote, ...previousNotes])
    });
    route('/app/notes');
    api.saveNote(payload, note._id)
      .then(({ note: savedNote }) => {
        if (!savedNote) return;
        setState({
          notes: sortNotesForView(state.notes.map((item) => item._id === optimisticId || item._id === savedNote._id ? savedNote : item))
        });
        recordDailyAction();
        if (currentView() === 'notes') renderCurrentAppView();
        toast(t('toast.noteSaved'));
        refreshWorkspaceInBackground('notes');
      })
      .catch((error) => {
        setState({ notes: previousNotes });
        if (currentView() === 'notes') renderCurrentAppView();
        toast(error.message || 'Note save failed', 'error');
      });
  });

  setTimeout(() => {
    const textarea = document.querySelector('[name=content]');
    const preview = document.querySelector('#md-preview');
    if (textarea && preview) textarea.oninput = debounce(() => { preview.innerHTML = markdown(textarea.value); }, 120);
  }, 0);
}

function deleteNote(id) {
  const previousNotes = state.notes;
  setState({ notes: previousNotes.filter((note) => note._id !== id) });
  renderCurrentAppView();
  api.deleteNote(id)
    .then(() => {
      recordDailyAction();
      toast(t('toast.noteDeleted'));
      refreshWorkspaceInBackground(currentView());
    })
    .catch((error) => {
      setState({ notes: previousNotes });
      renderCurrentAppView();
      toast(error.message || 'Note delete failed', 'error');
    });
}



function renderGraph(root) {
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>${t('graph.title')}</h2>
        <p class="muted">${t('graph.subtitle')}</p>
      </div>
    </div>
    <div class="graph-layout">
      <div class="graph-panel card" id="graph">
        <div class="graph-canvas" id="graph-canvas"><div class="skeleton"></div></div>
        <div class="graph-vignette" aria-hidden="true"></div>
        <div class="graph-controls" role="group" aria-label="${t('graph.controlsLabel')}">
          <button class="graph-control-btn" data-graph-action="zoom-in" aria-label="${t('graph.zoomIn')}">+</button>
          <button class="graph-control-btn" data-graph-action="zoom-out" aria-label="${t('graph.zoomOut')}">-</button>
          <button class="graph-control-btn" data-graph-action="reset">${t('graph.reset')}</button>
          <button class="graph-control-btn" data-graph-action="fit">${t('graph.fit')}</button>
          <button class="graph-control-btn graph-control-export" data-graph-action="download">${t('graph.downloadPng')}</button>
        </div>
        <button class="graph-help-toggle" id="graph-help-toggle" aria-label="${t('graph.howItWorks')}">?</button>
        <div class="graph-inspector-backdrop modal-layer" id="graph-inspector-backdrop"></div>
        <aside class="graph-inspector-panel" id="inspector" aria-hidden="true">
          <button class="graph-inspector-close" id="graph-inspector-close" aria-label="${t('common.close')}">
            ${icon('close')}
          </button>
          <div id="graph-inspector-content">
            <h3>${t('graph.selectNode')}</h3>
            <p class="muted">${t('graph.selectHint')}</p>
          </div>
        </aside>
        <div class="graph-help-modal modal-layer" id="graph-help-modal" aria-hidden="true">
          <div class="graph-help-card" role="dialog" aria-modal="true" aria-labelledby="graph-help-title">
            <button class="graph-help-close" id="graph-help-close" aria-label="${t('common.close')}">${icon('close')}</button>
            <h3 id="graph-help-title">${t('graph.helpTitle')}</h3>
            <p>${t('graph.helpBody')}</p>
            <p>${t('graph.helpBody2')}</p>
          </div>
        </div>
      </div>
      <aside class="card graph-side-placeholder">
        <h3>${t('graph.selectNode')}</h3>
        <p class="muted">${t('graph.selectHint')}</p>
      </aside>
    </div>
  `;

  const graphPanel = root.querySelector('#graph');
  const graphCanvas = root.querySelector('#graph-canvas');
  const inspector = root.querySelector('#inspector');
  const inspectorContent = root.querySelector('#graph-inspector-content');
  const inspectorBackdrop = root.querySelector('#graph-inspector-backdrop');
  const helpModal = root.querySelector('#graph-help-modal');

  const closeInspector = () => {
    inspector.classList.remove('open');
    inspectorBackdrop.classList.remove('open');
    inspector.setAttribute('aria-hidden', 'true');
  };
  const openInspector = () => {
    inspector.classList.add('open');
    inspectorBackdrop.classList.add('open');
    inspector.setAttribute('aria-hidden', 'false');
  };
  const closeHelp = () => {
    helpModal.classList.remove('open');
    helpModal.setAttribute('aria-hidden', 'true');
  };
  const openHelp = () => {
    helpModal.classList.add('open');
    helpModal.setAttribute('aria-hidden', 'false');
  };
  graphUi = { closeInspector, closeHelp };

  root.querySelector('#graph-inspector-close').onclick = closeInspector;
  inspectorBackdrop.onclick = closeInspector;
  root.querySelector('#graph-help-toggle').onclick = openHelp;
  root.querySelector('#graph-help-close').onclick = closeHelp;
  helpModal.onclick = (event) => {
    if (event.target === helpModal) closeHelp();
  };

  api.getGraphNodes().then((payload) => {
    if (!document.body.contains(graphCanvas)) return;

    if (root._skeletonPulseCleanup) {
      root._skeletonPulseCleanup();
      root._skeletonPulseCleanup = null;
    }

    graphController = createGraphExperience(graphCanvas, payload?.data || payload, {
      onSelect: (node) => {
        const typeLabel = node.type === 'idea' ? t('graph.typeIdea') : t('graph.typeNote');
        const meta = node.folder || node.status || t('graph.workspace');
        const content = String(node.content || node.description || '');
        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
        const badgeColor = node.color || '#2dd4bf';
        inspectorContent.innerHTML = `
          <div class="graph-node-preview">
            <div class="graph-node-avatar" style="--node-color:${badgeColor}">
              ${escapeHTML((node.title || '?').trim().charAt(0).toUpperCase() || '?')}
            </div>
            <div class="graph-node-main">
              <h3>${escapeHTML(node.title || 'Untitled')}</h3>
              <span class="graph-type-pill" style="--pill-color:${badgeColor}">${escapeHTML(typeLabel)}</span>
            </div>
          </div>
          <div class="graph-tags-row">${(node.tags || []).map((tag) => `<span class="graph-tag-pill">${escapeHTML(tag)}</span>`).join('') || '<span class="muted">No tags</span>'}</div>
          <p class="graph-meta">${escapeHTML(meta)}</p>
          <div class="graph-node-metadata">${wordCount}</div>
          <button class="graph-open-note-btn" id="graph-open-note">Open Note</button>
        `;
        inspectorContent.querySelector('#graph-open-note').onclick = () => {
          if (node.type === 'note') {
            const note = state.notes.find((item) => String(item._id) === String(node._id));
            if (note) openNoteEditor(note);
          } else {
            route('/app/ideas');
          }
        };
        openInspector();
      },
      onCanvasClick: () => {
        closeInspector();
      }
    });
    graphDispose = () => graphController?.destroy?.();

    const searchValue = document.querySelector('#global-search')?.value?.trim();
    if (searchValue) graphController.applySearch(searchValue);

    root.querySelectorAll('[data-graph-action]').forEach((button) => {
      button.onclick = async () => {
        if (!graphController) return;
        const action = button.dataset.graphAction;
        if (action === 'zoom-in') graphController.zoomIn();
        if (action === 'zoom-out') graphController.zoomOut();
        if (action === 'reset') graphController.resetView();
        if (action === 'fit') graphController.fitToScreen();
        if (action === 'download') await graphController.downloadPng();
      };
    });

    staggerEntrance(root);
  }).catch(() => {
    if (root._skeletonPulseCleanup) {
      root._skeletonPulseCleanup();
      root._skeletonPulseCleanup = null;
    }
    graphPanel.innerHTML = `<p class="muted">${t('graph.loadError')}</p>`;
  });
}

function renderIdeas(root) {
  const statuses = ['backlog', 'active', 'review', 'completed'];
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
          <h3>${escapeHTML(tIdeaStatus(status))}<span class="muted">${state.ideas.filter((idea) => (String(idea.status || '').toLowerCase() === status || (status === 'completed' && String(idea.status || '').toLowerCase() === 'done'))).length}</span></h3>
          ${state.ideas.filter((idea) => (String(idea.status || '').toLowerCase() === status || (status === 'completed' && String(idea.status || '').toLowerCase() === 'done'))).map(ideaCard).join('')}
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
    lane.ondrop = (event) => {
      const idea = state.ideas.find((item) => item._id === event.dataTransfer.getData('text/plain'));
      if (!idea) return;
      const previousIdeas = state.ideas;
      const optimisticIdea = { ...idea, status: lane.dataset.status, updatedAt: new Date().toISOString() };
      setState({
        ideas: sortIdeasForView(previousIdeas.map((item) => item._id === idea._id ? optimisticIdea : item))
      });
      renderView('ideas');
      api.saveIdea({ ...idea, status: lane.dataset.status }, idea._id)
        .then(({ idea: savedIdea }) => {
          if (!savedIdea) return;
          setState({
            ideas: sortIdeasForView(state.ideas.map((item) => item._id === savedIdea._id ? savedIdea : item))
          });
          recordDailyAction();
          if (currentView() === 'ideas') renderCurrentAppView();
          refreshWorkspaceInBackground('ideas');
        })
        .catch((error) => {
          setState({ ideas: previousIdeas });
          if (currentView() === 'ideas') renderCurrentAppView();
          toast(error.message || 'Idea save failed', 'error');
        });
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
  const statusOpts = ['backlog', 'active', 'review', 'completed'];
  const priorityOpts = ['low', 'medium', 'high', 'critical'];
  modal(idea._id ? t('ideas.editTitle') : t('ideas.newTitle'), `
    <div class="field"><label for="modal-idea-title">${t('ideas.fieldTitle')}</label><input class="input" id="modal-idea-title" name="title" value="${escapeHTML(idea.title || '')}" /></div>
    <div class="field"><label for="modal-idea-description">${t('ideas.fieldDescription')}</label><textarea class="textarea" id="modal-idea-description" name="description">${escapeHTML(idea.description || '')}</textarea></div>
    <div class="form-row">
      <div class="field"><label for="modal-idea-status">${t('ideas.status')}</label><select class="select" id="modal-idea-status" name="status">${statusOpts.map((status) => `<option value="${status}" ${(String(idea.status || '').toLowerCase() === status || (status === 'completed' && String(idea.status || '').toLowerCase() === 'done')) ? 'selected' : ''}>${escapeHTML(tIdeaStatus(status))}</option>`).join('')}</select></div>
      <div class="field"><label for="modal-idea-priority">${t('ideas.priority')}</label><select class="select" id="modal-idea-priority" name="priority">${priorityOpts.map((priority) => `<option value="${priority}" ${String(idea.priority || '').toLowerCase() === priority ? 'selected' : ''}>${escapeHTML(tTodoPriority(priority))}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="field"><label for="modal-idea-category">${t('ideas.category')}</label><input class="input" id="modal-idea-category" name="category" value="${escapeHTML(idea.category || 'General')}" /></div>
      <div class="field"><label for="modal-idea-progress">${t('ideas.progress')}</label><input class="input" id="modal-idea-progress" type="number" min="0" max="100" name="progress" value="${idea.progress || 0}" /></div>
    </div>
    <div class="field"><label for="modal-idea-tags">${t('ideas.tags')}</label><input class="input" id="modal-idea-tags" name="tags" value="${escapeHTML((idea.tags || []).join(', '))}" placeholder="${t('ideas.tagsPlaceholder')}" /></div>
  `, async (root) => {
    const form = root.querySelector('.modal-body');
    const payload = {
      title: form.querySelector('[name=title]').value || t('ideas.untitled'),
      description: form.querySelector('[name=description]').value,
      status: form.querySelector('[name=status]').value,
      priority: form.querySelector('[name=priority]').value,
      category: form.querySelector('[name=category]').value || 'General',
      progress: Number(form.querySelector('[name=progress]').value),
      tags: form.querySelector('[name=tags]').value.split(',').map((tag) => tag.trim()).filter(Boolean)
    };
    const previousIdeas = state.ideas;
    const stamp = new Date().toISOString();
    const optimisticId = idea._id || `pending-${uid()}`;
    const optimisticIdea = {
      ...idea,
      ...payload,
      _id: optimisticId,
      user: idea.user || state.user?._id || state.user?.id,
      createdAt: idea.createdAt || stamp,
      updatedAt: stamp
    };

    setState({
      ideas: sortIdeasForView(idea._id
        ? previousIdeas.map((item) => item._id === idea._id ? optimisticIdea : item)
        : [optimisticIdea, ...previousIdeas])
    });
    route('/app/ideas');
    api.saveIdea(payload, idea._id)
      .then(({ idea: savedIdea }) => {
        if (!savedIdea) return;
        setState({
          ideas: sortIdeasForView(state.ideas.map((item) => item._id === optimisticId || item._id === savedIdea._id ? savedIdea : item))
        });
        recordDailyAction();
        if (currentView() === 'ideas') renderCurrentAppView();
        toast(t('toast.ideaSaved'));
        refreshWorkspaceInBackground('ideas');
      })
      .catch((error) => {
        setState({ ideas: previousIdeas });
        if (currentView() === 'ideas') renderCurrentAppView();
        toast(error.message || 'Idea save failed', 'error');
      });
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
        <form id="todo-form" class="focus-task-form">
          <div>
            <label class="sr-only" for="todo-text">${t('a11y.newTask')}</label>
            <textarea class="autosize-input" id="todo-text" name="todo" rows="1" placeholder="${t('focus.addTaskPlaceholder')}" required style="width:100%"></textarea>
          </div>
          <div>
            <label class="sr-only" for="todo-priority">${t('a11y.taskPriority')}</label>
            <select class="select" id="todo-priority" name="priority">
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
        recordDailyAction();
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

  // Autosize the todo textarea vertically so it grows as the user types
  const _todoText = root.querySelector('#todo-text');
  if (_todoText) {
    const autosize = (el) => {
      el.style.height = 'auto';
      const scroll = el.scrollHeight;
      el.style.height = scroll + 'px';
      el.style.overflowY = 'hidden';
    };
    autosize(_todoText);
    _todoText.addEventListener('input', () => autosize(_todoText));
    window.addEventListener('resize', () => autosize(_todoText));
  }

  root.querySelector('#save-focus').onclick = async () => {
    await saveProd({ focus: root.querySelector('#focus-text').value });
    toast(t('toast.focusSaved'));
  };

  display();
}

async function saveProd(patch) {
  const previousProductivity = state.productivity;
  const productivity = { ...state.productivity, ...patch };
  setState({ productivity });
  void api.saveProductivity(productivity)
    .then((response) => {
      setState({ productivity: response.productivity || productivity });
      recordDailyAction();
    })
    .catch((error) => {
      setState({ productivity: previousProductivity });
      renderCurrentAppView();
      toast(error.message || 'Productivity save failed', 'error');
    });
  return productivity;
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
