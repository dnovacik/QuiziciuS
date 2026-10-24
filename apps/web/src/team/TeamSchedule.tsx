import { useEffect, useState } from 'react';
import { CalendarCheck, MapPin } from 'lucide-react';
import type { TeamScheduledNightDto } from '@quizicius/shared-types';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { pubLabel } from '../lib/pubs';
import { useNightTime } from '../host/schedule';
import { teamApi } from './api';

/** The quiz nights hosts have planned at the team's pubs, soonest first. */
export function useTeamSchedule(token: string, teamId: string) {
  const { t } = useI18n();
  const [nights, setNights] = useState<TeamScheduledNightDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    teamApi
      .schedule(token, teamId)
      .then((rows) => active && setNights(rows))
      .catch((err) => active && setError(describeError(err, t, 'errors.generic')));
    return () => {
      active = false;
    };
  }, [token, teamId, t]);
  return { nights, error };
}

export function NightRow({ night }: { night: TeamScheduledNightDto }) {
  const when = useNightTime();
  return (
    <li className="flex flex-col gap-0.5 rounded-2xl bg-surface-container-low p-space-sm" data-testid={`team-night-${night.id}`}>
      <span className="text-label-lg text-on-surface">{when(night.startsAt)}</span>
      <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
        <MapPin className="h-4 w-4 text-secondary" />
        {night.pub ? pubLabel(night.pub) : '—'}
        {night.hostName && ` · ${night.hostName}`}
      </span>
      {(night.quizTitle || night.note) && (
        <span className="text-body-sm text-secondary">{[night.quizTitle, night.note].filter(Boolean).join(' · ')}</span>
      )}
    </li>
  );
}

/** The "Quiz schedule" page of the team area. */
export function TeamSchedule({ token, teamId }: { token: string; teamId: string }) {
  const { t } = useI18n();
  const { nights, error } = useTeamSchedule(token, teamId);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-space-lg py-space-md" data-testid="team-schedule">
      <section className="rounded-3xl bg-surface-container/70 p-space-md shadow-xl backdrop-blur-xl lg:p-space-lg">
        <div className="mb-space-md flex items-center gap-space-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary-container/30 text-secondary">
            <CalendarCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-headline-md text-on-surface">{t('team.nav.schedule')}</h1>
            <p className="text-body-sm text-on-surface-variant">{t('team.schedule.subtitle')}</p>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-body-md text-error">
            {error}
          </p>
        ) : nights === null ? (
          <span className="block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-busy="true" />
        ) : nights.length === 0 ? (
          <p className="text-body-md text-on-surface-variant" data-testid="team-schedule-empty">
            {t('team.schedule.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-space-xs">
            {nights.map((night) => (
              <NightRow key={night.id} night={night} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
