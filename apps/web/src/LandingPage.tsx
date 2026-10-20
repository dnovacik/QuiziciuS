import { Link } from 'react-router-dom';
import { useI18n } from './lib/i18n';

export function LandingPage() {
  const { locale, setLocale, t } = useI18n();
  return (
    <main className="min-h-screen bg-[#0B0D19] text-[#F5F3FF]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="text-2xl font-bold"><span className="text-amber-400">♛</span> {t('brand.name')}</Link>
        <nav className="flex items-center gap-3">
          <label htmlFor="language" className="text-sm text-slate-300">{t('nav.language')}</label>
          <select id="language" aria-label={t('nav.language')} value={locale} onChange={e => setLocale(e.target.value as 'sk' | 'en')} className="rounded-lg border border-slate-600 bg-[#202437] px-3 py-2 text-white">
            <option value="sk">Slovenčina</option>
            <option value="en">English</option>
          </select>
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{t('landing.tagline')}</h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">{t('landing.description')}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/host" className="rounded-xl bg-violet-600 px-7 py-4 font-semibold text-white hover:bg-violet-500">{t('landing.host')}</Link>
            <Link to="/play" className="rounded-xl border border-violet-400 px-7 py-4 font-semibold text-white hover:bg-violet-900">{t('landing.join')}</Link>
          </div>
        </div>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
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
