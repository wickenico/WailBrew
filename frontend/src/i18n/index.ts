import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import tr from './locales/tr.json';
import zhCN from "./locales/zhCN.json";
import zhTW from "./locales/zhTW.json";
import pt_BR from './locales/pt_BR.json';
import ru from './locales/ru.json';

const resources = {
  en: {
    translation: en
  },
  de: {
    translation: de
  },
  fr: {
    translation: fr
  },
  tr: {
    translation: tr,
  },
  zhCN: {
    translation: zhCN,
  },
  zhTW: {
    translation: zhTW,
  },
  pt_BR: {
    translation: pt_BR,
  },
  ru: {
    translation: ru,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;
