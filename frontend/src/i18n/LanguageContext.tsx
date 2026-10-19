import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('ergon_language') as Language;
      if (saved && (saved === 'ru' || saved === 'tj' || saved === 'en')) {
        return saved;
      }
      // Browser language detection
      const navLang = navigator.language.toLowerCase();
      if (navLang.startsWith('tg') || navLang.startsWith('tj')) return 'tj';
      if (navLang.startsWith('en')) return 'en';
    } catch (e) {
      console.error('Failed to read language:', e);
    }
    return 'ru';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('ergon_language', lang);
      const token = localStorage.getItem('ergon_token') || localStorage.getItem('ergon_access_token');
      if (token) {
        import('../services/api').then(({ api }) => {
          api.put('/users/me', { language: lang }).catch(() => {});
        });
      }
    } catch (e) {
      console.error('Failed to save language:', e);
    }
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const langDict = translations[language] || translations['ru'];
    let text = langDict[key] || translations['ru'][key] || key;

    if (replacements) {
      Object.entries(replacements).forEach(([replaceKey, val]) => {
        text = text.replace(`{${replaceKey}}`, String(val));
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
