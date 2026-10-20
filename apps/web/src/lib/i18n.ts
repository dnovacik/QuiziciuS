import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Locale = 'sk' | 'en';
export const DEFAULT_LOCALE: Locale = 'sk';
const STORAGE_KEY = 'quizicius:locale';

export const dictionaries = {
  sk: {
    'brand.name': 'QuiziciuS',
    'nav.language': 'Jazyk',
    'landing.tagline': 'Kvízové večery, na ktoré sa nezabúda.',
    'landing.description': 'Vytvorte kvíz, pozvite tímy a súťažte vo svojej krčme, lige alebo Superlige.',
    'landing.host': 'Organizovať kvíz',
    'landing.join': 'Pripojiť sa ku kvízu',
    'landing.forHosts': 'Pre organizátorov',
    'landing.forTeams': 'Pre tímy',
    'landing.forLeagues': 'Pre ligy',
    'landing.hostDescription': 'Pripravte otázky a riaďte celý kvízový večer.',
    'landing.teamDescription': 'Pripojte sa s tímom a sledujte svoje výsledky.',
    'landing.leagueDescription': 'Hrajte pravidelne a kvalifikujte sa do Superligy.',
  },
  en: {
    'brand.name': 'QuiziciuS',
    'nav.language': 'Language',
    'landing.tagline': 'Make every quiz night memorable.',
    'landing.description': 'Create quizzes, invite teams, and compete at your pub, in a league, or in the Super-League.',
    'landing.host': 'Host a quiz',
    'landing.join': 'Join a quiz',
    'landing.forHosts': 'For hosts',
    'landing.forTeams': 'For teams',
    'landing.forLeagues': 'For leagues',
    'landing.hostDescription': 'Prepare questions and run the whole quiz night.',
    'landing.teamDescription': 'Join with your team and track your results.',
    'landing.leagueDescription': 'Play regularly and qualify for the Super-League.',
  },
} as const;

export type TranslationKey = keyof typeof dictionaries.sk;
export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];
}
export function readLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
type I18nContextValue = { locale: Locale; setLocale: (next: Locale) => void; t: (key: TranslationKey) => string };
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* storage can be disabled */ }
  }, [locale]);
  return <I18nContext.Provider value={{ locale, setLocale, t: (key) => translate(locale, key) }}>{children}</I18nContext.Provider>;
}
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used under I18nProvider');
  return value;
}
