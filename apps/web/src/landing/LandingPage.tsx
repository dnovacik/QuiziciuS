import { useRef, useState } from 'react';
import { BarChart3, CalendarDays, Crown, PlayCircle, Users } from 'lucide-react';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Logo } from '../ui/Logo';
import { secondaryButtonClass } from '../ui/form';
import { HostAuthCard } from './HostAuthCard';
import { TeamEntryModal } from './TeamEntryModal';

const FEATURES: { icon: typeof CalendarDays; title: TranslationKey; description: TranslationKey }[] = [
  { icon: CalendarDays, title: 'landing.feature.plan.title', description: 'landing.feature.plan.desc' },
  { icon: PlayCircle, title: 'landing.feature.live.title', description: 'landing.feature.live.desc' },
  { icon: BarChart3, title: 'landing.feature.results.title', description: 'landing.feature.results.desc' },
  { icon: Users, title: 'landing.feature.community.title', description: 'landing.feature.community.desc' },
];

/** Public portal — Stitch screen "Host & Team Pub Quiz Portal". */
export function LandingPage() {
  const { t } = useI18n();
  const hostCardRef = useRef<HTMLDivElement>(null);
  const [teamEntryOpen, setTeamEntryOpen] = useState(false);
  const [highlightHost, setHighlightHost] = useState(false);

  function focusHostCard() {
    setTeamEntryOpen(false);
    hostCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    setHighlightHost(true);
    window.setTimeout(() => setHighlightHost(false), 1500);
  }

  return (
    <div data-testid="landing-page" className="bg-pub-canvas relative flex min-h-screen flex-col overflow-x-hidden text-slate-100">
      <div className="bokeh-amber left-[40%] top-24" />
      <div className="bokeh-violet right-[5%] top-10" />
      <div className="bokeh-amber bottom-10 left-[10%] opacity-40" />

      <header className="relative z-30 w-full border-b border-white/5 bg-dark-950/60 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1536px] items-center justify-between px-4 sm:px-6 lg:px-12">
          <Logo to="/" />
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <button type="button" data-testid="open-team-entry" className={secondaryButtonClass} onClick={() => setTeamEntryOpen(true)}>
              <Users className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">{t('landing.nav.teams')}</span>
            </button>
            <button
              type="button"
              data-testid="focus-host-login"
              onClick={focusHostCard}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-neon-violet transition-all hover:from-purple-500 hover:to-indigo-500 active:scale-95"
            >
              <Crown className="h-4 w-4 fill-amber-300 text-amber-300" />
              <span className="hidden sm:inline">{t('landing.nav.hosts')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-20 flex flex-grow items-center py-8 lg:py-12">
        <div className="mx-auto grid w-full max-w-[1536px] grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-12 xl:gap-14">
          <section className="space-y-8 lg:col-span-7 xl:space-y-10">
            <div className="space-y-4">
              <h1 className="text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl xl:text-6xl">
                {t('landing.hero.title')} <span className="text-glow text-brand-glow">{t('landing.hero.highlight')}</span>
              </h1>
              <p className="max-w-2xl pt-1 text-base leading-relaxed text-slate-300 sm:text-lg">{t('landing.hero.subtitle')}</p>
            </div>

            <ul className="max-w-xl space-y-4 pt-1">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <li key={title} className="group flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-dark-800/90 shadow-inner transition group-hover:border-purple-500/50 group-hover:bg-purple-950/30">
                    <Icon className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-wide text-white">{t(title)}</h2>
                    <p className="mt-0.5 text-sm leading-snug text-slate-400">{t(description)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-center lg:col-span-5 lg:justify-end">
            <HostAuthCard ref={hostCardRef} highlighted={highlightHost} onOpenTeamEntry={() => setTeamEntryOpen(true)} />
          </div>
        </div>
      </main>

      {teamEntryOpen && <TeamEntryModal onClose={() => setTeamEntryOpen(false)} onSwitchToHost={focusHostCard} />}
    </div>
  );
}
