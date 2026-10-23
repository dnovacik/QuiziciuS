import { useCallback, useEffect, useState } from 'react';
import { Check, MailOpen, Trophy, X } from 'lucide-react';
import type { TeamLeagueDto } from '@quizicius/shared-types';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { LeagueFacts, PhaseBadge } from '../host/leagues/LeaguesPage';
import { StandingsTable } from '../host/leagues/StandingsTable';
import { teamApi } from './api';

/** League invitations (join / decline) and the standings of the leagues the team plays in. */
export function TeamLeagues({ token, teamId, card }: { token: string; teamId: string; card: string }) {
  const { t } = useI18n();
  const [leagues, setLeagues] = useState<TeamLeagueDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    teamApi
      .leagues(token, teamId)
      .then(setLeagues)
      .catch((err) => setError(describeError(err, t, 'errors.generic')));
  }, [token, teamId, t]);
  useEffect(load, [load]);

  async function answer(leagueId: string, join: boolean) {
    setBusy(leagueId);
    setError(null);
    try {
      const updated = await teamApi.respondToLeague(token, teamId, leagueId, join);
      setLeagues((list) => list.map((row) => (row.league.id === leagueId ? updated : row)));
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(null);
    }
  }

  const invitations = leagues.filter((row) => row.status === 'INVITED' && row.league.phase !== 'CLOSED');
  const joined = leagues.filter((row) => row.status === 'JOINED');

  return (
    <>
      {invitations.map(({ league }) => (
        <section key={league.id} className={`${card} border border-secondary/50`} data-testid={`team-league-invite-${league.id}`}>
          <span className="flex items-center gap-1 text-label-sm uppercase tracking-wider text-secondary">
            <MailOpen className="h-4 w-4" />
            {t('team.leagues.invite')}
          </span>
          <h3 className="mt-space-xs text-headline-sm text-on-surface">{league.name}</h3>
          <p className="text-body-sm text-on-surface-variant">
            {t('leagues.proposedBy')} {league.ownerName}
          </p>
          <div className="mt-space-xs">
            <LeagueFacts league={league} />
          </div>
          <div className="mt-space-md flex gap-space-sm">
            <button
              type="button"
              disabled={busy === league.id}
              onClick={() => void answer(league.id, true)}
              data-testid={`team-league-join-${league.id}`}
              className="flex items-center gap-1 rounded-xl bg-primary px-space-md py-2 text-label-lg text-on-primary disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {t('team.leagues.join')}
            </button>
            <button
              type="button"
              disabled={busy === league.id}
              onClick={() => void answer(league.id, false)}
              data-testid={`team-league-decline-${league.id}`}
              className="flex items-center gap-1 rounded-xl bg-surface-container-high px-space-md py-2 text-label-lg text-on-surface disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              {t('leagues.decline')}
            </button>
          </div>
        </section>
      ))}

      <section className={card} data-testid="team-leagues">
        <span className="flex items-center gap-1 text-label-sm uppercase tracking-wider text-secondary">
          <Trophy className="h-4 w-4" />
          {t('team.leagues.title')}
        </span>
        {error && (
          <p role="alert" className="mt-space-xs text-body-sm text-error">
            {error}
          </p>
        )}
        {joined.length === 0 && <p className="mt-space-xs text-body-sm text-on-surface-variant">{t('team.leagues.empty')}</p>}
        <div className="mt-space-sm flex flex-col gap-space-lg">
          {joined.map(({ league, standings }) => (
            <div key={league.id} className="flex flex-col gap-space-sm" data-testid={`team-league-${league.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <h3 className="text-headline-sm text-on-surface">{league.name}</h3>
                <PhaseBadge league={league} />
              </div>
              <StandingsTable standings={standings} pubs={league.pubs} kind={league.kind} highlightTeamId={teamId} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
