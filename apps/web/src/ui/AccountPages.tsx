import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, LogOut, ShieldAlert } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { clearPendingPasswordLink, supabase } from '../lib/supabase-client';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';

const fieldClass =
  'h-12 w-full rounded-xl bg-surface-container-lowest px-space-md text-body-md text-on-surface shadow-inner placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary';

function CenteredCard({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-container-lowest text-on-surface">
      <header className="flex items-center justify-between px-space-md py-space-md sm:px-space-lg">
        <Logo to="/" />
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-space-md pb-space-xl">
        <div
          className="w-full max-w-md rounded-3xl bg-surface-container-low/90 p-space-lg shadow-2xl backdrop-blur-xl sm:p-space-xl"
          data-testid={testId}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

/** After an invite or password-reset link: the user is signed in and must choose a password. */
export function SetPasswordPage({ kind, onDone }: { kind: 'invite' | 'recovery'; onDone: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= 8 && password === confirm;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(describeError(updateError, t, 'errors.generic'));
      setBusy(false);
      return;
    }
    clearPendingPasswordLink();
    onDone();
  }

  return (
    <CenteredCard testId="set-password">
      <div className="mb-space-md flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container/20 text-primary">
        <KeyRound className="h-7 w-7" />
      </div>
      <h1 className="text-headline-md text-on-surface">
        {t(kind === 'invite' ? 'account.password.inviteTitle' : 'account.password.resetTitle')}
      </h1>
      <p className="mt-space-xs text-body-md text-on-surface-variant">
        {t(kind === 'invite' ? 'account.password.inviteText' : 'account.password.resetText')}
      </p>
      <form className="mt-space-lg flex flex-col gap-space-md" onSubmit={(event) => void submit(event)}>
        <label className="flex flex-col gap-1.5">
          <span className="text-label-md text-on-surface">{t('account.password.new')}</span>
          <input
            type="password"
            autoComplete="new-password"
            data-testid="set-password-new"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
          />
          <span className="text-body-sm text-on-surface-variant">{t('account.password.rule')}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-label-md text-on-surface">{t('account.password.confirm')}</span>
          <input
            type="password"
            autoComplete="new-password"
            data-testid="set-password-confirm"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={fieldClass}
          />
          {mismatch && <span className="text-body-sm text-error">{t('account.password.mismatch')}</span>}
        </label>
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          data-testid="set-password-submit"
          disabled={busy || !valid}
          className="h-12 rounded-xl bg-primary-container text-label-lg font-bold text-on-primary-container shadow-md transition-all hover:brightness-110 disabled:opacity-50"
        >
          {busy ? t('common.working') : t('account.password.submit')}
        </button>
      </form>
    </CenteredCard>
  );
}

/** A signed-in captain opened /host: host accounts are created by us, not self-registered. */
export function NotHostPage({ email }: { email: string }) {
  const { t } = useI18n();
  return (
    <CenteredCard testId="not-host">
      <div className="mb-space-md flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-container/20 text-secondary">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="text-headline-md text-on-surface">{t('account.notHost.title')}</h1>
      <p className="mt-space-xs text-body-md text-on-surface-variant">{t('account.notHost.text')}</p>
      <p className="mt-space-sm truncate text-body-sm text-outline">{email}</p>
      <div className="mt-space-lg flex flex-col gap-space-sm sm:flex-row">
        <Link
          to="/team"
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-primary-container text-label-lg font-bold text-on-primary-container"
        >
          {t('account.notHost.toTeam')}
        </Link>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          data-testid="not-host-logout"
          className="flex h-12 flex-1 items-center justify-center gap-space-xs rounded-xl bg-surface-container-high text-label-lg text-on-surface hover:bg-surface-bright"
        >
          <LogOut className="h-5 w-5" />
          {t('host.nav.signOut')}
        </button>
      </div>
    </CenteredCard>
  );
}
