import type { LeagueKind, LeaguePubDto, LeagueStandingDto } from '@quizicius/shared-types';
import { useI18n } from '../../lib/i18n';
import { formatDay } from '../../lib/subscription';

/** `2027-01-12` → "12. 1. 2027". */
export function useDay() {
  const { locale } = useI18n();
  return (day: string | null) => (day ? formatDay(day, locale) : '—');
}

/** A league table; shared by the host's league page and the captain's team page. */
export function StandingsTable({
  standings,
  pubs,
  kind,
  highlightTeamId,
}: {
  standings: LeagueStandingDto[];
  pubs: LeaguePubDto[];
  kind: LeagueKind;
  highlightTeamId?: string;
}) {
  const { t } = useI18n();
  const pubName = new Map(pubs.map((pub) => [pub.id, pub.name]));
  if (!standings.length) return <p className="text-body-md text-on-surface-variant">{t('leagues.detail.noStandings')}</p>;
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm text-on-surface" data-testid="standings-table">
          <thead className="bg-surface-container text-label-sm uppercase text-on-surface-variant">
            <tr>
              <th className="rounded-l-lg p-space-sm">#</th>
              <th className="p-space-sm">{t('standings.team')}</th>
              {pubs.length > 1 && <th className="p-space-sm">{t('standings.pub')}</th>}
              <th className="p-space-sm">{t('standings.nights')}</th>
              <th className="p-space-sm">{t('standings.placements')}</th>
              <th className="rounded-r-lg p-space-sm text-right">{t('standings.points')}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr
                key={row.registeredTeamId || row.teamName}
                data-testid={`standing-${row.registeredTeamId}`}
                className={row.registeredTeamId === highlightTeamId ? 'bg-primary-container/20' : 'hover:bg-surface-container/40'}
              >
                <td className="p-space-sm text-on-surface-variant">{row.rank}</td>
                <td className="p-space-sm font-semibold">{row.teamName}</td>
                {pubs.length > 1 && <td className="p-space-sm text-on-surface-variant">{(row.pubId && pubName.get(row.pubId)) ?? '—'}</td>}
                <td className="p-space-sm text-on-surface-variant">{row.nights}</td>
                <td className="p-space-sm text-on-surface-variant">{row.placements.join(' · ') || '—'}</td>
                <td className="p-space-sm text-right text-label-lg">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        {t(kind === 'SUPER' ? 'leagues.detail.scoringSuper' : 'leagues.detail.scoring')}
      </p>
    </div>
  );
}
