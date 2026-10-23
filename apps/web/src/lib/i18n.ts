import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import sk from '../locales/sk.json';
import en from '../locales/en.json';

export type Locale = 'sk' | 'en';
export const DEFAULT_LOCALE: Locale = 'sk';
const STORAGE_KEY = 'quizicius:locale';

export const dictionaries = { sk, en } as const;

export type TranslationKey = keyof typeof dictionaries.sk;
export type Translate = (key: TranslationKey) => string;
export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];
}
/** Base keys of count words, stored as `<key>.one` / `.few` / `.other` (e.g. 1 bod, 2 body, 5 bodov). */
export type CountKey = TranslationKey extends infer K ? (K extends `${infer Base}.one` ? Base : never) : never;
export type Plural = (key: CountKey, count: number) => string;

/** Slovak has three forms for whole numbers (1 / 2–4 / 0, 5+); English has two. */
export function pluralForm(locale: Locale, count: number): 'one' | 'few' | 'other' {
  const category = new Intl.PluralRules(locale).select(count);
  return category === 'one' || category === 'few' ? category : 'other';
}
export function translateCount(locale: Locale, key: CountKey, count: number): string {
  return translate(locale, `${key}.${pluralForm(locale, count)}` as TranslationKey);
}
export function isTranslationKey(key: string): key is TranslationKey {
  return key in dictionaries[DEFAULT_LOCALE];
}
export function readLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey) => string;
  /** The word for a count in the right plural form; render the number yourself: `{n} {plural('count.points', n)}`. */
  plural: Plural;
};
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* storage can be disabled */
    }
  }, [locale]);
  return createElement(
    I18nContext.Provider,
    {
      value: { locale, setLocale, t: (key) => translate(locale, key), plural: (key, count) => translateCount(locale, key, count) },
    },
    children,
  );
}
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used under I18nProvider');
  return value;
}
