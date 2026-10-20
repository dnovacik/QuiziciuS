import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

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
    'landing.navigation': 'Hlavná navigácia',
    'landing.eyebrow': 'Platforma pre pub kvízy a ligy',
    'landing.features': 'Funkcie',
    'landing.audiences': 'Pre koho',
    'landing.how': 'Ako to funguje',
    'landing.heroAlt': 'Ilustrácia pub kvízu s mobilnou otázkou a víťazným pohárom',
    'landing.platform': 'Jedna platforma. Tri spôsoby, ako zažiť kvíz.',
    'landing.platformDescription': 'Organizujte, hrajte a súťažte – od lokálnych pubov až po finále Superligy.',
    'landing.hostVisual': 'Organizujte kvízové večery a spravujte otázky.',
    'landing.teamVisual': 'Získavajte body a sledujte úspechy tímu.',
    'landing.leagueVisual': 'Od miestnej ligy až k veľkému finále.',
    'landing.howDescription': 'Všetko, čo potrebujete pre svoj ďalší kvízový večer.',
    'landing.step1': 'Organizátor pripraví kvíz.',
    'landing.step2': 'Tímy sa pripoja cez telefón.',
    'landing.step3': 'Hrajte naživo a súťažte o prvenstvo.',
    'landing.footer': 'Kvízové večery, na ktoré sa nezabúda.',
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
    'landing.navigation': 'Main navigation',
    'landing.eyebrow': 'Pub quiz and league platform',
    'landing.features': 'Features',
    'landing.audiences': 'Who it is for',
    'landing.how': 'How it works',
    'landing.heroAlt': 'Pub quiz illustration showing a mobile question and a winner trophy',
    'landing.platform': 'One platform. Three ways to enjoy a quiz.',
    'landing.platformDescription': 'Host, play and compete – from local pubs to the Super-League final.',
    'landing.hostVisual': 'Run quiz nights and manage questions.',
    'landing.teamVisual': 'Earn points and track your team achievements.',
    'landing.leagueVisual': 'From your local league to the grand final.',
    'landing.howDescription': 'Everything you need for your next quiz night.',
    'landing.step1': 'The host prepares a quiz.',
    'landing.step2': 'Teams join on their phones.',
    'landing.step3': 'Play live and compete for first place.',
    'landing.footer': 'Make every quiz night memorable.',
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
  return createElement(I18nContext.Provider, { value: { locale, setLocale, t: (key) => translate(locale, key) } }, children);
}
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used under I18nProvider');
  return value;
}
