import { Link } from 'react-router-dom';
import { useI18n } from './lib/i18n';

/** Team account authentication is delivered in the next work package. */
export function TeamAuthEntry() {
  const { locale, setLocale } = useI18n();
  const en = locale === 'en';
  return (
    <main className="flex min-h-screen flex-col bg-[#060310] px-5 text-slate-100">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between py-6">
        <Link to="/" className="text-2xl font-black" aria-label="QuiziciuS">♛ QuiziciuS</Link>
        <div className="flex gap-2">
          <button type="button" aria-label="Slovenčina" aria-pressed={locale === 'sk'} onClick={() => setLocale('sk')} className="rounded-lg border border-purple-500/40 px-3 py-2">🇸🇰</button>
          <button type="button" aria-label="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className="rounded-lg border border-purple-500/40 px-3 py-2">🇬🇧</button>
        </div>
      </header>
      <section className="mx-auto my-auto w-full max-w-md rounded-3xl border border-purple-500/30 bg-[#120e2e] p-8 text-center">
        <h1 className="text-3xl font-bold">{en ? 'Team account' : 'Tímový účet'}</h1>
        <p className="mt-4 text-slate-300">{en ? 'Team sign-in and registration are being prepared. Until then, you can still join an existing quiz using the current guest flow.' : 'Prihlásenie a registráciu tímov pripravujeme. Dovtedy sa môžete pripojiť k existujúcemu kvízu cez súčasný režim pre hostí.'}</p>
        <div className="mt-7 grid grid-cols-2 gap-3" aria-label={en ? 'Planned account actions' : 'Pripravované akcie účtu'}>
          <span aria-disabled="true" className="rounded-xl border border-purple-500/30 px-3 py-3 text-slate-400">{en ? 'Sign in (soon)' : 'Prihlásiť sa (čoskoro)'}</span>
          <span aria-disabled="true" className="rounded-xl border border-purple-500/30 px-3 py-3 text-slate-400">{en ? 'Register (soon)' : 'Registrácia (čoskoro)'}</span>
        </div>
        <Link to="/play" className="mt-6 block rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500">{en ? 'Join a quiz as guest' : 'Pripojiť sa ku kvízu ako hosť'}</Link>
        <Link to="/" className="mt-5 inline-block text-sm text-purple-300">{en ? 'Back to homepage' : 'Späť na úvod'}</Link>
      </section>
    </main>
  );
}
