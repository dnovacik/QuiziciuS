import { useSessionDisplay } from '../../lib/use-quiz-title';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BadgeCheck, CirclePlay, Copy, Link2, MonitorPlay, XCircle, Trophy } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { btn, ConfirmDialog, useCopy } from '../ui';
import { joinUrl } from '../sessions';
import type { ControlRoom } from './use-control-room';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

export function LobbyPanel({ room, sessionId, onCancel }: { room: ControlRoom; sessionId: string; onCancel: () => void }) {
  const { t, plural } = useI18n();
  const copy = useCopy();
  const [confirmStart, setConfirmStart] = useState(false);
  const state = room.state!;
  const url = joinUrl(sessionId);
  const online = state.teams.filter((team) => team.isActive).length;
  const { league } = useSessionDisplay(sessionId);
  const unregistered = league ? state.teams.filter((team) => !team.registeredTeamId).length : 0;
  const totalPoints = room.questions.reduce((sum, question) => sum + question.points, 0);
  const inLobby = state.status === 'LOBBY';
  const firstQuestion = room.questions.find((question) => question.id === room.selectedId);

  return (
    <section className="flex flex-col gap-space-lg" data-testid="room-lobby">
      <div className="grid grid-cols-1 items-stretch gap-space-lg lg:grid-cols-12">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-surface-container-low p-space-lg shadow-xl lg:col-span-5">
          <div className="flex items-center justify-between pb-space-sm">
            <span className="text-label-sm uppercase tracking-widest text-primary">{t('host.room.joinTitle')}</span>
            <span className="flex items-center gap-1 rounded-full bg-tertiary-container/20 px-space-sm py-0.5 text-label-sm text-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
              {t('host.room.joinOpen')}
            </span>
          </div>
          <div className="my-space-md flex flex-col items-center gap-space-lg sm:flex-row">
            <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-xl bg-white p-3 shadow-inner" data-testid="room-qr">
              <QRCodeSVG value={url} size={152} level="M" marginSize={0} />
            </div>
            <div className="flex min-w-0 flex-col gap-space-xs">
              <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('host.room.pin')}</span>
              <div className="flex items-center gap-space-sm">
                <span
                  className="rounded-xl bg-surface-container-high px-space-md py-1 text-display-lg tracking-widest text-secondary shadow-md"
                  data-testid="room-join-code"
                >
                  #{state.joinCode}
                </span>
                <button
                  type="button"
                  className={`${btn.icon} bg-surface-container-high`}
                  aria-label={t('host.session.copyCode')}
                  onClick={() => copy(state.joinCode)}
                >
                  <Copy className="h-5 w-5" />
                </button>
              </div>
              <span className="break-all text-body-sm text-on-surface-variant">{url}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-space-sm pt-space-sm">
            <button type="button" className={`${btn.secondary} flex-1`} onClick={() => copy(url)} data-testid="room-copy-link">
              <Link2 className="h-[18px] w-[18px]" />
              {t('host.room.copyLink')}
            </button>
            <a className={`${btn.secondary} text-secondary`} href={`/projector/${sessionId}`} target="_blank" rel="noreferrer">
              <MonitorPlay className="h-[18px] w-[18px]" />
              {t('host.room.openProjector')}
            </a>
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-surface-container-low p-space-lg shadow-xl lg:col-span-7">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-space-xs pb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="rounded bg-primary/20 px-space-xs py-0.5 text-label-sm uppercase text-primary">
                  {t(inLobby ? 'host.room.readyToStart' : `host.status.${state.status}`)}
                </span>
                <span className="text-label-sm text-on-surface-variant">
                  • {room.questions.length} {plural('count.questions', room.questions.length)}
                </span>
              </div>
              <span className="text-headline-sm text-tertiary" data-testid="room-online-count">
                {online} {plural('count.teamsConnected', online)}
              </span>
            </div>
            <h2 className="mt-space-xs text-headline-lg tracking-tight text-on-surface">{room.quiz?.title ?? '…'}</h2>
            <p className="mt-space-xs text-body-md text-on-surface-variant">{t('host.room.lobbyHint')}</p>
            <div className="mt-space-md grid grid-cols-3 gap-space-sm">
              <Tile label={t('host.common.questions')} value={String(room.questions.length)} tone="text-primary" />
              <Tile label={t('host.room.totalPoints')} value={String(totalPoints)} tone="text-secondary" />
              <Tile label={t('host.room.teams')} value={`${online}/${state.teams.length}`} tone="text-tertiary" />
            </div>
          </div>
          <div className="flex flex-col items-stretch justify-between gap-space-md pt-space-lg sm:flex-row sm:items-center">
            {inLobby && (
              <button
                type="button"
                className={`${btn.secondary} py-3 text-on-surface-variant hover:bg-error-container/20 hover:text-error`}
                onClick={onCancel}
              >
                <XCircle className="h-[18px] w-[18px]" />
                {t('host.room.cancel')}
              </button>
            )}
            {inLobby && (
              <button
                type="button"
                className="flex transform items-center justify-center gap-space-sm rounded-xl bg-gradient-to-r from-primary-container via-primary-container to-secondary-container px-space-xl py-3.5 text-label-lg text-on-primary shadow-lg shadow-primary-container/30 transition-all hover:scale-[1.02] hover:brightness-110 disabled:opacity-50"
                disabled={!room.questions.length || room.busy}
                onClick={() => setConfirmStart(true)}
                data-testid="room-start"
              >
                <CirclePlay className="h-6 w-6" />
                {t('host.room.start')}
              </button>
            )}
          </div>
          {inLobby && !room.questions.length && <p className="mt-space-sm text-body-sm text-secondary">{t('host.room.noQuestions')}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-lg shadow-xl">
        <div className="flex flex-col items-start justify-between gap-space-xs sm:flex-row sm:items-center">
          <div>
            <h3 className="text-headline-md text-on-surface">{t('host.room.teamsTitle')}</h3>
            <p className="text-body-sm text-on-surface-variant">
              {t('host.room.teamsHint')} #{state.joinCode}
            </p>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="rounded-full bg-surface-container px-space-sm py-1 text-label-sm text-on-surface-variant">
              {online} {plural('count.activeTeams', online)}
            </span>
            <span className="rounded-full bg-surface-container px-space-sm py-1 text-label-sm text-tertiary">
              {state.teams.length - online} {t('host.room.offline')}
            </span>
          </div>
        </div>
        {league && (
          <div className="flex flex-wrap items-center gap-space-sm rounded-xl bg-secondary-container/15 p-space-sm text-body-sm text-secondary">
            <Trophy className="h-4 w-4" />
            <span className="text-label-md">
              {t('leagues.lobby.league')}: {league.name}
            </span>
            {unregistered > 0 && (
              <>
                <span
                  data-testid="lobby-unregistered-count"
                  className="rounded-full bg-secondary-container/30 px-space-sm py-0.5 text-label-sm"
                >
                  {t('leagues.lobby.unregistered')}: {unregistered} {plural('count.teams', unregistered)}
                </span>
                {inLobby && <span className="text-on-surface-variant">{t('leagues.lobby.hint')}</span>}
              </>
            )}
          </div>
        )}
        {state.teams.length === 0 ? (
          <p className="py-space-lg text-center text-body-md text-on-surface-variant">{t('projector.lobby.noTeams')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {state.teams.map((team, index) => (
              <li
                key={team.id}
                className="flex flex-col justify-between gap-space-xs rounded-xl bg-surface-container p-space-sm shadow-sm transition-colors hover:bg-surface-container-high"
                data-testid={`room-team-${team.id}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-headline-sm font-bold ${
                      ['bg-primary-container/20 text-primary', 'bg-secondary/20 text-secondary', 'bg-tertiary/20 text-tertiary'][index % 3]
                    }`}
                  >
                    {initials(team.name)}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${team.isActive ? 'bg-tertiary' : 'bg-outline'}`} />
                </div>
                <h4 className="flex items-center gap-1 truncate text-label-lg text-on-surface">
                  {team.name}
                  {league && !team.registeredTeamId && (
                    <span
                      className="rounded bg-secondary-container/30 px-1 text-label-sm font-normal text-secondary"
                      data-testid={`unregistered-${team.id}`}
                    >
                      {t('leagues.lobby.badge')}
                    </span>
                  )}
                  {team.registeredTeamId && (
                    <BadgeCheck
                      className="h-4 w-4 shrink-0 text-secondary"
                      aria-label={t('host.room.registeredTeam')}
                      data-testid={`registered-${team.id}`}
                    />
                  )}
                </h4>
                <div className="flex items-center justify-between pt-1 text-label-sm">
                  <span className={team.isActive ? 'text-tertiary' : 'text-outline'}>
                    {t(team.isActive ? 'host.room.online' : 'host.room.offlineOne')}
                  </span>
                  {team.infractionCount > 0 && (
                    <span className="text-error">
                      {team.infractionCount} {plural('count.infractions', team.infractionCount)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmStart && (
        <ConfirmDialog
          icon={CirclePlay}
          title={t('host.room.startTitle')}
          text={`${t('host.room.startText')} ${firstQuestion ? `„${firstQuestion.prompt}“` : ''}`}
          confirmLabel={t('host.room.startConfirm')}
          cancelLabel={t('host.room.startWait')}
          busy={room.busy}
          onConfirm={() => {
            setConfirmStart(false);
            void room.transition('LOCK_IN_ROUND');
          }}
          onClose={() => setConfirmStart(false)}
          testId="room-start-dialog"
        />
      )}
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-surface-container p-space-sm">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      <span className={`text-headline-sm ${tone}`}>{value}</span>
    </div>
  );
}
