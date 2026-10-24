import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import type { PubLeaderboardDto } from '@quizicius/shared-types';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { pubLabel } from '../lib/pubs';
import { StandingsTable } from '../host/leagues/StandingsTable';
import { teamApi, type RegisteredTeam } from './api';

const card = 'rounded-3xl bg-surface-container/70 p-space-md shadow-xl backdrop-blur-xl lg:p-space-lg';

/** The pub's table over its finished quiz nights, for the team's pubs (home pub first). */
export function PubLeaderboard({ token, team }: { token: string; team: RegisteredTeam }) {
  const { t } = useI18n();
  const pubs = [...team.pubs].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const [pubId, setPubId] = useState(pubs[0]?.id ?? '');
  const [period, setPeriod] = useState<'year' | 'all'>('year');
  const [board, setBoard] = useState<PubLeaderboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pubId) return;
    let active = true;
    setBoard(null);
    setError(null);
    teamApi
      .pubLeaderboard(token, pubId, period)
      .then((row) => active && setBoard(row))
      .catch((err) => active && setError(describeError(err, t, 'errors.generic')));
    return () => {
      active = false;
    };
  }, [token, pubId, period, t]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-space-lg py-space-md" data-testid="pub-leaderboard">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-container/30 text-secondary">
              <Trophy className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-headline-md text-on-surface">{t('team.leaderboard.title')}</h1>
              <p className="text-body-sm text-on-surface-variant">{t('team.leaderboard.subtitle')}</p>
            </div>
          </div>
          {pubs.length > 0 && (
            <div className="flex flex-wrap items-center gap-space-sm">
              {pubs.length > 1 && (
                <select
                  value={pubId}
                  onChange={(event) => setPubId(event.target.value)}
                  className="h-10 rounded-xl bg-surface-container-lowest px-space-sm text-body-md text-on-surface"
                  data-testid="leaderboard-pub"
                >
                  {pubs.map((pub) => (
                    <option key={pub.id} value={pub.id}>
                      {pubLabel(pub)}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex rounded-xl bg-surface-container-low p-1" role="group">
                {(['year', 'all'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={period === value}
                    onClick={() => setPeriod(value)}
                    className={`rounded-lg px-space-sm py-1 text-label-md ${period === value ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}
                    data-testid={`leaderboard-period-${value}`}
                  >
                    {t(`team.leaderboard.${value}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={card}>
        {!pubs.length ? (
          <p className="text-body-md text-on-surface-variant" data-testid="leaderboard-no-pub">
            {t('team.leaderboard.noPub')}
          </p>
        ) : error ? (
          <p role="alert" className="text-body-md text-error">
            {error}
          </p>
        ) : !board ? (
          <span className="block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-busy="true" />
        ) : (
          <div className="flex flex-col gap-space-sm">
            <p className="text-label-md text-on-surface-variant" data-testid="leaderboard-nights">
              {pubLabel(board.pub)} · {board.nights} {t('team.leaderboard.nights')}
            </p>
            <StandingsTable standings={board.standings} pubs={[]} kind="LEAGUE" highlightTeamId={team.id} />
          </div>
        )}
      </section>
    </div>
  );
}
