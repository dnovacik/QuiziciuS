import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CloudOff, MousePointerClick, RefreshCw, Volume2 } from 'lucide-react';
import { forwardClickerCommands, type ClickerFeedback } from '../lib/clicker';
import { useI18n } from '../lib/i18n';
import { useSessionDisplay } from '../lib/use-quiz-title';
import { usePreloadQuestionMedia } from '../lib/use-current-question-media';
import { useSessionState } from '../lib/use-session-state';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Logo } from '../ui/Logo';
import { FinishedScene, LeaderboardScene, PauseScene } from './StandingsScenes';
import { LobbyScene } from './LobbyScene';
import { ProjectorSound } from './MediaPlayer';
import { LockInScene, QuestionScene } from './QuestionScenes';

/** How long a clicker notice stays on the big screen. */
const CLICKER_NOTICE_MS = 3500;

/** Big-screen view for the room — Stitch "Projector View (Veľkoplošná projekcia v sále)". */
export default function ProjectorApp() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useI18n();
  const { state, error, refetch } = useSessionState(sessionId);
  usePreloadQuestionMedia(sessionId, state?.currentQuestion?.id, state?.status, { clips: true });
  const { title, pub } = useSessionDisplay(sessionId);
  // Browsers only let a page play sound after someone has clicked it: any click on the projector counts.
  const [sound, setSound] = useState(false);
  useEffect(() => {
    if (sound) return;
    // Only input the browser counts as interaction unlocks sound (Esc, for one, does not).
    const enable = () => {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      setSound(true);
    };
    document.addEventListener('pointerdown', enable);
    document.addEventListener('keydown', enable);
    return () => {
      document.removeEventListener('pointerdown', enable);
      document.removeEventListener('keydown', enable);
    };
  }, [sound]);

  // A clicker plugged into this machine drives the control room open in the same browser.
  // Presses that did nothing come back as a short notice, so the host knows without the laptop.
  const [clickerNotice, setClickerNotice] = useState<{ feedback: ClickerFeedback; at: number } | null>(null);
  useEffect(
    () => (sessionId ? forwardClickerCommands(sessionId, (feedback) => setClickerNotice({ feedback, at: Date.now() })) : undefined),
    [sessionId],
  );
  useEffect(() => {
    if (!clickerNotice) return;
    const timer = window.setTimeout(() => setClickerNotice(null), CLICKER_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [clickerNotice]);

  // Realtime events drive the screen; a slow poll covers a dropped websocket on the venue Wi-Fi.
  useEffect(() => {
    const timer = setInterval(refetch, 15000);
    return () => clearInterval(timer);
  }, [refetch]);

  return (
    <ProjectorSound.Provider value={sound}>
      <div data-testid="projector-app" className="flex min-h-screen flex-col overflow-x-hidden bg-surface-container-lowest text-on-surface">
        <header className="fixed left-0 right-0 top-0 z-50 bg-surface-container-lowest/80 shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="flex h-20 w-full items-center justify-between gap-gutter px-margin-lg">
            <div className="flex items-center gap-space-lg">
              <Logo size="md" />
              {state && (
                <div className="flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-md py-space-xs shadow-[0_0_12px_rgba(255,185,95,0.15)]">
                  <span className="text-label-sm uppercase text-on-surface-variant">{t('projector.room')}</span>
                  <span className="text-label-lg font-bold tracking-wider text-secondary" data-testid="projector-room-code">
                    #{state.joinCode}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-space-lg">
              <div className="hidden items-center gap-space-xs rounded-full bg-surface-container-high px-space-md py-space-xs sm:flex">
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-error' : 'animate-ping bg-tertiary'}`}
                  />
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${error ? 'bg-error' : 'bg-tertiary'}`} />
                </span>
                <span className={`text-label-sm uppercase ${error ? 'text-error' : 'text-tertiary'}`}>
                  {error ? t('projector.offline') : 'LIVE'}
                </span>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <main className="relative flex w-full flex-1 flex-col justify-center px-margin-lg pb-margin-lg pt-24">
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-container/15 blur-[128px]" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-secondary-container/15 blur-[128px]" />
          <div className="relative mx-auto w-full max-w-[1720px]">
            {!state ? (
              <div className="flex justify-center py-space-xl" data-testid="projector-loading">
                <span className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <Scene state={state} sessionId={sessionId!} title={title} pub={pub} />
            )}
          </div>

          {error && state && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-surface-container-lowest/90 p-space-lg backdrop-blur-2xl"
              data-testid="projector-offline"
              role="alert"
            >
              <div className="flex w-full max-w-md flex-col items-center rounded-xl bg-surface-container-high p-space-xl text-center shadow-2xl">
                <div className="mb-space-md flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-error-container text-on-error-container">
                  <CloudOff className="h-9 w-9" />
                </div>
                <h3 className="text-headline-md font-extrabold text-on-surface">{t('projector.offlineTitle')}</h3>
                <p className="mt-space-xs text-body-md text-on-surface-variant">{t('projector.offlineText')}</p>
                <button
                  type="button"
                  onClick={refetch}
                  className="mt-space-lg flex w-full items-center justify-center gap-space-xs rounded-lg bg-primary-container px-space-md py-space-sm text-label-lg font-bold text-on-primary-container"
                >
                  <RefreshCw className="h-[18px] w-[18px]" />
                  {t('projector.retry')}
                </button>
              </div>
            </div>
          )}

          {clickerNotice && (
            <div
              key={clickerNotice.at}
              role="status"
              className="fixed bottom-space-lg left-1/2 z-[55] flex -translate-x-1/2 items-center gap-space-sm rounded-full bg-surface-container-highest/95 px-space-lg py-space-sm text-headline-sm text-on-surface shadow-2xl"
              data-testid="projector-clicker-notice"
              data-feedback={clickerNotice.feedback}
            >
              <MousePointerClick
                className={`h-6 w-6 ${clickerNotice.feedback === 'error' || clickerNotice.feedback === 'noResponse' ? 'text-error' : 'text-secondary'}`}
              />
              {t(`projector.clicker.${clickerNotice.feedback}`)}
            </div>
          )}

          {!sound && (
            <button
              type="button"
              className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-container-lowest/70 p-space-lg backdrop-blur-sm"
              data-testid="projector-sound-overlay"
            >
              <span className="flex max-w-md flex-col items-center gap-space-sm rounded-xl bg-surface-container-high p-space-xl text-center shadow-2xl">
                <Volume2 className="h-14 w-14 text-secondary" />
                <span className="text-headline-md font-extrabold text-on-surface">{t('projector.sound.title')}</span>
                <span className="text-body-md text-on-surface-variant">{t('projector.sound.text')}</span>
              </span>
            </button>
          )}
        </main>
      </div>
    </ProjectorSound.Provider>
  );
}

function Scene({
  state,
  sessionId,
  title,
  pub,
}: {
  state: NonNullable<ReturnType<typeof useSessionState>['state']>;
  sessionId: string;
  title: string | null;
  pub: string | null;
}) {
  const question = state.currentQuestion;
  switch (state.status) {
    case 'LOBBY':
      return <LobbyScene state={state} sessionId={sessionId} title={title} pub={pub} />;
    case 'LOCK_IN_ROUND':
      return <LockInScene question={question} teams={state.teams} />;
    case 'QUESTION_ACTIVE':
      return question ? <QuestionScene state={state} question={question} /> : <LockInScene question={null} />;
    case 'QUESTION_REVEAL':
      if (!question) return <LockInScene question={null} />;
      // Standings join the answer only when the host publishes them for this question.
      return (
        <div className="flex flex-col gap-space-lg">
          <QuestionScene state={state} question={question} />
          {state.scoresVisible && <LeaderboardScene teams={state.teams} />}
        </div>
      );
    case 'PAUSE_BREAK':
      return (
        <div className="flex flex-col gap-space-lg">
          <PauseScene endsAt={state.breakEndsAt} message={state.breakMessage} />
          {state.scoresVisible && <LeaderboardScene teams={state.teams} />}
        </div>
      );
    case 'FINISHED':
      return <FinishedScene teams={state.teams} />;
  }
}
