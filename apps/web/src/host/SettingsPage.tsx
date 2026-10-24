import { useState, type FormEvent } from 'react';
import { Settings } from 'lucide-react';
import type { AccountDto } from '@quizicius/shared-types';
import { apiPatch } from '../lib/api-client';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { formatDay } from '../lib/subscription';
import { btn, Card, ErrorBanner, inputClass, Label, useToast } from './ui';

/** Accounts start with the e-mail as their name; only a name the host set counts as one. */
export function ownName(account: AccountDto): string | null {
  return account.displayName !== account.email ? account.displayName : null;
}

/** The host's own account: the name shown instead of the e-mail, and the subscription. */
export function SettingsPage({ token, account, onSaved }: { token: string; account: AccountDto; onSaved: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(ownName(account) ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscription = account.subscription;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPatch<AccountDto>('/me', { displayName: name.trim() }, token);
      toast(t('host.settings.saved'));
      onSaved();
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-space-lg" data-testid="host-settings">
      <div className="flex items-center gap-space-sm py-space-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container/20 text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-headline-lg tracking-tight text-on-surface">{t('host.nav.settings')}</h1>
          <p className="text-body-md text-on-surface-variant">{t('host.settings.subtitle')}</p>
        </div>
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card>
        <form className="flex flex-col gap-space-md" onSubmit={(event) => void save(event)}>
          <div>
            <Label htmlFor="settings-name">{t('host.settings.name')}</Label>
            <input
              id="settings-name"
              data-testid="settings-name"
              className={inputClass}
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('host.settings.namePlaceholder')}
            />
            <p className="mt-1 text-body-sm text-on-surface-variant">{t('host.settings.nameHint')}</p>
          </div>
          <div>
            <Label>{t('host.settings.email')}</Label>
            <p className="text-body-md text-on-surface" data-testid="settings-email">
              {account.email ?? '—'}
            </p>
          </div>
          <div className="flex justify-end">
            <button type="submit" className={btn.primary} disabled={busy} data-testid="settings-save">
              {t('host.editor.save')}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col gap-space-xs" data-testid="settings-subscription">
          <Label>{t('host.settings.subscription')}</Label>
          <p className="text-body-md text-on-surface">
            {t(`account.role.${account.role}`)}
            {subscription &&
              ` · ${
                subscription.status === 'FOREVER'
                  ? t('account.subscription.FOREVER')
                  : subscription.until
                    ? `${t(`account.subscription.${subscription.status}`)} ${formatDay(subscription.until, locale)}`
                    : t('account.subscription.EXPIRED')
              }`}
          </p>
          <p className="text-body-sm text-on-surface-variant">{t('host.settings.subscriptionHint')}</p>
        </div>
      </Card>
    </div>
  );
}
