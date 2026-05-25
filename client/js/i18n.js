import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../locales/en.json' with { type: 'json' };
import ar from '../locales/ar.json' with { type: 'json' };
import kmr from '../locales/kmr.json' with { type: 'json' };
import bad from '../locales/bad.json' with { type: 'json' };
// RTL languages
const RTL_LANGUAGES = ['ar', 'kmr', 'bad'];

export function syncDocumentLang() {
  const rawLanguage = i18n.resolvedLanguage || i18n.language || i18n.options?.fallbackLng || 'en';
  const lng = String(Array.isArray(rawLanguage) ? rawLanguage[0] : rawLanguage).split('-')[0] || 'en';
  const isRTL = RTL_LANGUAGES.includes(lng);

  document.documentElement.lang = lng;
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.body?.classList.toggle('rtl', isRTL);
  document.body?.classList.toggle('ltr', !isRTL);

  document.title = i18n.t('meta.pageTitle');
  const metaDesc = document.querySelector('meta[name="description"]');
  metaDesc?.setAttribute('content', i18n.t('meta.description'));
  const skip = document.querySelector('.skip-link');
  if (skip) {
    skip.textContent = i18n.t('a11y.skipToContent');
  }
}

i18n.use(LanguageDetector).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    kmr: { translation: kmr },
    bad: { translation: bad }
  },
  fallbackLng: 'en',
  supportedLngs: ['en', 'ar', 'kmr', 'bad'],
  load: 'languageOnly',
  cleanCode: true,
  interpolation: { escapeValue: false },
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'mindvault_lang'
  }
}).then(syncDocumentLang);

i18n.on('languageChanged', syncDocumentLang);

export default i18n;
