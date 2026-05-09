import '../styles/app.css';
import gsap from 'gsap';
import { api, storage } from './api.js';
import { state, setState, formatDate, uid } from './store.js';
import { icon, toast, escapeHTML, markdown, debounce, modal, skeleton } from './ui.js';

const app = document.querySelector('#app');
let heroDispose = () => {};
let graphDispose = () => {};
let ambientDispose = () => {};
let scenesPromise;

document.body.classList.toggle('light', state.theme === 'light');

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
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

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

        <div id="visual" class="hero-visual surface">
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

function renderApp() {
  const view = currentView();
  app.className = 'dashboard-shell';
  app.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="#/app/dashboard"><span class="logo">${icon('vault')}</span>MindVault</a>
      <nav class="side-nav">
        ${navItems().map(([id, label]) => `
          <a class="side-link ${view === id ? 'active' : ''}" href="#/app/${id}">
            ${icon(id)} ${label}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="btn" id="cmd-open">Command</button>
        <button class="btn" id="theme-toggle">${icon('theme')} Theme</button>
        <button class="btn danger" id="logout">${icon('logout')} Logout</button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar surface">
        <button class="icon-button mobile-toggle" id="mobile-menu" aria-label="Open menu">${icon('menu')}</button>
        <div class="search-wrap">
          ${icon('search')}
          <input class="input" id="global-search" placeholder="Search notes, files, ideas, tags..." />
        </div>
        <button class="btn" id="quick-note">${icon('plus')}<span class="hide-mobile">New note</span></button>
        <div class="avatar">${escapeHTML(state.user?.name?.[0] || 'M')}</div>
      </header>
      <section id="view-root"></section>
    </main>

    <div class="toast-stack"></div>
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
  document.querySelector('#mobile-menu').onclick = () => document.querySelector('#sidebar').classList.toggle('open');
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

function renderDashboard(root) {
  const firstName = state.user?.name?.split(' ')[0] || 'there';
  root.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">Today, ${new Date().toLocaleDateString()}</p>
        <h2>Good focus, ${escapeHTML(firstName)}.</h2>
        <p class="muted">Your workspace is ready for notes, files, ideas, and planning.</p>
      </div>
      <div class="actions">
        <button class="btn primary" id="dash-note">${icon('plus')} Note</button>
        <button class="btn" id="dash-upload">${icon('upload')} Upload</button>
      </div>
    </div>

    <div class="grid stats">
      ${[
        ['Notes', state.stats.notes || 0, '#3dd6c6'],
        ['Files', state.stats.files || 0, '#47a3ff'],
        ['Ideas', state.stats.ideas || 0, '#f7b955'],
        ['Todos', state.productivity.todos?.length || 0, '#5ee0a3']
      ].map(([label, value, color]) => `
        <div class="card stat-card" style="--glow:${color}">
          <span class="muted">${label}</span>
          <strong>${value}</strong>
        </div>
      `).join('')}
    </div>

    <div class="split">
      <div class="card">
        <h3>Recent notes</h3>
        <div class="notes-grid">${state.notes.slice(0, 4).map(noteCard).join('') || '<p class="muted">No notes yet. Create your first note.</p>'}</div>
      </div>
      <div class="card">
        <h3>Activity</h3>
        <div class="timeline">
          ${state.activity.slice(0, 8).map((item) => `
            <div class="timeline-item">
              <span class="dot"></span>
              <div>
                <b>${escapeHTML(item.action)}</b>
                <div class="muted">${escapeHTML(item.subject)} - ${formatDate(item.createdAt)}</div>
              </div>
            </div>
          `).join('') || '<p class="muted">Activity will appear here.</p>'}
        </div>
      </div>
    </div>
  `;
  root.querySelector('#dash-note').onclick = () => openNoteEditor();
  root.querySelector('#dash-upload').onclick = () => route('/app/files');
  bindNoteCards(root);
}

function noteCard(note) {
  return `
    <article class="card note-card">
      <div class="tags">
        ${note.pinned ? '<span class="tag">Pinned</span>' : ''}
        ${note.favorite ? '<span class="tag">Favorite</span>' : ''}
        ${(note.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
      </div>
      <h3>${escapeHTML(note.title)}</h3>
      <p class="muted">${escapeHTML((note.content || '').slice(0, 130))}</p>
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
    <div class="notes-grid">${state.notes.map(noteCard).join('') || skeleton(4)}</div>
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
    <div class="files-grid">${state.files.map(fileCard).join('') || '<p class="muted">No files uploaded yet.</p>'}</div>
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
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', 'Uploads');
    form.append('tags', 'imported');
    await api.upload(form);
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
    <div class="field"><label>Progress</label><input class="input" type="number" min="0" max="100" name="progress" value="${idea.progress || 0}" /></div>
  `, async (root) => {
    const form = root.querySelector('.modal-body');
    await api.saveIdea({
      title: form.querySelector('[name=title]').value || 'Untitled idea',
      description: form.querySelector('[name=description]').value,
      status: form.querySelector('[name=status]').value,
      priority: form.querySelector('[name=priority]').value,
      progress: Number(form.querySelector('[name=progress]').value)
    }, idea._id);
    toast('Idea saved');
    await loadWorkspace();
    route('/app/ideas');
  });
}

function renderProductivity(root) {
  const productivity = state.productivity;
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Focus</h2>
        <p class="muted">Keep the day simple: timer, tasks, and one focus note.</p>
      </div>
    </div>
    <div class="grid productivity">
      <section class="card">
        <h3>Pomodoro</h3>
        <div class="timer" id="timer">25:00</div>
        <div class="actions">
          <button class="btn primary" id="timer-start">Start</button>
          <button class="btn" id="timer-reset">Reset</button>
        </div>
      </section>
      <section class="card">
        <h3>Tasks</h3>
        <form id="todo-form" class="actions">
          <input class="input" name="todo" placeholder="Add a task" />
          <button class="btn">Add</button>
        </form>
        <div>
          ${(productivity.todos || []).map((todo) => `
            <div class="todo ${todo.done ? 'done' : ''}" data-todo="${todo.id}">
              <span>${todo.done ? '[x]' : '[ ]'}</span>${escapeHTML(todo.text)}
            </div>
          `).join('')}
        </div>
      </section>
      <section class="card">
        <h3>Daily focus</h3>
        <textarea class="textarea" id="focus-text" placeholder="What matters most today?">${escapeHTML(productivity.focus || '')}</textarea>
        <button class="btn primary" id="save-focus">Save focus</button>
        <h3>Calendar</h3>
        <p class="muted">${new Date().toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </section>
    </div>
  `;
  bindProductivity(root);
}

function bindProductivity(root) {
  let seconds = 25 * 60;
  let timerId;
  const display = () => {
    root.querySelector('#timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };

  root.querySelector('#timer-start').onclick = () => {
    clearInterval(timerId);
    timerId = setInterval(() => {
      seconds = Math.max(0, seconds - 1);
      display();
      if (seconds === 0) {
        clearInterval(timerId);
        toast('Pomodoro complete');
      }
    }, 1000);
  };
  root.querySelector('#timer-reset').onclick = () => {
    seconds = 25 * 60;
    display();
  };
  root.querySelector('#todo-form').onsubmit = async (event) => {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get('todo');
    if (!text) return;
    await saveProd({ todos: [...(state.productivity.todos || []), { id: uid(), text, done: false }] });
    renderView('productivity');
  };
  root.querySelectorAll('[data-todo]').forEach((element) => {
    element.onclick = async () => {
      await saveProd({
        todos: state.productivity.todos.map((todo) => todo.id === element.dataset.todo ? { ...todo, done: !todo.done } : todo)
      });
      renderView('productivity');
    };
  });
  root.querySelector('#save-focus').onclick = async () => {
    await saveProd({ focus: root.querySelector('#focus-text').value });
    toast('Focus saved');
  };
}

async function saveProd(patch) {
  const productivity = { ...state.productivity, ...patch };
  await api.saveProductivity(productivity);
  setState({ productivity });
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
