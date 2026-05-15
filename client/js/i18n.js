import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../locales/en.json';
import ar from '../locales/ar.json';
import kmr from '../locales/kmr.json';

// RTL languages
const RTL_LANGUAGES = ['ar', 'kmr'];

export function syncDocumentLang() {
  const lng = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
  const isRTL = RTL_LANGUAGES.includes(lng);
  
  document.documentElement.lang = lng;
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', isRTL);
  document.body.classList.toggle('ltr', !isRTL);
  
  document.title = i18n.t('meta.pageTitle');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', i18n.t('meta.description'));
  const skip = document.querySelector('.skip-link');
  if (skip) skip.textContent = i18n.t('a11y.skipToContent');
}

i18n.use(LanguageDetector).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    kmr: { translation: kmr }
  },
  fallbackLng: 'en',
  supportedLngs: ['en', 'ar', 'kmr'],
  interpolation: { escapeValue: false },
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupLocalStorage: 'mindvault_lang'
  }
});

syncDocumentLang();
i18n.on('languageChanged', syncDocumentLang);

export default i18n;
