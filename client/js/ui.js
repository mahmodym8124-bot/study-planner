import gsap from 'gsap';

const icons = {
  vault: 'MV',
  dashboard: 'D',
  notes: 'N',
  files: 'F',
  graph: 'G',
  ideas: 'I',
  productivity: 'P',
  focus: 'P',
  search: '/',
  plus: '+',
  upload: '^',
  theme: '*',
  logout: '>',
  menu: '=',
  trash: 'x',
  edit: 'e',
  close: 'x',
  check: 'ok'
};

export function icon(name) {
  return `<span class="icon-mark" aria-hidden="true">${icons[name] || '-'}</span>`;
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
