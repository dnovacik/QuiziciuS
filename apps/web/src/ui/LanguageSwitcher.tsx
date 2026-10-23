import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useI18n, type Locale } from '../lib/i18n';

// Flag emoji don't render on Windows, so the switcher shows a globe and the language code.
const LANGUAGES: { locale: Locale; label: string }[] = [
  { locale: 'sk', label: 'Slovenčina' },
  { locale: 'en', label: 'English' },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((language) => language.locale === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid="language-switcher"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('common.language')}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-dark-850/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-dark-800"
      >
        <Globe className="h-4 w-4 text-slate-400" />
        <span className="font-semibold tracking-wide">{current.locale.toUpperCase()}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.5} />
      </button>
      {open && (
        <div role="menu" className="glass-card absolute right-0 z-50 mt-2 w-40 rounded-xl py-1.5 shadow-2xl">
          {LANGUAGES.map((language) => (
            <button
              key={language.locale}
              type="button"
              role="menuitemradio"
              aria-checked={language.locale === locale}
              data-testid={`language-${language.locale}`}
              onClick={() => {
                setLocale(language.locale);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <span className="w-5 text-slate-400">{language.locale.toUpperCase()}</span> {language.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
