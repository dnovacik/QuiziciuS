import { Archive, Crown, Download, Medal, MonitorPlay } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { describeError } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { rankTeams, type RankedTeam } from '../../lib/quiz';
import { hostApi } from '../api';
import { btn, useToast } from '../ui';
import type { ControlRoom } from './use-control-room';

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Stitch "Výsledky" — podium, the rest of the table, CSV export. */
export function ResultsPanel({ room, token, projectorUrl }: { room: ControlRoom; token: string; projectorUrl: string }) {
  const { t, plural } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [archiving, setArchiving] = useState(false);

  /** Files the finished night away and goes back to the sessions list. */
  async function archive() {
    setArchiving(true);
    try {
      await hostApi.archiveSession(token, room.state!.id, true);
      toast(t('host.sessions.archived'));
      navigate('/host/sessions');
    } catch (err) {
      room.setError(describeError(err, t, 'errors.generic'));
      setArchiving(false);
    }
  }
  const state = room.state!;
  const ranked = rankTeams(state.teams);
  const [first, second, third] = ranked;
  const rest = ranked.slice(3);
  const finished = state.status === 'FINISHED';

  function exportCsv() {
    const rows: (string | number)[][] = [
      [t('host.room.rank'), t('host.room.team'), t('host.room.totalPoints'), t('host.room.infractions')],
    ];
    ranked.forEach((team) => rows.push([team.rank, team.name, team.score, team.infractionCount]));
    downloadCsv(`quizicius-${state.joinCode}.csv`, rows);
  }

  return (
    <section className="flex flex-col gap-space-lg" data-testid="room-results">
      <div className="flex flex-col items-start justify-between gap-space-md rounded-2xl bg-surface-container-low p-space-lg shadow-xl md:flex-row md:items-center">
        <div className="flex items-center gap-space-md">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary/20 text-secondary shadow-lg shadow-secondary/10">
            <Medal className="h-9 w-9" />
          </div>
          <div>
            <span
              className={`rounded px-space-xs py-0.5 text-label-sm font-bold uppercase ${finished ? 'bg-tertiary-container/30 text-tertiary' : 'bg-primary/20 text-primary'}`}
            >
              {t(finished ? 'host.room.finishedBadge' : 'host.room.liveStandings')}
            </span>
            <h2 className="mt-1 text-headline-lg tracking-tight text-on-surface">
              {t(finished ? 'host.room.finalTitle' : 'host.room.standingsTitle')}: {room.quiz?.title ?? ''}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <a className={`${btn.secondary} text-secondary`} href={projectorUrl} target="_blank" rel="noreferrer">
            <MonitorPlay className="h-[18px] w-[18px]" />
            {t('host.room.projectResults')}
          </a>
          <button type="button" className={btn.secondary} onClick={exportCsv} disabled={!ranked.length} data-testid="results-export">
            <Download className="h-[18px] w-[18px]" />
            {t('host.room.exportCsv')}
          </button>
          {finished && (
            <button type="button" className={btn.primary} disabled={archiving} onClick={() => void archive()} data-testid="results-archive">
              <Archive className="h-[18px] w-[18px]" />
              {t('host.room.archive')}
            </button>
          )}
        </div>
      </div>

      {ranked.length === 0 ? (
        <p className="rounded-2xl bg-surface-container-low p-space-lg text-center text-body-md text-on-surface-variant">
          {t('projector.lobby.noTeams')}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 items-end gap-space-md pt-space-sm md:grid-cols-3">
            {second ? <Podium team={second} place={2} /> : <div className="hidden md:order-1 md:block" />}
            <Podium team={first} place={1} />
            {third ? <Podium team={third} place={3} /> : <div className="order-3 hidden md:block" />}
          </div>

          {rest.length > 0 && (
            <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-lg shadow-xl">
              <div className="flex items-center justify-between pb-space-xs">
                <h3 className="text-headline-md text-on-surface">
                  {t('host.room.otherTeams')} (4. – {ranked.length}.)
                </h3>
                <span className="rounded-lg bg-surface-container px-space-sm py-1 text-label-sm text-on-surface-variant">
                  {rest.length} {plural('count.teams', rest.length)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm text-on-surface" data-testid="results-table">
                  <thead className="bg-surface-container text-label-sm uppercase text-on-surface-variant">
                    <tr>
                      <th className="rounded-l-lg p-space-sm">{t('host.room.rank')}</th>
                      <th className="p-space-sm">{t('host.room.team')}</th>
                      <th className="p-space-sm">{t('host.room.infractions')}</th>
                      <th className="rounded-r-lg p-space-sm text-right">{t('host.room.totalPoints')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((team) => (
                      <tr key={team.id} className="transition-colors hover:bg-surface-container/40">
                        <td className="p-space-sm font-bold text-on-surface">#{team.rank}</td>
                        <td className="p-space-sm text-label-md">{team.name}</td>
                        <td className={`p-space-sm ${team.infractionCount ? 'text-error' : 'text-on-surface-variant'}`}>
                          {team.infractionCount}
                        </td>
                        <td className="p-space-sm text-right text-headline-sm">
                          {team.score} {plural('count.pointsShort', team.score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Podium({ team, place }: { team: RankedTeam; place: 1 | 2 | 3 }) {
  const { t, plural } = useI18n();
  if (place === 1) {
    return (
      <div
        className="relative order-1 -mt-4 flex flex-col items-center overflow-hidden rounded-2xl bg-surface-container-low p-space-lg text-center shadow-2xl shadow-secondary/15 md:order-2"
        data-testid="results-podium-1"
      >
        <div className="mb-space-xs flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-secondary-container to-secondary text-display-lg text-on-secondary shadow-lg shadow-secondary/30">
          1
        </div>
        <span className="flex items-center gap-1 rounded-full bg-secondary/20 px-space-sm py-1 text-label-sm font-bold uppercase text-secondary">
          <Crown className="h-3.5 w-3.5" />
          {t('host.room.champion')}
        </span>
        <h3 className="mt-space-xs text-headline-lg font-extrabold tracking-tight text-secondary">{team.name}</h3>
        <div className="mt-space-md flex w-full flex-col items-center rounded-2xl bg-surface-container p-space-md shadow-inner">
          <span className="text-label-sm text-on-surface-variant">{t('host.room.winningScore')}</span>
          <span className="text-display-lg font-extrabold text-secondary">
            {team.score} {plural('count.pointsShort', team.score)}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`relative flex flex-col items-center overflow-hidden rounded-2xl bg-surface-container-low p-space-md text-center shadow-xl ${place === 2 ? 'order-2 md:order-1' : 'order-3'}`}
      data-testid={`results-podium-${place}`}
    >
      <div
        className={`mb-space-xs flex h-12 w-12 items-center justify-center rounded-full text-headline-sm font-bold shadow-md ${
          place === 2 ? 'bg-surface-container-high text-on-surface' : 'bg-secondary-container/20 text-secondary-fixed'
        }`}
      >
        {place}
      </div>
      <span className="rounded-full bg-surface-container px-space-xs py-0.5 text-label-sm uppercase text-on-surface-variant">
        {t(place === 2 ? 'host.room.silver' : 'host.room.bronze')}
      </span>
      <h3 className="mt-space-xs text-headline-md text-on-surface">{team.name}</h3>
      <div className="mt-space-md flex w-full flex-col items-center rounded-xl bg-surface-container p-space-sm">
        <span className="text-label-sm text-on-surface-variant">{t('host.room.totalPoints')}</span>
        <span className="text-headline-lg font-bold text-on-surface">
          {team.score} {plural('count.pointsShort', team.score)}
        </span>
      </div>
    </div>
  );
}
