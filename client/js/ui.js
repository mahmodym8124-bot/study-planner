import gsap from 'gsap';

const icons = {
  vault: '<path d="M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3Z"/><path d="M12 12 4.8 7.4"/><path d="m12 12 7.2-4.6"/><path d="M12 12v8.4"/>',
  dashboard: '<path d="M4 13h6V4H4v9Z"/><path d="M14 20h6v-9h-6v9Z"/><path d="M4 20h6v-3H4v3Z"/><path d="M14 7h6V4h-6v3Z"/>',
  notes: '<path d="M6 3h9l3 3v15H6V3Z"/><path d="M14 3v4h4"/><path d="M9 12h6"/><path d="M9 16h6"/>',
  files: '<path d="M4 6h6l2 2h8v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"/><path d="M4 10h16"/>',
  graph: '<circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="18" r="3"/><path d="m8.5 9.5 2 5"/><path d="m15.5 9.5-2 5"/><path d="M9 7h6"/>',
  ideas: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.2 14.6A7 7 0 1 1 15.8 14c-.7.7-.8 1.4-.8 2H9c0-.8-.2-1.2-.8-1.4Z"/>',
  productivity: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M7 17.5 5.5 19"/><path d="m18.5 19-1.5-1.5"/>',
  focus: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
  theme: '<path d="M12 3a9 9 0 1 0 9 9 6.5 6.5 0 0 1-9-9Z"/>',
  logout: '<path d="M10 17 15 12l-5-5"/><path d="M15 12H3"/><path d="M21 4v16"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 14h8l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  close: '<path d="m6 6 12 12"/><path d="M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  command: '<path d="M8 8H6a2 2 0 1 1 2-2v2Z"/><path d="M16 8h2a2 2 0 1 0-2-2v2Z"/><path d="M8 16H6a2 2 0 1 0 2 2v-2Z"/><path d="M16 16h2a2 2 0 1 1-2 2v-2Z"/><path d="M8 8h8v8H8z"/>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m5 15 .8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z"/>',
  calendar: '<path d="M7 3v4"/><path d="M17 3v4"/><path d="M4 8h16"/><path d="M5 5h14v16H5z"/>',
  activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'
};

export function icon(name) {
  return `<span class="icon-mark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${icons[name] || icons.spark}</svg></span>`;
}

export function toast(message, type = 'info') {
  const stack =
    document.querySelector('.toast-stack') ||
    document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast-stack' }));
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  gsap.from(el, { y: 14, opacity: 0, duration: 0.2, ease: 'power2.out' });
  setTimeout(() => {
    gsap.to(el, { y: 8, opacity: 0, duration: 0.18, onComplete: () => el.remove() });
  }, 3000);
}

export function escapeHTML(str = '') {
  return String(str).replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[c]);
}

export function markdown(text = '') {
  return escapeHTML(text)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function modal(title, body, onSave) {
  let root = document.querySelector('.modal-backdrop');
  if (!root) {
    root = document.createElement('div');
    root.className = 'modal-backdrop';
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="modal surface">
      <div class="modal-head">
        <h2>${escapeHTML(title)}</h2>
        <button class="icon-button" data-close aria-label="Close">${icon('close')}</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="actions">
        <button class="btn primary" data-save>${icon('check')} Save</button>
        <button class="btn" data-close>Cancel</button>
      </div>
    </div>
  `;

  root.classList.add('open');
  gsap.from(root.querySelector('.modal'), { scale: 0.98, opacity: 0, y: 14, duration: 0.2, ease: 'power2.out' });
  root.querySelectorAll('[data-close]').forEach((button) => {
    button.onclick = () => root.classList.remove('open');
  });
  root.querySelector('[data-save]').onclick = async () => {
    await onSave(root);
    root.classList.remove('open');
  };
}

export function skeleton(count = 4) {
  return Array.from({ length: count }, () => '<div class="skeleton"></div>').join('');
}
