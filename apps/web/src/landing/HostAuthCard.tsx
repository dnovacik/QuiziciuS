import { forwardRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Crown, Eye, EyeOff, Info, Lock, Mail, Users } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase-client';
import { FieldLabel, FormNotice, IconInput, primaryButtonClass } from '../ui/form';
import { GOOGLE_AUTH, GoogleButton } from '../ui/GoogleButton';
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
  const location = useLocation();
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
        // A deep link into the host app (e.g. the phone remote) stays where it was opened.
        navigate(location.pathname.startsWith('/host/') ? location.pathname : '/host');
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

      {mode !== 'recover' && GOOGLE_AUTH && (
        <>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-dark-850 px-3 font-semibold uppercase tracking-wider text-slate-400">{t('landing.auth.or')}</span>
            </div>
          </div>
          <GoogleButton
            returnPath={location.pathname.startsWith('/host/') ? location.pathname : '/host'}
            onError={(text) => setNotice({ tone: 'error', text })}
          />
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
