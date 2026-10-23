import { Crown, Beer, HeartHandshake, Trophy } from 'lucide-react';
import type { TeamSummaryDto } from '@quizicius/shared-types';
import { useI18n } from '../lib/i18n';
import { rankTeams } from '../lib/quiz';

export function PauseScene() {
  const { t } = useI18n();
  return (
    <section className="flex w-full flex-col items-center justify-center" data-testid="projector-pause">
      <div className="relative flex w-full max-w-4xl flex-col items-center overflow-hidden rounded-xl bg-surface-container/90 p-space-xl text-center shadow-2xl backdrop-blur-2xl">
        <div className="mb-space-md flex h-24 w-24 items-center justify-center rounded-full bg-secondary-container/20 text-secondary">
          <Beer className="h-14 w-14" />
        </div>
        <span className="text-label-lg font-extrabold uppercase tracking-widest text-secondary">{t('projector.pause.tag')}</span>
        <h2 className="mt-space-xs text-display-lg font-extrabold uppercase tracking-tight text-on-surface">
          {t('projector.pause.title')}
        </h2>
        <p className="mt-space-sm max-w-xl text-headline-sm text-on-surface-variant">{t('projector.pause.subtitle')}</p>
      </div>
    </section>
  );
}

/** Podium for the top three plus a dense rail for everyone else. */
export function LeaderboardScene({ teams }: { teams: TeamSummaryDto[] }) {
  const { t, plural } = useI18n();
  const ranked = rankTeams(teams);
  const [first, second, third] = ranked;
  const rest = ranked.slice(3);

  if (ranked.length === 0) return null;
  return (
    <section className="flex w-full flex-col gap-space-lg" data-testid="projector-leaderboard">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-label-lg font-extrabold uppercase tracking-widest text-secondary">{t('projector.standings.tag')}</span>
          <h2 className="text-display-lg font-extrabold tracking-tight text-on-surface">{t('projector.standings.title')}</h2>
        </div>
        <span className="rounded-full bg-surface-container px-space-md py-space-xs text-label-sm uppercase text-outline">
          {ranked.length} {plural('count.teamsTotal', ranked.length)}
        </span>
      </div>

      <div className="grid grid-cols-1 items-end gap-space-md md:grid-cols-3">
        {second ? <PodiumCard team={second} place={2} /> : <div className="hidden md:order-1 md:block" />}
        <PodiumCard team={first} place={1} />
        {third ? <PodiumCard team={third} place={3} /> : <div className="order-3 hidden md:block" />}
      </div>

      {rest.length > 0 && (
        <ol className="grid grid-cols-1 gap-space-sm md:grid-cols-2">
          {rest.map((team) => (
            <li
              key={team.id}
              className="flex items-center justify-between rounded-xl bg-surface-container/70 px-space-lg py-space-sm shadow-sm"
              data-testid="projector-rank-row"
            >
              <div className="flex min-w-0 items-center gap-space-md">
                <span className="text-label-lg font-bold text-outline">{team.rank}.</span>
                <span className="truncate text-body-lg font-bold text-on-surface">{team.name}</span>
              </div>
              <span className="text-headline-sm font-bold text-on-surface">
                {team.score} {plural('count.pointsShort', team.score)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PodiumCard({ team, place }: { team: { name: string; score: number }; place: 1 | 2 | 3 }) {
  const { t, plural } = useI18n();
  if (place === 1) {
    return (
      <div
        className="order-1 flex h-72 flex-col items-center justify-between overflow-hidden rounded-xl bg-surface-container/95 p-space-lg shadow-[0_0_36px_rgba(255,185,95,0.25)] backdrop-blur-2xl md:order-2"
        data-testid="projector-podium-1"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container shadow-lg">
          <Trophy className="h-8 w-8" />
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="text-label-sm font-extrabold uppercase tracking-widest text-secondary">{t('projector.standings.leader')}</span>
          <span className="text-headline-lg font-extrabold text-on-surface">{team.name}</span>
        </div>
        <div className="flex w-full items-center justify-end rounded-lg bg-secondary-container/20 px-space-md py-space-xs">
          <span className="text-headline-lg font-extrabold text-secondary">
            {team.score} {plural('count.pointsShort', team.score)}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col items-center justify-between overflow-hidden rounded-xl bg-surface-container/90 p-space-lg shadow-xl backdrop-blur-xl ${
        place === 2 ? 'order-2 h-64 md:order-1' : 'order-3 h-56'
      }`}
      data-testid={`projector-podium-${place}`}
    >
      <div className="flex flex-col items-center">
        <div
          className={`mb-space-xs flex items-center justify-center rounded-full text-headline-sm font-extrabold ${
            place === 2 ? 'h-12 w-12 bg-outline/20 text-outline' : 'h-10 w-10 bg-amber-900/40 text-amber-500'
          }`}
        >
          {place}
        </div>
        <span className="text-center text-headline-sm font-extrabold text-on-surface">{team.name}</span>
      </div>
      <div className="mt-space-sm flex w-full items-center justify-end rounded-lg bg-surface-container-high px-space-md py-space-xs">
        <span className="text-headline-sm font-extrabold text-on-surface">
          {team.score} {plural('count.pointsShort', team.score)}
        </span>
      </div>
    </div>
  );
}

export function FinishedScene({ teams }: { teams: TeamSummaryDto[] }) {
  const { t, plural } = useI18n();
  const ranked = rankTeams(teams);
  const [champion, ...others] = ranked;

  return (
    <section className="flex w-full flex-col items-center gap-space-lg text-center" data-testid="projector-finished">
      <div className="relative flex w-full flex-col items-center overflow-hidden rounded-xl bg-gradient-to-b from-surface-container to-surface-container-lowest p-space-xl shadow-2xl backdrop-blur-2xl">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-secondary/15 blur-3xl" />
        <span className="text-label-lg font-extrabold uppercase tracking-widest text-secondary">{t('projector.finished.tag')}</span>
        <h2 className="mt-space-xs text-display-lg font-extrabold uppercase text-on-surface">{t('projector.finished.title')}</h2>

        {champion && (
          <div
            className="mt-space-lg flex w-full max-w-xl flex-col items-center rounded-2xl bg-secondary-container/20 p-space-lg shadow-[0_0_40px_rgba(255,185,95,0.25)]"
            data-testid="projector-champion"
          >
            <div className="mb-space-sm flex h-24 w-24 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container shadow-xl">
              <Crown className="h-12 w-12" />
            </div>
            <span className="text-label-sm font-extrabold uppercase tracking-widest text-secondary">
              {t('projector.finished.champion')}
            </span>
            <h3 className="mt-1 text-display-lg text-on-surface">{champion.name}</h3>
            <span className="text-body-md text-on-surface-variant">
              {t('projector.finished.totalScore')}{' '}
              <strong className="font-bold text-secondary">
                {champion.score} {plural('count.pointsShort', champion.score)}
              </strong>
            </span>
          </div>
        )}

        {others.length > 0 && (
          <ol className="mt-space-md grid w-full max-w-4xl grid-cols-1 gap-space-md md:grid-cols-2">
            {others.map((team) => (
              <li
                key={team.id}
                className="flex items-center justify-between rounded-xl bg-surface-container-high p-space-md shadow-md"
                data-testid="projector-final-row"
              >
                <div className="flex min-w-0 items-center gap-space-sm">
                  <span className={`text-headline-sm font-bold ${team.rank === 3 ? 'text-amber-500' : 'text-outline'}`}>{team.rank}.</span>
                  <span className="truncate text-body-lg font-extrabold text-on-surface">{team.name}</span>
                </div>
                <span className="text-headline-sm font-bold text-on-surface">
                  {team.score} {plural('count.pointsShort', team.score)}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-space-lg flex items-center gap-space-sm text-body-md text-on-surface-variant">
          <HeartHandshake className="h-5 w-5 text-primary" />
          {t('projector.finished.thanks')}
        </div>
      </div>
    </section>
  );
}
