import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN/index';
import enUS from './en-US/index';

function getInitialLanguage() {
  const saved = localStorage.getItem('user-language');
  if (saved) return saved;
  const navLang = navigator.language || (navigator as any).userLanguage;
  if (navLang && navLang.toLowerCase().startsWith('en')) {
    return 'en-US';
  }
  return 'zh-CN'; // Default to Chinese
}

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getInitialLanguage(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

export default i18n;
