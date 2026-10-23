import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, dictionaries, readLocale, translate, translateCount } from './i18n';

describe('internationalization', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to Slovak', () => {
    expect(DEFAULT_LOCALE).toBe('sk');
    expect(readLocale()).toBe('sk');
    expect(translate('sk', 'landing.nav.teams')).toBe('Tímy');
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
  it('uses the Slovak plural forms for counts', () => {
    expect([0, 1, 2, 4, 5, 21].map((n) => `${n} ${translateCount('sk', 'count.points', n)}`)).toEqual([
      '0 bodov',
      '1 bod',
      '2 body',
      '4 body',
      '5 bodov',
      '21 bodov',
    ]);
    expect(translateCount('sk', 'count.teamsConnected', 3)).toBe('tímy pripojené');
  });
  it('uses singular and plural in English', () => {
    expect(translateCount('en', 'count.points', 1)).toBe('point');
    expect(translateCount('en', 'count.points', 3)).toBe('points');
  });
  it('defines every plural form for every count word', () => {
    const bases = new Set(
      Object.keys(dictionaries.sk)
        .filter((key) => key.startsWith('count.'))
        .map((key) => key.replace(/\.[a-z]+$/, '')),
    );
    for (const base of bases) for (const form of ['one', 'few', 'other']) expect(dictionaries.sk).toHaveProperty([`${base}.${form}`]);
  });
});
