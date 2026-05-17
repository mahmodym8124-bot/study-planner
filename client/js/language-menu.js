import i18n from './i18n.js';

let globalClickBound = false;

function closeOpenLanguageMenus(event) {
  if (event?.target?.closest?.('.lang-menu')) return;
  document.querySelectorAll('.lang-menu.open').forEach((menu) => menu.classList.remove('open'));
}

function ensureGlobalClickHandler() {
  if (globalClickBound) return;
  document.addEventListener('click', closeOpenLanguageMenus);
  globalClickBound = true;
}

export function setupLanguageMenu(menuId, toggleId, dropdownId) {
  const menu = document.getElementById(menuId);
  const toggle = document.getElementById(toggleId);
  const dropdown = document.getElementById(dropdownId);

  if (!menu || !toggle || !dropdown) return;

  ensureGlobalClickHandler();

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.classList.toggle('open');
  });

  dropdown.querySelectorAll('.lang-option').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      void i18n.changeLanguage(button.dataset.lang);
      menu.classList.remove('open');
    });
  });
}
