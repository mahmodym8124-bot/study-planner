import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';

const createClassList = () => {
  const classes = new Set();
  return {
    add: jest.fn((name) => classes.add(name)),
    remove: jest.fn((name) => classes.delete(name)),
    toggle: jest.fn((name, force) => {
      if (force === undefined) {
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      }
      if (force) classes.add(name);
      else classes.delete(name);
      return force;
    }),
    contains: (name) => classes.has(name)
  };
};

const createButton = (lang) => {
  const listeners = {};
  return {
    dataset: { lang },
    addEventListener: jest.fn((event, handler) => {
      listeners[event] = handler;
    }),
    click() {
      listeners.click?.({ stopPropagation: jest.fn() });
    }
  };
};

const createMenuDom = () => {
  const menu = {
    classList: {
      toggle: jest.fn(),
      remove: jest.fn()
    }
  };
  const toggle = {
    addEventListener: jest.fn((event, handler) => {
      toggle.listeners[event] = handler;
    }),
    listeners: {}
  };
  const buttons = [createButton('en'), createButton('ar')];
  const dropdown = {
    querySelectorAll: jest.fn(() => buttons)
  };
  const documentClick = { handler: null };

  const documentMock = {
    documentElement: { lang: '', dir: '' },
    body: { classList: createClassList() },
    title: '',
    querySelector: jest.fn((selector) => {
      if (selector === 'meta[name="description"]') {
        return { setAttribute: jest.fn() };
      }
      if (selector === '.skip-link') {
        return { textContent: '' };
      }
      return null;
    }),
    querySelectorAll: jest.fn((selector) => {
      if (selector === '.lang-menu.open') return [menu];
      return [];
    }),
    getElementById: jest.fn((id) => {
      if (id === 'menu') return menu;
      if (id === 'toggle') return toggle;
      if (id === 'dropdown') return dropdown;
      return null;
    }),
    addEventListener: jest.fn((event, handler) => {
      if (event === 'click') documentClick.handler = handler;
    })
  };

  return { documentMock, menu, toggle, dropdown, buttons, documentClick };
};

describe('language support', () => {
  let i18n;
  let syncDocumentLang;
  let setupLanguageMenu;
  let documentState;

  beforeAll(async () => {
    documentState = createMenuDom();
    globalThis.document = documentState.documentMock;
    globalThis.window = {
      document: documentState.documentMock,
      localStorage: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      navigator: { language: 'en-US', languages: ['en-US'] },
      location: { search: '', hash: '', pathname: '/' }
    };
    globalThis.navigator = globalThis.window.navigator;
    globalThis.localStorage = globalThis.window.localStorage;
    globalThis.location = globalThis.window.location;

    const i18nModule = await import('../../client/js/i18n.js');
    i18n = i18nModule.default;
    syncDocumentLang = i18nModule.syncDocumentLang;
    jest.spyOn(i18n, 'changeLanguage').mockImplementation(async (lng) => {
      i18n.language = lng;
      i18n.resolvedLanguage = lng;
      return lng;
    });
    ({ setupLanguageMenu } = await import('../../client/js/language-menu.js'));
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
    syncDocumentLang();
    documentState.menu.classList.toggle.mockClear();
    documentState.menu.classList.remove.mockClear();
    documentState.toggle.addEventListener.mockClear();
    documentState.dropdown.querySelectorAll.mockClear();
    documentState.documentMock.addEventListener.mockClear();
    documentState.documentMock.querySelectorAll.mockClear();
  });

  it('syncs document direction for English and Arabic', async () => {
    await i18n.changeLanguage('en');
    syncDocumentLang();
    expect(documentState.documentMock.documentElement.lang).toBe('en');
    expect(documentState.documentMock.documentElement.dir).toBe('ltr');
    expect(documentState.documentMock.body.classList.contains('ltr')).toBe(true);
    expect(documentState.documentMock.body.classList.contains('rtl')).toBe(false);

    await i18n.changeLanguage('ar');
    syncDocumentLang();
    expect(documentState.documentMock.documentElement.lang).toBe('ar');
    expect(documentState.documentMock.documentElement.dir).toBe('rtl');
    expect(documentState.documentMock.body.classList.contains('rtl')).toBe(true);
    expect(documentState.documentMock.body.classList.contains('ltr')).toBe(false);
  });

  it('wires the sidebar language menu for English and Arabic', async () => {
    setupLanguageMenu('menu', 'toggle', 'dropdown');

    documentState.toggle.listeners.click({ stopPropagation: jest.fn() });
    expect(documentState.menu.classList.toggle).toHaveBeenCalledWith('open');

    documentState.buttons[1].click();
    expect(i18n.changeLanguage).toHaveBeenCalledWith('ar');
    expect(documentState.menu.classList.remove).toHaveBeenCalledWith('open');

    documentState.documentClick.handler({ target: { closest: jest.fn(() => null) } });
    expect(documentState.documentMock.querySelectorAll).toHaveBeenCalledWith('.lang-menu.open');
    expect(documentState.menu.classList.remove).toHaveBeenCalledWith('open');
  });
});
