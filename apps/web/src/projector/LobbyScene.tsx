import { QRCodeSVG } from 'qrcode.react';
import { LockOpen, MapPin, RefreshCw, Users } from 'lucide-react';
import type { QuizSessionStateDto } from '@quizicius/shared-types';
import { useI18n } from '../lib/i18n';

export function LobbyScene({
  state,
  sessionId,
  title,
  pub,
}: {
  state: QuizSessionStateDto;
  sessionId: string;
  title: string | null;
  pub?: string | null;
}) {
  const { t, plural } = useI18n();
  const joinUrl = new URL(`/play/${sessionId}`, window.location.origin);
  const active = state.teams.filter((team) => team.isActive).length;

  return (
    <section className="flex w-full flex-col gap-space-lg" data-testid="projector-lobby">
      <div className="flex flex-col justify-between gap-space-md md:flex-row md:items-end">
        <div>
          <span className="text-label-lg uppercase tracking-widest text-primary">{t('projector.lobby.tag')}</span>
          <h1
            className="mt-1 text-display-lg tracking-tight text-on-surface xl:text-[56px] xl:leading-[64px]"
            data-testid="projector-title"
          >
            {title ?? t('play.join.eventFallback')}
          </h1>
          {pub && (
            <p className="mt-space-xs flex items-center gap-space-xs text-headline-sm text-on-surface-variant" data-testid="projector-pub">
              <MapPin className="h-6 w-6 text-secondary" />
              {pub}
            </p>
          )}
        </div>
        <div className="flex items-center gap-space-sm self-start rounded-xl bg-surface-container-high px-space-lg py-space-sm shadow-lg md:self-auto">
          <div className="h-3 w-3 animate-pulse rounded-full bg-tertiary" />
          <span className="text-headline-sm font-bold text-on-surface" data-testid="projector-team-count">
            {active} {plural('count.teamsConnected', active)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-space-lg lg:grid-cols-12">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container/90 p-space-lg shadow-2xl backdrop-blur-xl lg:col-span-5">
          <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-secondary/10 blur-3xl" />
          <div>
            <span className="mb-space-sm block text-label-sm font-extrabold uppercase tracking-widest text-secondary">
              {t('projector.lobby.howToJoin')}
            </span>
            <p className="text-headline-sm font-semibold text-on-surface">
              {t('projector.lobby.scanOrVisit')} <span className="font-bold text-primary">{joinUrl.host}</span>
            </p>
          </div>
          <div className="my-space-md flex flex-col items-center justify-center rounded-xl bg-surface-container-lowest p-space-lg shadow-inner">
            <div className="rounded-lg bg-white p-3" data-testid="projector-qr">
              <QRCodeSVG value={joinUrl.href} size={224} level="M" marginSize={0} />
            </div>
            <span className="mt-space-sm break-all text-center text-label-md text-on-surface-variant" data-testid="projector-join-url">
              {joinUrl.host}
              {joinUrl.pathname}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface-container-high p-space-md shadow-md">
            <div>
              <span className="block text-label-sm uppercase tracking-wider text-outline">{t('projector.lobby.roomCode')}</span>
              <span className="text-display-lg font-extrabold tracking-widest text-secondary" data-testid="projector-join-code">
                #{state.joinCode}
              </span>
            </div>
            <div className="flex items-center gap-space-xs rounded-full bg-tertiary-container/20 px-space-md py-space-xs text-tertiary">
              <LockOpen className="h-[18px] w-[18px]" />
              <span className="text-label-sm font-bold uppercase">{t('projector.lobby.open')}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container/60 p-space-lg shadow-2xl backdrop-blur-xl lg:col-span-7">
          <div>
            <div className="flex items-center justify-between pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <Users className="h-[22px] w-[22px] text-primary" />
                <span className="text-headline-sm font-bold text-on-surface">{t('projector.lobby.teamsInRoom')}</span>
              </div>
              <span className="text-label-sm uppercase tracking-wider text-outline">{t('projector.lobby.liveSync')}</span>
            </div>
            {state.teams.length === 0 ? (
              <p className="py-space-xl text-center text-headline-sm text-on-surface-variant">{t('projector.lobby.noTeams')}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-space-sm pt-space-md sm:grid-cols-2 md:grid-cols-3">
                {state.teams.map((team) => (
                  <li
                    key={team.id}
                    className="flex items-center gap-space-xs rounded-lg bg-surface-container-high/80 p-space-sm shadow-sm"
                    data-testid="projector-team"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${team.isActive ? 'bg-tertiary' : 'bg-outline'}`} />
                    <span className={`truncate text-body-md font-bold ${team.isActive ? 'text-on-surface' : 'text-outline'}`}>
                      {team.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-space-lg flex items-center gap-space-sm rounded-xl bg-primary-container/15 p-space-md">
            <RefreshCw className="h-6 w-6 animate-spin text-primary [animation-duration:3s]" />
            <span className="text-body-lg font-bold text-primary">{t('projector.lobby.waitingHost')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
