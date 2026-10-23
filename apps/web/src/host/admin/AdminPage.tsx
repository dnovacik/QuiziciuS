import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CalendarPlus,
  Check,
  Infinity as InfinityIcon,
  MailPlus,
  Pencil,
  Power,
  PowerOff,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { AccountDto, AccountRole, SubscriptionStatus } from '@quizicius/shared-types';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api-client';
import { describeError } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { formatDay } from '../../lib/subscription';
import { btn, Card, ConfirmDialog, ErrorBanner, inputClass, Label, useToast } from '../ui';

export interface AdminHost extends AccountDto {
  createdAt: string;
  quizCount: number;
  sessionCount: number;
  lastSessionAt: string | null;
}

export interface AdminTeam {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  createdAt: string;
  captainEmail: string | null;
  pubs: { id: string; name: string; city: string; primary: boolean }[];
  legacyHomePub: string | null;
}

export const adminApi = {
  hosts: (token: string) => apiGet<AdminHost[]>('/admin/hosts', token),
  inviteHost: (token: string, email: string, displayName: string) =>
    apiPost<{ account: AccountDto; invited: boolean }>(
      '/admin/hosts',
      { email: email.trim(), displayName: displayName.trim() || undefined },
      token,
    ),
  setHostActive: (token: string, hostId: string, active: boolean) => apiPatch<AccountDto>(`/admin/hosts/${hostId}`, { active }, token),
  setSubscription: (token: string, hostId: string, change: { extendMonths: number } | { until: string } | { forever: boolean }) =>
    apiPatch<AccountDto>(`/admin/hosts/${hostId}/subscription`, change, token),
  teams: (token: string) => apiGet<AdminTeam[]>('/admin/teams', token),
  renameTeam: (token: string, teamId: string, name: string) => apiPatch(`/admin/teams/${teamId}`, { name: name.trim() }, token),
  deleteTeam: (token: string, teamId: string) => apiDelete<void>(`/admin/teams/${teamId}`, token),
};

const SUBSCRIPTION_STYLE: Record<SubscriptionStatus, string> = {
  FOREVER: 'bg-tertiary-container/20 text-tertiary',
  TRIAL: 'bg-secondary-container/30 text-secondary',
  ACTIVE: 'bg-tertiary-container/20 text-tertiary',
  EXPIRED: 'bg-error-container/40 text-on-error-container',
};

const ROLE_STYLE: Record<AccountRole, string> = {
  SUPER_ADMIN: 'bg-secondary-container/30 text-secondary',
  HOST: 'bg-primary-container/30 text-primary',
  TEAM_CAPTAIN: 'bg-surface-container-high text-on-surface-variant',
};

/** /host/admin — super admins create and deactivate hosts and moderate self-registered teams. */
export function AdminPage({ token }: { token: string }) {
  const { t } = useI18n();
  return (
    <div className="flex w-full flex-col gap-space-lg" data-testid="admin-page">
      <div className="flex items-center gap-space-sm py-space-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container/20 text-secondary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-headline-lg tracking-tight text-on-surface">{t('host.nav.admin')}</h1>
          <p className="text-body-md text-on-surface-variant">{t('admin.subtitle')}</p>
        </div>
      </div>
      <HostsSection token={token} />
      <TeamsSection token={token} />
    </div>
  );
}

function useDate() {
  const { locale } = useI18n();
  return (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB', { dateStyle: 'medium' }) : '—';
}

function HostsSection({ token }: { token: string }) {
  const { t, plural, locale } = useI18n();
  const toast = useToast();
  const date = useDate();
  const [hosts, setHosts] = useState<AdminHost[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<AdminHost | null>(null);
  const [untilDraft, setUntilDraft] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    adminApi
      .hosts(token)
      .then((rows) => {
        setHosts(rows);
        setError(null);
      })
      .catch(setError);
  }, [token]);
  useEffect(load, [load]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await adminApi.inviteHost(token, email, name);
      toast(t(result.invited ? 'admin.hosts.invited' : 'admin.hosts.promoted'));
      setEmail('');
      setName('');
      load();
    } catch (err) {
      setFormError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(host: AdminHost) {
    setBusy(true);
    try {
      await adminApi.setHostActive(token, host.id, host.deactivated);
      toast(t(host.deactivated ? 'admin.hosts.reactivated' : 'admin.hosts.deactivatedToast'));
      setToggling(null);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function changeSubscription(host: AdminHost, change: { extendMonths: number } | { until: string } | { forever: boolean }) {
    setBusy(true);
    try {
      await adminApi.setSubscription(token, host.id, change);
      toast(t('admin.subscription.saved'));
      setUntilDraft((drafts) => ({ ...drafts, [host.id]: '' }));
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
      <Card className="flex flex-col gap-space-md xl:col-span-8" testId="admin-hosts">
        <div className="flex items-center justify-between gap-space-sm">
          <h2 className="text-headline-sm text-on-surface">{t('admin.hosts.title')}</h2>
          <span className="text-label-sm text-on-surface-variant">
            {hosts.length} {plural('count.hosts', hosts.length)}
          </span>
        </div>
        {error !== null && <ErrorBanner>{describeError(error, t, 'errors.generic')}</ErrorBanner>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm text-on-surface">
            <thead className="bg-surface-container text-label-sm uppercase text-on-surface-variant">
              <tr>
                <th className="rounded-l-lg p-space-sm">{t('admin.hosts.account')}</th>
                <th className="p-space-sm">{t('admin.subscription.title')}</th>
                <th className="p-space-sm">{t('admin.hosts.activity')}</th>
                <th className="p-space-sm">{t('admin.hosts.lastNight')}</th>
                <th className="rounded-r-lg p-space-sm text-right" />
              </tr>
            </thead>
            <tbody>
              {hosts.map((host) => (
                <tr
                  key={host.id}
                  className="align-middle transition-colors hover:bg-surface-container/40"
                  data-testid={`admin-host-${host.id}`}
                >
                  <td className="p-space-sm">
                    <div className="flex flex-col">
                      <span className="text-label-md">{host.displayName}</span>
                      {host.displayName !== host.email && <span className="text-on-surface-variant">{host.email}</span>}
                      <span className="mt-1 flex flex-wrap gap-1">
                        <span className={`rounded px-1.5 py-0.5 text-label-sm ${ROLE_STYLE[host.role]}`}>
                          {t(`account.role.${host.role}`)}
                        </span>
                        {host.deactivated && (
                          <span className="rounded bg-error-container/40 px-1.5 py-0.5 text-label-sm text-on-error-container">
                            {t('admin.hosts.deactivated')}
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="p-space-sm" data-testid={`admin-host-subscription-${host.id}`}>
                    {host.subscription && (
                      <div className="flex flex-col items-start gap-1">
                        <span className={`rounded px-1.5 py-0.5 text-label-sm ${SUBSCRIPTION_STYLE[host.subscription.status]}`}>
                          {host.subscription.status === 'FOREVER'
                            ? t('account.subscription.FOREVER')
                            : host.subscription.until
                              ? `${t(`account.subscription.${host.subscription.status}`)} ${formatDay(host.subscription.until, locale)}`
                              : t('account.subscription.EXPIRED')}
                        </span>
                        {host.role === 'HOST' && (
                          <div className="flex flex-wrap items-center gap-1">
                            {!host.subscription.forever && (
                              <>
                                <button
                                  type="button"
                                  className={`${btn.secondary} px-2 py-1 text-label-sm`}
                                  disabled={busy}
                                  data-testid={`admin-host-extend-${host.id}`}
                                  onClick={() => void changeSubscription(host, { extendMonths: 1 })}
                                >
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                  {t('admin.subscription.extendMonth')}
                                </button>
                                <form
                                  className="flex items-center gap-1"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const until = untilDraft[host.id];
                                    if (until) void changeSubscription(host, { until });
                                  }}
                                >
                                  <input
                                    type="date"
                                    aria-label={t('admin.subscription.until')}
                                    data-testid={`admin-host-until-${host.id}`}
                                    className={`${inputClass} w-auto px-2 py-1 text-label-sm`}
                                    value={untilDraft[host.id] ?? ''}
                                    onChange={(event) => setUntilDraft((drafts) => ({ ...drafts, [host.id]: event.target.value }))}
                                  />
                                  <button
                                    type="submit"
                                    className={btn.icon}
                                    disabled={busy || !untilDraft[host.id]}
                                    aria-label={t('admin.subscription.setUntil')}
                                    data-testid={`admin-host-until-save-${host.id}`}
                                  >
                                    <Check className="h-4 w-4 text-tertiary" />
                                  </button>
                                </form>
                              </>
                            )}
                            <button
                              type="button"
                              className={`${btn.secondary} px-2 py-1 text-label-sm`}
                              disabled={busy}
                              aria-pressed={host.subscription.forever}
                              data-testid={`admin-host-forever-${host.id}`}
                              onClick={() => void changeSubscription(host, { forever: !host.subscription!.forever })}
                            >
                              <InfinityIcon className="h-3.5 w-3.5" />
                              {t(host.subscription.forever ? 'admin.subscription.foreverOff' : 'admin.subscription.foreverOn')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-space-sm text-on-surface-variant">
                    {host.quizCount} {plural('count.quizzes', host.quizCount)} • {host.sessionCount}{' '}
                    {plural('count.nights', host.sessionCount)}
                  </td>
                  <td className="p-space-sm text-on-surface-variant">{date(host.lastSessionAt)}</td>
                  <td className="p-space-sm text-right">
                    {host.role === 'HOST' && (
                      <button
                        type="button"
                        className={`${btn.secondary} py-1.5`}
                        data-testid={`admin-host-toggle-${host.id}`}
                        onClick={() => setToggling(host)}
                      >
                        {host.deactivated ? <Power className="h-4 w-4 text-tertiary" /> : <PowerOff className="h-4 w-4 text-error" />}
                        {t(host.deactivated ? 'admin.hosts.reactivate' : 'admin.hosts.deactivate')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="flex flex-col gap-space-md xl:col-span-4" testId="admin-invite">
        <div className="flex items-center gap-space-sm">
          <MailPlus className="h-5 w-5 text-primary" />
          <h2 className="text-headline-sm text-on-surface">{t('admin.invite.title')}</h2>
        </div>
        <p className="text-body-sm text-on-surface-variant">{t('admin.invite.text')}</p>
        <form className="flex flex-col gap-space-md" onSubmit={(event) => void invite(event)}>
          <div>
            <Label htmlFor="invite-email">{t('admin.invite.email')}</Label>
            <input
              id="invite-email"
              type="email"
              required
              data-testid="invite-email"
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invite-name">{t('admin.invite.name')}</Label>
            <input
              id="invite-name"
              data-testid="invite-name"
              maxLength={80}
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {formError && (
            <p role="alert" className="text-body-sm text-error">
              {formError}
            </p>
          )}
          <button type="submit" className={btn.primary} disabled={busy || !email.trim()} data-testid="invite-submit">
            {busy ? t('common.working') : t('admin.invite.submit')}
          </button>
        </form>
      </Card>

      {toggling && (
        <ConfirmDialog
          icon={toggling.deactivated ? Power : PowerOff}
          tone={toggling.deactivated ? 'success' : 'danger'}
          title={t(toggling.deactivated ? 'admin.hosts.reactivateTitle' : 'admin.hosts.deactivateTitle')}
          text={
            <>
              <strong className="text-on-surface">{toggling.displayName}</strong> —{' '}
              {t(toggling.deactivated ? 'admin.hosts.reactivateText' : 'admin.hosts.deactivateText')}
            </>
          }
          confirmLabel={t(toggling.deactivated ? 'admin.hosts.reactivate' : 'admin.hosts.deactivate')}
          busy={busy}
          onConfirm={() => void toggle(toggling)}
          onClose={() => setToggling(null)}
          testId="admin-host-toggle-dialog"
        />
      )}
    </div>
  );
}

function TeamsSection({ token }: { token: string }) {
  const { t, plural } = useI18n();
  const toast = useToast();
  const date = useDate();
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<AdminTeam | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi
      .teams(token)
      .then((rows) => {
        setTeams(rows);
        setError(null);
      })
      .catch(setError);
  }, [token]);
  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast(message);
      setRenaming(null);
      setDeleting(null);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-space-md" testId="admin-teams">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-headline-sm text-on-surface">{t('admin.teams.title')}</h2>
        </div>
        <span className="text-label-sm text-on-surface-variant">
          {teams.length} {plural('count.teams', teams.length)}
        </span>
      </div>
      <p className="text-body-sm text-on-surface-variant">{t('admin.teams.text')}</p>
      {error !== null && <ErrorBanner>{describeError(error, t, 'errors.generic')}</ErrorBanner>}
      {teams.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">{t('admin.teams.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm text-on-surface">
            <thead className="bg-surface-container text-label-sm uppercase text-on-surface-variant">
              <tr>
                <th className="rounded-l-lg p-space-sm">{t('admin.teams.name')}</th>
                <th className="p-space-sm">{t('admin.teams.pubs')}</th>
                <th className="p-space-sm">{t('admin.teams.captain')}</th>
                <th className="p-space-sm">{t('admin.teams.created')}</th>
                <th className="rounded-r-lg p-space-sm text-right" />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="transition-colors hover:bg-surface-container/40" data-testid={`admin-team-${team.id}`}>
                  <td className="p-space-sm">
                    {renaming?.id === team.id ? (
                      <form
                        className="flex items-center gap-space-xs"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (renaming.name.trim().length >= 3)
                            void run(() => adminApi.renameTeam(token, team.id, renaming.name), t('admin.teams.renamed'));
                        }}
                      >
                        <input
                          autoFocus
                          data-testid="admin-team-rename-input"
                          className={`${inputClass} py-1.5`}
                          maxLength={30}
                          value={renaming.name}
                          onChange={(event) => setRenaming({ id: team.id, name: event.target.value })}
                        />
                        <button type="submit" className={btn.icon} disabled={busy} aria-label={t('host.editor.save')}>
                          <Check className="h-4 w-4 text-tertiary" />
                        </button>
                        <button type="button" className={btn.icon} onClick={() => setRenaming(null)} aria-label={t('host.common.cancel')}>
                          <X className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <span className="text-label-md">{team.name}</span>
                    )}
                  </td>
                  <td className="p-space-sm" data-testid={`admin-team-pubs-${team.id}`}>
                    {team.pubs.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {team.pubs.map((pub) => (
                          <span
                            key={pub.id}
                            title={pub.primary ? t('admin.teams.primaryPub') : undefined}
                            className={`rounded px-1.5 py-0.5 text-label-sm ${
                              pub.primary
                                ? 'bg-primary-container/40 text-on-primary-container'
                                : 'bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            {pub.name}, {pub.city}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">
                        {team.legacyHomePub ? `${team.legacyHomePub} (${t('admin.teams.legacyPub')})` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="p-space-sm text-on-surface-variant">{team.captainEmail ?? '—'}</td>
                  <td className="p-space-sm text-on-surface-variant">{date(team.createdAt)}</td>
                  <td className="p-space-sm text-right">
                    <span className="inline-flex gap-1">
                      <button
                        type="button"
                        className={btn.icon}
                        aria-label={t('admin.teams.rename')}
                        data-testid={`admin-team-rename-${team.id}`}
                        onClick={() => setRenaming({ id: team.id, name: team.name })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={btn.icon}
                        aria-label={t('admin.teams.delete')}
                        data-testid={`admin-team-delete-${team.id}`}
                        onClick={() => setDeleting(team)}
                      >
                        <Trash2 className="h-4 w-4 text-error" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleting && (
        <ConfirmDialog
          icon={Trash2}
          tone="danger"
          title={t('admin.teams.deleteTitle')}
          text={
            <>
              <strong className="text-on-surface">{deleting.name}</strong> — {t('admin.teams.deleteText')}
            </>
          }
          confirmLabel={t('admin.teams.delete')}
          busy={busy}
          onConfirm={() => void run(() => adminApi.deleteTeam(token, deleting.id), t('admin.teams.deleted'))}
          onClose={() => setDeleting(null)}
          testId="admin-team-delete-dialog"
        />
      )}
    </Card>
  );
}
