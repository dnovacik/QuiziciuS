import { Link } from 'react-router-dom';
import { useI18n } from './lib/i18n';

export function LandingPage() {
  const { locale, setLocale, t } = useI18n();
  return (
    <main className="min-h-screen bg-[#0B0D19] text-[#F5F3FF]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="text-2xl font-bold"><span className="text-amber-400">♛</span> {t('brand.name')}</Link>
        <nav className="flex items-center gap-2" aria-label={t('nav.language')}>
          <button type="button" aria-label="Slovenčina" title="Slovenčina" aria-pressed={locale === 'sk'} onClick={() => setLocale('sk')} className={`rounded-lg border px-3 py-2 text-xl transition-colors ${locale === 'sk' ? 'border-violet-400 bg-violet-600/25' : 'border-slate-700 bg-[#202437] hover:border-slate-400'}`}>🇸🇰</button>
          <button type="button" aria-label="English" title="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className={`rounded-lg border px-3 py-2 text-xl transition-colors ${locale === 'en' ? 'border-violet-400 bg-violet-600/25' : 'border-slate-700 bg-[#202437] hover:border-slate-400'}`}>🇬🇧</button>
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{t('landing.tagline')}</h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">{t('landing.description')}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/host" className="rounded-xl bg-violet-600 px-7 py-4 font-semibold text-white hover:bg-violet-500">{t('landing.host')}</Link>
              <Link to="/play" className="rounded-xl border border-violet-400 px-7 py-4 font-semibold text-white hover:bg-violet-900">{t('landing.join')}</Link>
            </div>
          </div>
          <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-8 rounded-full bg-violet-700/10 blur-3xl" />
            <div className="relative rotate-2 rounded-3xl border border-violet-400/30 bg-[#151827] p-5 shadow-2xl shadow-violet-950/40">
              <div className="flex items-center justify-between text-sm text-slate-400"><span>QuiziciuS</span><span className="rounded-full bg-violet-500/20 px-3 py-1 text-violet-200">03 / 10</span></div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full w-1/3 rounded-full bg-violet-500" /></div>
              <div className="mx-auto my-9 flex h-24 w-24 items-center justify-center rounded-full border-4 border-violet-400/70 bg-violet-500/10 text-5xl">🏆</div>
              <div className="mx-auto h-4 w-4/5 rounded-full bg-slate-300/30" />
              <div className="mx-auto mt-3 h-4 w-3/5 rounded-full bg-slate-300/20" />
              <div className="mt-9 grid grid-cols-2 gap-3">
                {['A','B','C','D'].map((option, index) => <div key={option} className={`flex items-center gap-3 rounded-xl border p-4 ${index === 1 ? 'border-violet-400 bg-violet-600/30' : 'border-slate-600 bg-[#202437]'}`}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-900">{option}</span><span className="h-2 w-14 rounded-full bg-slate-400/50" /></div>)}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-24 grid gap-4 md:grid-cols-3">
          {([
            ['landing.forHosts', 'landing.hostDescription'],
            ['landing.forTeams', 'landing.teamDescription'],
            ['landing.forLeagues', 'landing.leagueDescription'],
          ] as const).map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-[#34344A] bg-[#151827] p-6">
              <h2 className="text-xl font-semibold">{t(title)}</h2>
              <p className="mt-2 text-slate-300">{t(description)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
