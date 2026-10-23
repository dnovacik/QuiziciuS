import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import type { RankedTeam } from '../lib/quiz';

/** Circular countdown from the Stitch live-question HUD. */
export function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const { t, plural } = useI18n();
  const circumference = 2 * Math.PI * 26;
  const fraction = total > 0 ? Math.min(1, seconds / total) : 0;
  const urgent = seconds <= 5;
  return (
    <div
      role="timer"
      aria-label={`${seconds} ${plural('count.seconds', seconds)}`}
      data-testid="player-timer"
      className="relative flex h-16 w-16 shrink-0 items-center justify-center"
    >
      <svg aria-hidden="true" className="h-full w-full -rotate-90" viewBox="0 0 64 64">
        <circle className="text-surface-variant" cx="32" cy="32" r="26" fill="transparent" stroke="currentColor" strokeWidth="4" />
        <circle
          className={`${urgent ? 'text-red-400' : 'text-secondary'} transition-all duration-1000 ease-linear`}
          cx="32"
          cy="32"
          r="26"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-headline-sm font-extrabold leading-none ${urgent ? 'text-red-300' : 'text-secondary'}`}>{seconds}</span>
        <span className="-mt-0.5 text-[8px] uppercase text-on-surface-variant">{t('play.secondsShort')}</span>
      </div>
    </div>
  );
}

/** Radar-style status card from the Stitch lobby ("waiting for the host"). */
export function StatusCard({
  icon: Icon,
  badge,
  title,
  children,
  spin = false,
  testId,
}: {
  icon: ComponentType<LucideProps>;
  badge: string;
  title: string;
  children?: ReactNode;
  spin?: boolean;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-lg">
      <div className="absolute left-1/2 top-0 h-1 w-48 -translate-x-1/2 rounded-full bg-primary/60 blur-[6px]" />
      <div className="pointer-events-none absolute -top-12 left-1/2 h-24 w-40 -translate-x-1/2 bg-primary/15 blur-3xl" />
      <div className="relative z-10 flex flex-col items-center py-space-sm text-center">
        <div className="relative mb-space-md flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/10 opacity-60" />
          <div className="absolute inset-2 animate-pulse rounded-full bg-primary/20" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[0_0_20px_rgba(208,188,255,0.45)]">
            <Icon className={`h-7 w-7 ${spin ? 'animate-spin [animation-duration:9s]' : ''}`} />
          </div>
          <div className="absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-tertiary shadow-[0_0_8px_rgba(78,222,163,0.8)]" />
        </div>
        <div className="mb-space-xs inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
          <span className="text-label-sm font-bold uppercase tracking-widest text-secondary">{badge}</span>
        </div>
        <h1 className="max-w-[300px] text-headline-md font-extrabold leading-tight text-on-surface">{title}</h1>
        {children}
      </div>
    </section>
  );
}

/** "#2 · Team · 38 b" pill pinned under the game screens. */
export function StandingPill({ team, leader }: { team: RankedTeam; leader: RankedTeam | undefined }) {
  const { t, plural } = useI18n();
  const behind = leader && leader.id !== team.id ? leader.score - team.score : 0;
  return (
    <section
      data-testid="player-standing"
      className="flex items-center justify-between rounded-xl bg-surface-container-highest/60 p-3 shadow-sm backdrop-blur-md"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-headline-sm font-extrabold text-on-secondary shadow-sm">
          #{team.rank}
        </div>
        <div className="min-w-0">
          <span className="block truncate text-label-md font-bold text-on-surface">{team.name}</span>
          <span className="text-label-sm text-on-surface-variant">
            {team.rank === 1 ? t('play.standing.leading') : `${t('play.standing.behind')} ${behind} ${plural('count.pointsShort', behind)}`}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-headline-sm font-extrabold text-secondary">
        {team.score} {plural('count.pointsShort', team.score)}
      </span>
    </section>
  );
}

/** Ranked list rows used on the reveal (top 3) and final results (everyone). */
export function StandingRow({ team, isOwn }: { team: RankedTeam; isOwn: boolean }) {
  const { t, plural } = useI18n();
  const podium = team.rank === 1 ? 'text-secondary' : isOwn ? 'text-primary' : 'text-on-surface-variant';
  return (
    <li
      data-testid={isOwn ? 'standing-own' : 'standing-row'}
      className={`flex h-14 items-center justify-between gap-space-sm rounded-lg px-space-md ${
        isOwn ? 'bg-primary-container/20 shadow-md' : 'bg-surface-container shadow-sm'
      }`}
    >
      <div className="flex min-w-0 items-center gap-space-sm">
        <span className={`w-6 shrink-0 text-center text-headline-sm font-extrabold ${podium}`}>{team.rank}</span>
        <span className="truncate text-body-lg font-bold text-on-surface">{team.name}</span>
        {isOwn && (
          <span className="shrink-0 rounded bg-primary px-1.5 text-label-sm font-extrabold uppercase text-on-primary">{t('play.you')}</span>
        )}
      </div>
      <span className={`shrink-0 text-headline-sm font-extrabold ${podium}`}>
        {team.score} <span className="text-label-sm font-normal text-on-surface-variant">{plural('count.pointsShort', team.score)}</span>
      </span>
    </li>
  );
}
