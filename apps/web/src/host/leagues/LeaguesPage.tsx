import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, MailOpen, Plus, Trophy, Users, X } from 'lucide-react';
import type { HostLeagueDto, InvitableHostDto, LeagueSummaryDto } from '@quizicius/shared-types';
import { describeError } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { pubLabel } from '../../lib/pubs';
import { Modal } from '../../ui/Modal';
import { useHostPubs } from '../pubs';
import { btn, Card, ErrorBanner, inputClass, Label, useToast } from '../ui';
import { leaguesApi } from './api';
import { useDay } from './StandingsTable';

const PHASE_STYLE: Record<LeagueSummaryDto['phase'], string> = {
  PREPARING: 'bg-secondary-container/30 text-secondary',
  RUNNING: 'bg-tertiary-container/20 text-tertiary',
  CLOSED: 'bg-surface-container-high text-on-surface-variant',
};

export function PhaseBadge({ league }: { league: Pick<LeagueSummaryDto, 'phase' | 'kind'> }) {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap gap-1">
      <span className={`rounded px-1.5 py-0.5 text-label-sm ${PHASE_STYLE[league.phase]}`}>{t(`leagues.phase.${league.phase}`)}</span>
      {league.kind === 'SUPER' && (
        <span className="rounded bg-secondary-container/30 px-1.5 py-0.5 text-label-sm text-secondary">{t('leagues.kind.SUPER')}</span>
      )}
    </span>
  );
}

/** Name, dates, pubs and message of a league, as on cards and invitations. */
export function LeagueFacts({ league }: { league: LeagueSummaryDto }) {
  const { t } = useI18n();
  const day = useDay();
  return (
    <div className="flex flex-col gap-1 text-body-sm text-on-surface-variant">
      <span className="flex items-center gap-space-xs">
        <CalendarDays className="h-4 w-4" />
        {t('leagues.from')} {day(league.startsOn)}
        {league.endsOn && ` ${t('leagues.until')} ${day(league.endsOn)}`}
      </span>
      <span>{league.pubs.map((pub) => pubLabel(pub)).join(' + ')}</span>
      {league.message && <span className="italic">„{league.message}“</span>}
    </div>
  );
}

/** /host/leagues — my leagues, invitations from other hosts, and proposing a new league. */
export function LeaguesPage({ token }: { token: string }) {
  const { t } = useI18n();
  const [leagues, setLeagues] = useState<HostLeagueDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    leaguesApi
      .list(token)
      .then((rows) => {
        setLeagues(rows);
        setError(null);
      })
      .catch(setError);
  }, [token]);
  useEffect(load, [load]);

  const invitations = (leagues ?? []).filter((league) => league.myStatus === 'INVITED');
  const mine = (leagues ?? []).filter((league) => league.myStatus === 'ACCEPTED');

  return (
    <div className="flex w-full flex-col gap-space-lg" data-testid="leagues-page">
      <div className="flex flex-wrap items-center justify-between gap-space-md py-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container/20 text-secondary">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-headline-lg tracking-tight text-on-surface">{t('leagues.title')}</h1>
            <p className="text-body-md text-on-surface-variant">{t('leagues.subtitle')}</p>
          </div>
        </div>
        <button type="button" className={btn.primary} onClick={() => setCreating(true)} data-testid="league-new">
          <Plus className="h-5 w-5" />
          {t('leagues.new')}
        </button>
      </div>

      {error !== null && <ErrorBanner>{describeError(error, t, 'errors.generic')}</ErrorBanner>}

      {invitations.length > 0 && (
        <section className="flex flex-col gap-space-sm">
          <h2 className="text-headline-sm text-on-surface">{t('leagues.invitations')}</h2>
          {invitations.map((league) => (
            <HostInvitation key={league.id} token={token} league={league} onDone={load} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-space-sm">
        <h2 className="text-headline-sm text-on-surface">{t('leagues.mine')}</h2>
        {leagues !== null && mine.length === 0 && <p className="text-body-md text-on-surface-variant">{t('leagues.empty')}</p>}
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 xl:grid-cols-3">
          {mine.map((league) => (
            <Link
              key={league.id}
              to={`/host/leagues/${league.id}`}
              data-testid={`league-card-${league.id}`}
              className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-md transition-colors hover:bg-surface-container"
            >
              <PhaseBadge league={league} />
              <h3 className="text-headline-sm text-on-surface">{league.name}</h3>
              <LeagueFacts league={league} />
              <div className="flex gap-space-md text-label-md text-on-surface">
                <span>
                  {t('leagues.nights')}: {league.nightsPlayed}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {league.joinedTeams}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {creating && <NewLeagueDialog token={token} onClose={() => setCreating(false)} />}
    </div>
  );
}

function HostInvitation({ token, league, onDone }: { token: string; league: HostLeagueDto; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const { pubs } = useHostPubs(token);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pubIds = picked ?? pubs.map((pub) => pub.id);

  async function answer(accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (accept) await leaguesApi.accept(token, league.id, pubIds);
      else await leaguesApi.decline(token, league.id);
      toast(t(accept ? 'leagues.accepted' : 'leagues.declined'));
      onDone();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-space-sm border border-secondary/40" testId={`league-invite-${league.id}`}>
      <div className="flex items-center gap-space-xs text-label-sm uppercase text-secondary">
        <MailOpen className="h-4 w-4" />
        {t('leagues.proposedBy')} {league.ownerName}
      </div>
      <h3 className="text-headline-sm text-on-surface">{league.name}</h3>
      <LeagueFacts league={league} />
      {pubs.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-label-sm uppercase tracking-wider text-on-surface-variant">{t('leagues.acceptPubs')}</legend>
          {pubs.map((pub) => (
            <label key={pub.id} className="flex items-center gap-space-xs text-body-sm text-on-surface">
              <input
                type="checkbox"
                checked={pubIds.includes(pub.id)}
                onChange={(event) => setPicked(event.target.checked ? [...pubIds, pub.id] : pubIds.filter((id) => id !== pub.id))}
              />
              {pubLabel(pub)}
            </label>
          ))}
        </fieldset>
      )}
      {error !== null && <ErrorBanner>{describeError(error, t, 'errors.generic')}</ErrorBanner>}
      <div className="flex gap-space-sm">
        <button
          type="button"
          className={btn.primary}
          disabled={busy || pubIds.length === 0}
          onClick={() => void answer(true)}
          data-testid={`league-accept-${league.id}`}
        >
          <Check className="h-4 w-4" />
          {t('leagues.accept')}
        </button>
        <button
          type="button"
          className={btn.secondary}
          disabled={busy}
          onClick={() => void answer(false)}
          data-testid={`league-decline-${league.id}`}
        >
          <X className="h-4 w-4" />
          {t('leagues.decline')}
        </button>
      </div>
    </Card>
  );
}

function NewLeagueDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { pubs, loading: pubsLoading } = useHostPubs(token);
  const [hosts, setHosts] = useState<InvitableHostDto[]>([]);
  const [form, setForm] = useState({ name: '', startsOn: '', endsOn: '', message: '' });
  const [pubIds, setPubIds] = useState<string[] | null>(null);
  const [hostIds, setHostIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const chosenPubs = pubIds ?? pubs.map((pub) => pub.id);

  useEffect(() => {
    leaguesApi.invitableHosts(token).then(setHosts, () => setHosts([]));
  }, [token]);

  const valid = form.name.trim().length >= 3 && form.startsOn !== '' && chosenPubs.length > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const league = await leaguesApi.create(token, {
        name: form.name.trim(),
        pubIds: chosenPubs,
        startsOn: form.startsOn,
        endsOn: form.endsOn || null,
        message: form.message.trim(),
        inviteHostIds: hostIds,
      });
      toast(t('leagues.form.created'));
      navigate(`/host/leagues/${league.id}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  return (
    <Modal tone="surface" labelledBy="new-league-title" onClose={onClose} className="max-w-xl" testId="new-league-dialog">
      <form className="flex flex-col gap-space-md" onSubmit={(event) => void submit(event)}>
        <h3 id="new-league-title" className="text-headline-sm text-on-surface">
          {t('leagues.form.title')}
        </h3>
        <div>
          <Label htmlFor="new-league-name">{t('leagues.form.name')}</Label>
          <input
            id="new-league-name"
            data-testid="new-league-name"
            className={inputClass}
            maxLength={60}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-label-sm uppercase tracking-wider text-on-surface-variant">{t('leagues.form.pubs')}</legend>
          {!pubsLoading && pubs.length === 0 && (
            <Link to="/host/pubs" className="text-body-sm text-primary hover:underline">
              {t('leagues.form.needPub')}
            </Link>
          )}
          {pubs.map((pub) => (
            <label key={pub.id} className="flex items-center gap-space-xs text-body-sm text-on-surface">
              <input type="checkbox" checked={chosenPubs.includes(pub.id)} onChange={() => setPubIds(toggle(chosenPubs, pub.id))} />
              {pubLabel(pub)}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <div>
            <Label htmlFor="new-league-starts">{t('leagues.form.starts')}</Label>
            <input
              id="new-league-starts"
              type="date"
              data-testid="new-league-starts"
              className={inputClass}
              value={form.startsOn}
              onChange={(event) => setForm({ ...form, startsOn: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="new-league-ends">{t('leagues.form.ends')}</Label>
            <input
              id="new-league-ends"
              type="date"
              data-testid="new-league-ends"
              className={inputClass}
              value={form.endsOn}
              onChange={(event) => setForm({ ...form, endsOn: event.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('leagues.form.hosts')}</span>
          {hosts.length === 0 && <span className="text-body-sm text-on-surface-variant">{t('leagues.form.noHosts')}</span>}
          <div className="flex flex-wrap gap-space-xs">
            {hosts.map((host) => {
              const on = hostIds.includes(host.id);
              return (
                <button
                  key={host.id}
                  type="button"
                  aria-pressed={on}
                  data-testid={`new-league-host-${host.id}`}
                  onClick={() => setHostIds(toggle(hostIds, host.id))}
                  className={`rounded-full px-space-sm py-1 text-label-md transition-colors ${
                    on ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {on && <Check className="mr-1 inline h-3.5 w-3.5" />}
                  {host.name}
                  {host.pubs.length > 0 && ` — ${host.pubs.map((pub) => pub.name).join(', ')}`}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label htmlFor="new-league-message">{t('leagues.form.message')}</Label>
          <textarea
            id="new-league-message"
            data-testid="new-league-message"
            className={`${inputClass} min-h-[80px]`}
            maxLength={500}
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
          />
        </div>
        <p className="text-body-sm text-on-surface-variant">{t('leagues.form.invitesNote')}</p>
        {error !== null && <ErrorBanner>{describeError(error, t, 'errors.generic')}</ErrorBanner>}
        <div className="flex justify-end gap-space-sm">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {t('host.common.cancel')}
          </button>
          <button type="submit" className={btn.primary} disabled={!valid || busy} data-testid="new-league-submit">
            {busy ? t('common.working') : t('leagues.form.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
