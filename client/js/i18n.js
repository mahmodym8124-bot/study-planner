import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

export function syncDocumentLang() {
  const lng = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
  const isAr = lng === 'ar';
  document.documentElement.lang = isAr ? 'ar' : 'en';
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.title = i18n.t('meta.pageTitle');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', i18n.t('meta.description'));
  const skip = document.querySelector('.skip-link');
  if (skip) skip.textContent = i18n.t('a11y.skipToContent');
}

i18n.use(LanguageDetector).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar }
  },
  fallbackLng: 'en',
  supportedLngs: ['en', 'ar'],
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
