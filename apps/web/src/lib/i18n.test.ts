import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, dictionaries, readLocale, translate } from './i18n';

describe('internationalization', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to Slovak', () => {
    expect(DEFAULT_LOCALE).toBe('sk');
    expect(readLocale()).toBe('sk');
    expect(translate('sk', 'landing.join')).toBe('Pripojiť sa ku kvízu');
  });
  it('reads saved English preference', () => {
    localStorage.setItem('quizicius:locale', 'en');
    expect(readLocale()).toBe('en');
  });
  it('falls back on unknown stored language', () => {
    localStorage.setItem('quizicius:locale', 'de');
    expect(readLocale()).toBe('sk');
  });
  it('keeps translation keys complete in both locales', () => {
    expect(Object.keys(dictionaries.sk).sort()).toEqual(Object.keys(dictionaries.en).sort());
  });
});
