import { forwardRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Crown, Eye, EyeOff, Info, Lock, Mail, Users } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase-client';
import { FieldLabel, FormNotice, IconInput, primaryButtonClass } from '../ui/form';
import { Pending } from '../ui/Pending';

/** Host accounts are created by a super admin, so the card only signs in and recovers passwords. */
type Mode = 'login' | 'recover';
type Notice = { tone: 'error' | 'success'; text: string };

const COPY = {
  login: { title: 'landing.auth.loginTitle', subtitle: 'landing.auth.loginSubtitle', submit: 'landing.auth.loginSubmit' },
  recover: { title: 'landing.auth.recoverTitle', subtitle: 'landing.auth.recoverSubtitle', submit: 'landing.auth.recoverSubmit' },
} as const;

export const HostAuthCard = forwardRef<HTMLDivElement, { highlighted: boolean; onOpenTeamEntry: () => void }>(function HostAuthCard(
  { highlighted, onOpenTeamEntry },
  ref,
) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const copy = COPY[mode];

  function switchMode(next: Mode) {
    setMode(next);
    setNotice(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/host');
      } else {
        // The link signs the user in on /host, where the set-password screen takes over.
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/host` });
        if (error) throw error;
        setNotice({ tone: 'success', text: t('landing.auth.recoverSent') });
      }
    } catch (error) {
      setNotice({ tone: 'error', text: describeError(error, t, 'errors.generic') });
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      ref={ref}
      data-testid="host-auth-card"
      className={`glass-card relative w-full max-w-[470px] rounded-3xl border-white/15 p-6 shadow-2xl transition sm:p-8 ${
        highlighted ? 'ring-2 ring-purple-500' : ''
      }`}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-purple-600/30 blur-3xl" />

      <div className="mb-6 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-glow-gold">
          <Crown className="h-8 w-8 fill-amber-400 text-amber-400 drop-shadow" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{t(copy.title)}</h2>
        <p className="mx-auto mt-1 max-w-xs text-xs text-slate-400 sm:text-sm">{t(copy.subtitle)}</p>
      </div>

      <form className="space-y-4" onSubmit={submit} data-testid="host-auth-form">
        <FieldLabel label={t('landing.auth.email')}>
          <IconInput
            icon={Mail}
            data-testid="host-email"
            type="email"
            autoComplete="email"
            placeholder={t('landing.auth.emailPlaceholder')}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FieldLabel>

        {mode !== 'recover' && (
          <FieldLabel label={t('landing.auth.password')}>
            <IconInput
              icon={Lock}
              data-testid="host-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('landing.auth.passwordPlaceholder')}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              trailing={
                <button
                  type="button"
                  aria-label={t('landing.auth.togglePassword')}
                  className="text-slate-400 transition hover:text-white"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </FieldLabel>
        )}

        {mode === 'login' && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <Pending feature="remember-me" badge="inline">
              <label className="flex select-none items-center gap-2">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded accent-brand-600" />
                <span className="font-medium text-slate-300">{t('landing.auth.rememberMe')}</span>
              </label>
            </Pending>
            <button
              type="button"
              data-testid="host-forgot-password"
              className="font-medium text-purple-400 transition hover:text-purple-300"
              onClick={() => switchMode('recover')}
            >
              {t('landing.auth.forgotPassword')}
            </button>
          </div>
        )}

        {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}

        {mode === 'login' && (
          <p
            className="flex items-start gap-2 rounded-xl border border-white/10 bg-dark-900/60 p-3 text-xs text-slate-400"
            data-testid="host-invite-only"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
            {t('landing.auth.inviteOnly')}
          </p>
        )}

        <button type="submit" data-testid="host-auth-submit" disabled={pending} className={`${primaryButtonClass} mt-2`}>
          {pending ? t('common.working') : t(copy.submit)}
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {mode === 'recover' && (
          <button
            type="button"
            className="block w-full text-center text-xs font-medium text-purple-400 hover:text-purple-300"
            onClick={() => switchMode('login')}
          >
            {t('landing.auth.backToLogin')}
          </button>
        )}
      </form>

      {mode !== 'recover' && (
        <>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-dark-850 px-3 font-semibold uppercase tracking-wider text-slate-400">{t('landing.auth.or')}</span>
            </div>
          </div>
          <Pending feature="social-login" className="space-y-2.5">
            <SocialButton provider="google" label={t('landing.auth.google')} />
            <SocialButton provider="microsoft" label={t('landing.auth.microsoft')} />
          </Pending>
        </>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-dark-900/90 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-900/40">
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold leading-tight text-white">{t('landing.teamBanner.title')}</h3>
            <p className="text-[11px] leading-tight text-slate-400">{t('landing.teamBanner.subtitle')}</p>
          </div>
        </div>
        <button
          type="button"
          data-testid="host-card-team-entry"
          onClick={onOpenTeamEntry}
          className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-purple-500/30 bg-dark-800 px-3 py-1.5 text-xs font-semibold text-purple-300 transition hover:bg-dark-700 hover:text-white"
        >
          {t('landing.teamBanner.button')}
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});

function SocialButton({ provider, label }: { provider: 'google' | 'microsoft'; label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-dark-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-dark-700/80 sm:text-sm"
    >
      {provider === 'google' ? (
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            fill="#EA4335"
          />
        </svg>
      ) : (
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 21 21">
          <rect fill="#f25022" height="9" width="9" x="1" y="1" />
          <rect fill="#7fba00" height="9" width="9" x="11" y="1" />
          <rect fill="#00a4ef" height="9" width="9" x="1" y="11" />
          <rect fill="#ffb900" height="9" width="9" x="11" y="11" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
