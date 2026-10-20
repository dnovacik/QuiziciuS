import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, PlayCircle, BarChart3, Users, Crown, Eye, EyeOff, X, Mail, Lock } from 'lucide-react';
import { supabase } from './lib/supabase-client';
import { useI18n } from './lib/i18n';
import { TeamDialog } from './TeamDialog';
import './stitch-landing.css';

type HostMode = 'login' | 'register' | 'recover';
type FeedbackCode = 'AUTH_SIGN_IN_FAILED' | 'AUTH_SIGN_UP_FAILED' | 'AUTH_RECOVERY_FAILED' | 'AUTH_REGISTERED' | 'AUTH_RECOVERY_SENT';

export function StitchLanding() {
  const { locale, setLocale, t } = useI18n();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLElement>(null);
  const [hostMode, setHostMode] = useState<HostMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ code: FeedbackCode; error: boolean; message: string } | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    if (!teamOpen) return;
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') setTeamOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [teamOpen]);

  const showHost = () => {
    setTeamOpen(false);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  async function submitHost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFeedback(null);
    setPending(true);
    const operation = hostMode;
    try {
      if (hostMode === 'recover') {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setFeedback({ code: 'AUTH_RECOVERY_SENT', error: false, message: t('stitch.auth.recoverySent') });
      } else if (hostMode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setFeedback({ code: 'AUTH_REGISTERED', error: false, message: t('stitch.auth.registered') });
        if (data.session) navigate('/host');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/host');
      }
    } catch (error) {
      setFeedback({ code: operation === 'login' ? 'AUTH_SIGN_IN_FAILED' : operation === 'register' ? 'AUTH_SIGN_UP_FAILED' : 'AUTH_RECOVERY_FAILED', error: true, message: error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' ? error.message : t('stitch.auth.failed') });
    } finally {
      setPending(false);
    }
  }

  const features = [
    { Icon: CalendarDays, title: 'stitch.feature1.title', description: 'stitch.feature1.desc' },
    { Icon: PlayCircle, title: 'stitch.feature2.title', description: 'stitch.feature2.desc' },
    { Icon: BarChart3, title: 'stitch.feature3.title', description: 'stitch.feature3.desc' },
    { Icon: Users, title: 'stitch.feature4.title', description: 'stitch.feature4.desc' },
  ] as const;
  const glassField = 'stitch-field w-full rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none';

  return (
    <div data-testid="stitch-landing" className="stitch-root min-h-screen relative overflow-x-clip text-slate-100">
      <div className="stitch-bokeh stitch-bokeh-amber" aria-hidden="true" />
      <div className="stitch-bokeh stitch-bokeh-purple" aria-hidden="true" />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#06080f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1536px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-12">
          <Link to="/" data-testid="landing-logo" aria-label="QuiziciuS" className="flex items-center gap-2 font-black tracking-tight text-2xl"><span className="stitch-brand-icon"><Crown className="h-5 w-5 text-amber-400" /></span><span>Quiziciu<span className="text-purple-400">S</span></span></Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <button data-testid="stitch-language-toggle" type="button" aria-expanded={langOpen} onClick={() => setLangOpen(v => !v)} className="stitch-secondary px-3 py-2 text-sm">{locale === 'sk' ? '🇸🇰 SK' : '🇬🇧 EN'} <span aria-hidden="true">⌄</span></button>
              {langOpen && <div className="absolute right-0 mt-2 w-36 rounded-xl border border-white/15 bg-[#121628] p-1 shadow-xl">
                {(['sk','en'] as const).map(lang => <button key={lang} data-testid={`locale-${lang}`} onClick={() => { setLocale(lang); setLangOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10">{lang === 'sk' ? '🇸🇰 Slovenčina' : '🇬🇧 English'}</button>)}
              </div>}
            </div>
            <button data-testid="landing-team-entry" type="button" onClick={() => setTeamOpen(true)} className="stitch-secondary px-3 py-2 text-sm">{t('stitch.nav.teams')}</button>
            <button data-testid="landing-host-entry" type="button" onClick={showHost} className="stitch-primary px-3 py-2 text-sm"><Crown size={16} className="inline text-amber-200" /> {t('stitch.nav.hosts')}</button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1536px] items-center gap-10 px-5 py-8 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-12 lg:py-12">
        <section className="lg:col-span-7">
          <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl xl:text-6xl">{t('stitch.hero.title')} <span className="stitch-highlight">{t('stitch.hero.highlight')}</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">{t('stitch.hero.subtitle')}</p>
          <div className="mt-9 max-w-xl space-y-5">
            {features.map(({ Icon, title, description }) => <div key={title} className="flex items-start gap-4">
              <div className="stitch-feature-icon"><Icon size={21} /></div><div><h2 className="font-bold">{t(title)}</h2><p className="mt-1 text-sm leading-snug text-slate-400">{t(description)}</p></div>
            </div>)}
          </div>
          {/* Source file contains a fictional testimonial. Intentionally excluded until verified. */}
        </section>

        <section ref={cardRef} data-testid="stitch-host-auth" className="stitch-card relative lg:col-span-5 w-full max-w-[500px] justify-self-center rounded-3xl p-6 sm:p-8 lg:justify-self-end">
          <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-[#06080f]/70 p-1">
            <button data-testid="host-login-tab" type="button" className={`stitch-tab ${hostMode === 'login' ? 'stitch-tab-active' : ''}`} onClick={() => { setHostMode('login');setFeedback(null); }}>{t('stitch.auth.loginTab')}</button>
            <button data-testid="host-register-tab" type="button" className={`stitch-tab ${hostMode === 'register' ? 'stitch-tab-active' : ''}`} onClick={() => { setHostMode('register');setFeedback(null); }}>{t('stitch.auth.registerTab')}</button>
          </div>
          <div className="mb-7 mt-7 text-center">
            <div className="stitch-crown"><Crown size={30} /></div>
            <h2 className="mt-4 text-xl font-extrabold sm:text-2xl">{t(hostMode === 'recover' ? 'stitch.auth.recoveryTitle' : hostMode === 'login' ? 'stitch.auth.loginTitle' : 'stitch.auth.registerTitle')}</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">{t(hostMode === 'recover' ? 'stitch.auth.recoveryDescription' : hostMode === 'login' ? 'stitch.auth.loginDescription' : 'stitch.auth.registerDescription')}</p>
          </div>
          <form data-testid="host-auth-form" onSubmit={submitHost} className="space-y-4">
            <label className="block text-xs font-semibold text-slate-300">{t('stitch.auth.email')}<span className="relative mt-2 block"><Mail className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" /><input data-testid="host-email" className={glassField} type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></span></label>
            {hostMode !== 'recover' && <label className="block text-xs font-semibold text-slate-300">{t('stitch.auth.password')}<span className="relative mt-2 block"><Lock className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" /><input data-testid="host-password" className={glassField + ' pr-12'} type={showPassword ? 'text' : 'password'} autoComplete={hostMode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} /><button type="button" data-testid="host-password-visibility" aria-label={t('stitch.auth.togglePassword')} className="absolute right-3 top-3 p-1 text-slate-400" onClick={() => setShowPassword(v=>!v)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
            {hostMode === 'login' && <div className="flex items-center justify-end text-xs"><button data-testid="host-forgot-password" type="button" className="text-purple-400 hover:text-purple-300" onClick={() => {setHostMode('recover');setFeedback(null);}}>{t('stitch.auth.forgot')}</button></div>}
            {feedback && <p data-testid="host-auth-feedback" data-feedback-code={feedback.code} role={feedback.error ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-xs ${feedback.error ? 'border-red-500/40 text-red-300' : 'border-emerald-500/40 text-emerald-300'}`}>{feedback.message}</p>}
            <button data-testid="host-auth-submit" type="submit" disabled={pending} className="stitch-primary w-full py-3 font-bold disabled:opacity-50">{pending ? t('stitch.auth.pending') : t(hostMode === 'recover' ? 'stitch.auth.recoverButton' : hostMode === 'register' ? 'stitch.auth.registerButton' : 'stitch.auth.loginButton')} →</button>
          </form>
          <div className="my-6 border-t border-white/10" />
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0d17]/80 p-3">
            <div className="flex items-center gap-3"><Users size={20} className="text-purple-400"/><div><p className="text-xs font-bold">{t('stitch.teamBanner.title')}</p><p className="text-xs text-slate-400">{t('stitch.teamBanner.desc')}</p></div></div>
            <button data-testid="host-to-team" type="button" onClick={() => setTeamOpen(true)} className="stitch-secondary shrink-0 px-3 py-2 text-xs">{t('stitch.teamBanner.button')} →</button>
          </div>
        </section>
      </main>
      {teamOpen && <TeamDialog onClose={() => setTeamOpen(false)} onHost={showHost} />}
    </div>
  );
}
