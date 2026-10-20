import { Link } from 'react-router-dom';
import { useI18n } from './lib/i18n';

export function LandingPage() {
  const { locale, setLocale, t } = useI18n();
  const audiences = [
    { title: t('landing.forHosts'), description: t('landing.hostDescription'), icon: '🍺', tint: 'from-amber-950/70', link: '/host', cta: t('landing.host'), visual: '📋', detail: t('landing.hostVisual') },
    { title: t('landing.forTeams'), description: t('landing.teamDescription'), icon: '👥', tint: 'from-blue-950/70', link: '/play', cta: t('landing.join'), visual: '📱', detail: t('landing.teamVisual') },
    { title: t('landing.forLeagues'), description: t('landing.leagueDescription'), icon: '🏆', tint: 'from-emerald-950/70', visual: '🏅', detail: t('landing.leagueVisual') },
  ];
  return (
    <main className="min-h-screen bg-[#090c18] text-[#F5F3FF]">
      <header className="relative z-10 border-b border-white/10 bg-[#0b0d19]/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link to="/" className="text-2xl font-black tracking-tight"><span className="text-amber-400">♛</span> {t('brand.name')}</Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-200 lg:flex" aria-label={t('landing.navigation')}>
            <a href="#features" className="hover:text-white">{t('landing.features')}</a>
            <a href="#audiences" className="hover:text-white">{t('landing.audiences')}</a>
            <a href="#how-it-works" className="hover:text-white">{t('landing.how')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1" aria-label={t('nav.language')}>
              <button type="button" aria-label="Slovenčina" title="Slovenčina" aria-pressed={locale === 'sk'} onClick={() => setLocale('sk')} className={`rounded-lg border px-2 py-1 text-xl ${locale === 'sk' ? 'border-violet-400 bg-violet-600/25' : 'border-slate-700 bg-[#202437] hover:border-slate-400'}`}>🇸🇰</button>
              <button type="button" aria-label="English" title="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className={`rounded-lg border px-2 py-1 text-xl ${locale === 'en' ? 'border-violet-400 bg-violet-600/25' : 'border-slate-700 bg-[#202437] hover:border-slate-400'}`}>🇬🇧</button>
            </nav>
            <Link to="/host" className="rounded-lg border border-violet-400/50 px-4 py-2 text-sm font-semibold hover:bg-violet-900/40">{t('landing.host')}</Link>
          </div>
        </div>
      </header>
      <section className="relative overflow-hidden" aria-labelledby="landing-title">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(110,32,139,0.23),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:pb-20 lg:pt-20">
          <div>
            <span className="inline-flex rounded-full border border-violet-500/25 bg-violet-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-violet-200">🏆 {t('landing.eyebrow')}</span>
            <h1 id="landing-title" className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl xl:text-6xl">{t('landing.tagline')}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">{t('landing.description')}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/play" className="rounded-xl bg-violet-600 px-7 py-4 font-semibold shadow-lg shadow-violet-950/50 transition hover:bg-violet-500">{t('landing.join')} →</Link>
              <Link to="/host" className="rounded-xl border border-violet-400/50 bg-black/30 px-7 py-4 font-semibold hover:bg-violet-900/30">{t('landing.host')}</Link>
            </div>
            <div id="features" className="mt-12 grid grid-cols-3 gap-3 border-t border-white/10 pt-7 text-sm">
              <div><span className="text-xl">🍻</span><p className="mt-2 font-semibold">{t('landing.forHosts')}</p></div>
              <div><span className="text-xl">👥</span><p className="mt-2 font-semibold">{t('landing.forTeams')}</p></div>
              <div><span className="text-xl">🏆</span><p className="mt-2 font-semibold">{t('landing.forLeagues')}</p></div>
            </div>
          </div>
          <div className="relative">
            <img src="/quiz-hero.svg" alt={t('landing.heroAlt')} width="850" height="650" className="w-full rounded-3xl border border-white/10 object-cover shadow-2xl shadow-purple-950/40" />
            <div className="absolute inset-x-0 bottom-0 h-24 rounded-b-3xl bg-gradient-to-t from-[#090c18]/75 to-transparent" aria-hidden="true" />
          </div>
        </div>
      </section>
      <section id="audiences" className="mx-auto max-w-7xl px-5 pb-20 lg:px-8" aria-labelledby="audiences-title">
        <div className="rounded-3xl border border-slate-700/60 bg-[#101524] p-5 sm:p-8">
          <h2 id="audiences-title" className="text-center text-2xl font-bold sm:text-3xl">{t('landing.platform')}</h2>
          <p className="mt-2 text-center text-slate-400">{t('landing.platformDescription')}</p>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {audiences.map(audience => (
              <article key={audience.title} className={`flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b ${audience.tint} to-[#0d1220] p-6`}>
                <div className="text-3xl" aria-hidden="true">{audience.icon}</div>
                <h3 className="mt-3 text-xl font-bold">{audience.title}</h3>
                <p className="mt-2 min-h-20 leading-relaxed text-slate-300">{audience.description}</p>
                <div className="mt-5 flex min-h-44 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#0b1020]/70">
                  <span aria-hidden="true" className="text-6xl">{audience.visual}</span>
                  <p className="mt-3 px-3 text-center text-sm text-slate-300">{audience.detail}</p>
                </div>
                {audience.link && <Link to={audience.link} className="mt-5 self-start font-semibold text-violet-300 hover:text-white">{audience.cta} →</Link>}
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="how-it-works" className="mx-auto max-w-5xl px-5 pb-24 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{t('landing.how')}</h2>
        <p className="mt-3 text-slate-400">{t('landing.howDescription')}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {[t('landing.step1'),t('landing.step2'),t('landing.step3')].map((step,index) => <div key={step} className="rounded-xl border border-white/10 bg-[#151827] p-6"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 font-bold">{index+1}</div><p className="mt-4 font-medium">{step}</p></div>)}
        </div>
      </section>
      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-400">© QuiziciuS · {t('landing.footer')}</footer>
    </main>
  );
}
