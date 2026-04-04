import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import hi from './hi.json';
import kn from './kn.json';
import ta from './ta.json';
import te from './te.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  kn: { translation: kn },
  ta: { translation: ta },
  te: { translation: te },
};

// Detect device locale — fallback to Hindi
const getDeviceLocale = (): string => {
  try {
    // expo-localization may not be available in web
    const Localization = require('expo-localization');
    const locales = Localization.getLocales?.();
    if (locales && locales.length > 0) {
      const lang = locales[0].languageCode;
      if (lang && resources[lang as keyof typeof resources]) {
        return lang;
      }
    }
  } catch {
    // fallback
  }
  return 'hi';
};

i18n.use(initReactI18next).init({
  resources,
  // Product default language is English. Users can override from Settings.
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
];
