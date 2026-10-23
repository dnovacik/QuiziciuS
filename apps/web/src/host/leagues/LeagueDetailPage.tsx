import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, Hourglass, Lock, Trophy } from 'lucide-react';
import type { LeagueDetailDto } from '@quizicius/shared-types';
import { describeError } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { btn, Card, ConfirmDialog, ErrorBanner, useToast } from '../ui';
import { leaguesApi } from './api';
import { LeagueFacts, PhaseBadge } from './LeaguesPage';
import { StandingsTable } from './StandingsTable';

/** /host/leagues/:leagueId — standings, hosts, closing the season and its Super League. */
export function LeagueDetailPage({ token }: { token: string }) {
  const { leagueId = '' } = useParams();
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [league, setLeague] = useState<LeagueDetailDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Another league (e.g. the Super League just created): never show the previous one meanwhile.
  useEffect(() => setLeague(null), [leagueId]);

  const load = useCallback(() => {
    leaguesApi
      .detail(token, leagueId)
      .then((row) => {
        setLeague(row);
        setError(null);
      })
      .catch(setError);
  }, [token, leagueId]);
  useEffect(load, [load]);

  async function close() {
    setBusy(true);
    try {
      setLeague(await leaguesApi.close(token, leagueId));
      toast(t('leagues.detail.closed'));
      setClosing(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function createSuperLeague() {
    setBusy(true);
    try {
      const created = await leaguesApi.createSuperLeague(token, leagueId);
      toast(t('leagues.detail.superCreated'));
      navigate(`/host/leagues/${created.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const closeButton = (
    <button type="button" className={btn.secondary} onClick={() => setClosing(true)} data-testid="league-close">
      <Lock className="h-4 w-4" />
      {t('leagues.detail.close')}
    </button>
  );

  return (
    <div className="flex w-full flex-col gap-space-lg" data-testid="league-detail">
      <Link to="/host/leagues" className="flex items-center gap-space-xs text-label-md text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="h-4 w-4" />
        {t('leagues.detail.back')}
      </Link>
      {error !== null && <ErrorBanner>{describeError(error, t, 'errors.generic')}</ErrorBanner>}
      {league && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-space-md">
            <div className="flex items-start gap-space-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container/20 text-secondary">
                {league.kind === 'SUPER' ? <Crown className="h-6 w-6" /> : <Trophy className="h-6 w-6" />}
              </div>
              <div className="flex flex-col gap-1">
                <PhaseBadge league={league} />
                <h1 className="text-headline-lg tracking-tight text-on-surface">{league.name}</h1>
                <LeagueFacts league={league} />
                {league.parentLeagueId && (
                  <Link to={`/host/leagues/${league.parentLeagueId}`} className="text-label-md text-primary hover:underline">
                    {t('leagues.detail.parent')}
                  </Link>
                )}
              </div>
            </div>
            {league.isOwner && league.phase !== 'CLOSED' && !league.endedAwaitingClose && closeButton}
          </div>

          {league.endedAwaitingClose && (
            <div
              className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-secondary-container/20 p-space-md text-secondary"
              data-testid="league-close-prompt"
            >
              <span className="flex items-center gap-space-sm text-body-md">
                <Hourglass className="h-5 w-5" />
                {t('leagues.detail.closePrompt')}
              </span>
              {closeButton}
            </div>
          )}

          <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
            <Card className="flex flex-col gap-space-md xl:col-span-8" testId="league-standings">
              <h2 className="text-headline-sm text-on-surface">{t('leagues.detail.standings')}</h2>
              <StandingsTable standings={league.standings} pubs={league.pubs} kind={league.kind} />
            </Card>
            <Card className="flex flex-col gap-space-sm xl:col-span-4" testId="league-hosts">
              <h2 className="text-headline-sm text-on-surface">{t('leagues.detail.hosts')}</h2>
              <ul className="flex flex-col gap-1 text-body-md">
                {league.hosts.map((host) => (
                  <li key={host.id} className="flex justify-between gap-space-sm">
                    <span className="text-on-surface">{host.name}</span>
                    <span className="text-on-surface-variant">{t(`leagues.detail.hostStatus.${host.status}`)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-body-sm text-on-surface-variant">
                {t('leagues.teams')}: {league.joinedTeams} · {t('leagues.nights')}: {league.nightsPlayed}
              </p>
            </Card>
          </div>

          {league.phase === 'CLOSED' && league.kind === 'LEAGUE' && (
            <Card className="flex flex-col gap-space-sm" testId="league-qualified">
              <h2 className="flex items-center gap-space-xs text-headline-sm text-on-surface">
                <Crown className="h-5 w-5 text-secondary" />
                {t('leagues.detail.qualified')}
              </h2>
              <ul className="flex flex-wrap gap-space-xs">
                {league.qualified.map((row) => (
                  <li
                    key={row.registeredTeamId}
                    className="rounded-full bg-surface-container-high px-space-sm py-1 text-label-md text-on-surface"
                  >
                    {row.teamName}
                  </li>
                ))}
              </ul>
              {league.superLeagueId ? (
                <Link to={`/host/leagues/${league.superLeagueId}`} className={`${btn.secondary} self-start`}>
                  {t('leagues.detail.openSuper')}
                </Link>
              ) : (
                league.isOwner && (
                  <button
                    type="button"
                    className={`${btn.primary} self-start`}
                    disabled={busy}
                    onClick={() => void createSuperLeague()}
                    data-testid="league-create-super"
                  >
                    <Crown className="h-4 w-4" />
                    {t('leagues.detail.createSuper')}
                  </button>
                )
              )}
            </Card>
          )}

          {closing && (
            <ConfirmDialog
              icon={Lock}
              title={t('leagues.detail.closeTitle')}
              text={t('leagues.detail.closeText')}
              confirmLabel={t('leagues.detail.close')}
              busy={busy}
              onConfirm={() => void close()}
              onClose={() => setClosing(false)}
              testId="league-close-dialog"
            />
          )}
        </>
      )}
    </div>
  );
}
