import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlarmClockPlus, ArrowRight, CirclePlay, Coffee, Flag, Pause, Play, Users } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { secondsLeft, useNow } from '../../lib/quiz';
import { LogoMark } from '../../ui/Logo';
import { btn, ConfirmDialog, ErrorBanner } from '../ui';
import { useControlRoom } from './use-control-room';
import { clipSlot, nextStepLabel, runRoomCommand } from './use-room-clicker';

/** Keeps the phone's screen on while the remote is open (best effort: not every browser can). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let active = true;
    const request = () => {
      const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } })
        .wakeLock;
      if (!wakeLock || document.visibilityState !== 'visible') return;
      wakeLock
        .request('screen')
        .then((sentinel) => {
          if (active) lock = sentinel;
          else void sentinel.release();
        })
        .catch(() => {
          // Not allowed here; the phone may dim as usual.
        });
    };
    request();
    // The browser drops the lock when the page is hidden; take it again on return.
    document.addEventListener('visibilitychange', request);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', request);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

/**
 * The host's phone as the remote: one big button steps the night like the clicker does, with the
 * clip, break and timer controls next to it. It runs the same steps as the control room.
 */
export function RemotePage({ token }: { token: string }) {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const { t, plural } = useI18n();
  const room = useControlRoom(token, sessionId);
  const { state } = room;
  const now = useNow();
  const [confirm, setConfirm] = useState<'start' | 'finish' | null>(null);
  useWakeLock();

  if (!state) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background" aria-busy="true">
        {room.stateError ? (
          <ErrorBanner>{room.stateError}</ErrorBanner>
        ) : (
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        )}
      </div>
    );
  }

  const status = state.status;
  const upcoming = room.questions.find((question) => question.id === room.selectedId) ?? null;
  const focus = status === 'LOBBY' || status === 'PAUSE_BREAK' ? upcoming : (room.currentQuestion ?? upcoming);
  const focusIndex = focus ? room.questions.findIndex((question) => question.id === focus.id) : -1;
  const remaining = status === 'QUESTION_ACTIVE' ? secondsLeft(state.questionEndsAt, now, state.questionPausedAt) : null;
  const paused = status === 'QUESTION_ACTIVE' && Boolean(state.questionPausedAt);
  const teams = state.teams.filter((team) => team.isActive).length;
  const nextLabel = nextStepLabel(room);
  const canFinish = (status === 'QUESTION_REVEAL' || status === 'PAUSE_BREAK') && !room.selectedId;
  const slot = clipSlot(room);
  const playing = slot && room.currentQuestion ? room.mediaStatus[`${room.currentQuestion.id}:${slot}`]?.state === 'playing' : false;

  const next = () => {
    if (status === 'LOBBY') setConfirm('start');
    else void runRoomCommand(room, 'next');
  };

  return (
    <div className="flex min-h-[100dvh] flex-col gap-space-md bg-background p-space-md text-on-surface" data-testid="remote">
      <header className="flex items-center justify-between gap-space-sm">
        <div className="flex min-w-0 items-center gap-space-sm">
          <LogoMark size="sm" />
          <div className="min-w-0">
            <div className="truncate text-label-lg text-on-surface">{room.quiz?.title ?? '…'}</div>
            <div className="text-label-sm text-on-surface-variant">
              PIN #{state.joinCode} · {t(`host.remote.status.${status}`)}
            </div>
          </div>
        </div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${room.stateError ? 'bg-error' : 'animate-pulse bg-tertiary'}`} />
      </header>

      {room.error && <ErrorBanner>{room.error}</ErrorBanner>}

      <section className="rounded-2xl bg-surface-container-low p-space-md shadow-lg" data-testid="remote-question">
        {focus ? (
          <>
            <span className="text-label-sm uppercase tracking-widest text-primary">
              {t(status === 'LOBBY' || status === 'PAUSE_BREAK' ? 'host.room.upNext' : 'host.common.question')} {focusIndex + 1} /{' '}
              {room.questions.length}
            </span>
            <p className="mt-1 line-clamp-4 text-headline-sm text-on-surface">{focus.prompt}</p>
            {status === 'QUESTION_REVEAL' && upcoming && (
              <p className="mt-space-xs truncate text-body-sm text-on-surface-variant" data-testid="remote-up-next">
                {t('host.room.upNext')}: {upcoming.prompt}
              </p>
            )}
          </>
        ) : (
          <p className="text-body-md text-on-surface-variant">
            {t(room.questions.length ? 'host.room.allPlayed' : 'host.room.noQuestions')}
          </p>
        )}
        <div className="mt-space-sm flex flex-wrap items-center gap-space-md text-label-md">
          {remaining !== null && (
            <span className={`font-bold ${paused ? 'text-secondary' : 'text-on-surface'}`} data-testid="remote-timer">
              {paused ? t('play.question.paused') : `${remaining} ${plural('count.seconds', remaining)}`}
            </span>
          )}
          {state.answeredCount !== null && (
            <span className="flex items-center gap-1 text-tertiary" data-testid="remote-answered">
              <Users className="h-4 w-4" />
              {state.answeredCount} / {teams}
            </span>
          )}
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-space-sm">
        <div className="grid grid-cols-2 gap-space-sm">
          {slot && (
            <button
              type="button"
              className={`${btn.secondary} min-h-[56px]`}
              disabled={room.busy}
              onClick={() => void runRoomCommand(room, 'back')}
              data-testid="remote-clip"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 text-tertiary" />}
              {t(playing ? 'host.room.media.pause' : 'host.room.media.play')}
            </button>
          )}
          {status === 'QUESTION_REVEAL' && (
            <button
              type="button"
              className={`${btn.secondary} min-h-[56px]`}
              disabled={room.busy}
              onClick={() => void runRoomCommand(room, 'blank')}
              data-testid="remote-break"
            >
              <Coffee className="h-5 w-5 text-secondary" />
              {t('host.room.pause')}
            </button>
          )}
          {remaining !== null && (remaining > 0 || paused) && (
            <>
              <button
                type="button"
                className={`${btn.secondary} min-h-[56px]`}
                disabled={room.busy}
                onClick={() => void room.controlTimer(paused ? 'resume' : 'pause')}
                data-testid="remote-timer-pause"
              >
                {paused ? <Play className="h-5 w-5 text-tertiary" /> : <Pause className="h-5 w-5" />}
                {t(paused ? 'host.room.resumeTimer' : 'host.room.pauseTimer')}
              </button>
              <button
                type="button"
                className={`${btn.secondary} min-h-[56px] text-secondary`}
                disabled={room.busy}
                onClick={() => void room.controlTimer('extend')}
                data-testid="remote-timer-extend"
              >
                <AlarmClockPlus className="h-5 w-5" />
                +10 s
              </button>
            </>
          )}
        </div>

        {canFinish ? (
          <button
            type="button"
            className={`${btn.gold} min-h-[88px] text-headline-sm`}
            onClick={() => setConfirm('finish')}
            data-testid="remote-finish"
          >
            <Flag className="h-6 w-6" />
            {t('host.room.finishQuiz')}
          </button>
        ) : (
          <button
            type="button"
            className={`${btn.primary} min-h-[88px] text-headline-sm`}
            disabled={room.busy || !nextLabel}
            onClick={next}
            data-testid="remote-next"
          >
            {status === 'LOBBY' ? <CirclePlay className="h-7 w-7" /> : null}
            {nextLabel ? t(nextLabel) : t(`host.remote.status.${status}`)}
            {status !== 'LOBBY' && nextLabel ? <ArrowRight className="h-7 w-7" /> : null}
          </button>
        )}
      </div>

      {confirm === 'start' && (
        <ConfirmDialog
          icon={CirclePlay}
          title={t('host.room.startTitle')}
          text={`${t('host.room.startText')} ${upcoming ? `„${upcoming.prompt}“` : ''}`}
          confirmLabel={t('host.room.startConfirm')}
          busy={room.busy}
          onConfirm={() => {
            setConfirm(null);
            void room.transition('LOCK_IN_ROUND');
          }}
          onClose={() => setConfirm(null)}
          testId="remote-start-dialog"
        />
      )}
      {confirm === 'finish' && (
        <ConfirmDialog
          icon={Flag}
          tone="danger"
          title={t('host.room.endTitle')}
          text={t('host.room.endText')}
          confirmLabel={t('host.room.endConfirm')}
          busy={room.busy}
          onConfirm={() => {
            setConfirm(null);
            void room.transition('FINISHED');
          }}
          onClose={() => setConfirm(null)}
          testId="remote-finish-dialog"
        />
      )}
    </div>
  );
}
