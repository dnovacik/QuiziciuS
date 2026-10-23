import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, DoorOpen, HelpCircle, LogOut, MonitorPlay, PauseCircle, Timer, Trophy, Tv, Users } from 'lucide-react';
import type { QuizState } from '@quizicius/shared-types';
import { useI18n } from '../../lib/i18n';
import { secondsLeft, useNow } from '../../lib/quiz';
import { LanguageSwitcher } from '../../ui/LanguageSwitcher';
import { LogoMark } from '../../ui/Logo';
import { Pending } from '../../ui/Pending';
import { btn, ConfirmDialog, ErrorBanner } from '../ui';
import { LobbyPanel } from './LobbyPanel';
import { QuestionPanel } from './QuestionPanel';
import { ResultsPanel } from './ResultsPanel';
import { ReviewPanel } from './ReviewPanel';
import { useControlRoom } from './use-control-room';

type Tab = 'lobby' | 'question' | 'review' | 'results';

const TAB_FOR_STATUS: Record<QuizState, Tab> = {
  LOBBY: 'lobby',
  LOCK_IN_ROUND: 'question',
  QUESTION_ACTIVE: 'question',
  QUESTION_REVEAL: 'question',
  PAUSE_BREAK: 'question',
  FINISHED: 'results',
};

const TABS: { tab: Tab; icon: typeof DoorOpen }[] = [
  { tab: 'lobby', icon: DoorOpen },
  { tab: 'question', icon: Tv },
  { tab: 'review', icon: ClipboardCheck },
  { tab: 'results', icon: Trophy },
];

/** Stitch "Live Quiz Control Room (Živá réžia moderátora)". */
export function ControlRoomPage({ token }: { token: string }) {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const { t, plural } = useI18n();
  const room = useControlRoom(token, sessionId);
  const { state } = room;
  const [tab, setTab] = useState<Tab>('lobby');
  const [ending, setEnding] = useState(false);
  const now = useNow();

  // Follow the game: every state change brings the matching tab to the front.
  useEffect(() => {
    if (state?.status) setTab(TAB_FOR_STATUS[state.status]);
  }, [state?.status]);

  const finished = state?.status === 'FINISHED';
  const remaining = state?.status === 'QUESTION_ACTIVE' ? secondsLeft(state.questionEndsAt, now) : null;
  const online = state?.teams.filter((team) => team.isActive).length ?? 0;
  const projectorUrl = `/projector/${sessionId}`;

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface" data-testid="control-room">
      <header className="fixed top-0 z-50 w-full bg-surface-container-lowest/85 shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="flex h-16 w-full items-center justify-between gap-space-md px-gutter sm:px-gutter-lg">
          <div className="flex min-w-0 items-center gap-space-md">
            <Link to="/host" className={btn.icon} aria-label={t('host.room.back')} data-testid="room-back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <LogoMark size="sm" />
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="text-headline-sm tracking-tight text-on-surface">QuiziciuS</span>
                <span className="rounded-full bg-secondary/15 px-space-xs py-0.5 text-label-sm uppercase tracking-wider text-secondary">
                  Host Live
                </span>
              </div>
              <span className="text-label-sm text-on-surface-variant">
                {t('projector.room')} #{state?.joinCode ?? room.session?.join_code ?? '…'}
              </span>
            </div>
            <div className="hidden items-center gap-space-xs rounded-full bg-surface-container-high/60 px-space-sm py-1 sm:flex">
              <span className={`h-2 w-2 rounded-full ${room.stateError ? 'bg-error' : 'animate-pulse bg-tertiary'}`} />
              <span className={`text-label-sm ${room.stateError ? 'text-error' : 'text-tertiary'}`}>
                {room.stateError ? t('projector.offline') : 'SYNCED'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <a
              className={`${btn.secondary} hidden px-space-sm py-1.5 md:inline-flex`}
              href={projectorUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="room-projector"
            >
              <MonitorPlay className="h-[18px] w-[18px] text-secondary" />
              {t('host.session.projector')}
            </a>
            <LanguageSwitcher />
            {!finished && (
              <button
                type="button"
                className={`${btn.secondary} px-space-sm py-1.5 text-on-surface-variant hover:bg-error/20 hover:text-error`}
                onClick={() => setEnding(true)}
                data-testid="room-end"
              >
                <LogOut className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">{t('host.room.end')}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full flex-1 pt-16">
        <section className="w-full bg-surface-container-lowest px-gutter py-space-sm shadow-md sm:px-gutter-lg">
          <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-space-sm md:flex-row md:items-center">
            <div className="flex items-center gap-space-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${finished ? 'bg-outline' : 'animate-ping bg-tertiary'}`} />
              <div className="flex flex-col">
                <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('host.room.mode')}</span>
                <span className="text-headline-sm tracking-tight text-on-surface" data-testid="room-quiz-title">
                  {room.quiz?.title ?? '…'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-container-low p-1 shadow-inner" role="tablist">
              {TABS.map(({ tab: value, icon: Icon }, index) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  data-testid={`room-tab-${value}`}
                  onClick={() => setTab(value)}
                  className={`flex items-center gap-1.5 rounded-lg px-space-md py-1.5 text-label-md transition-all ${
                    tab === value
                      ? 'bg-primary-container text-on-primary-container shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {index + 1}. {t(`host.room.tab.${value}`)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-space-lg px-gutter py-space-lg sm:px-gutter-lg">
          {(room.error || room.stateError) && <ErrorBanner>{room.error ?? room.stateError}</ErrorBanner>}
          {!state ? (
            <div className="flex justify-center py-space-xl" aria-busy="true">
              <span className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {tab === 'lobby' && <LobbyPanel room={room} sessionId={sessionId} onCancel={() => setEnding(true)} />}
              {tab === 'question' && <QuestionPanel room={room} onReview={() => setTab('review')} onEnd={() => setEnding(true)} />}
              {tab === 'review' && <ReviewPanel room={room} token={token} sessionId={sessionId} onDone={() => setTab('results')} />}
              {tab === 'results' && <ResultsPanel room={room} projectorUrl={projectorUrl} />}
            </>
          )}
        </div>
      </main>

      <aside className="sticky bottom-0 z-40 w-full bg-surface-container-lowest/95 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-space-sm px-gutter text-label-sm text-on-surface-variant sm:px-gutter-lg">
          <div className="flex items-center gap-space-md truncate">
            <div className="flex items-center gap-space-xs rounded-full bg-primary-container/20 px-space-sm py-1 text-primary">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-bold tracking-wider">PIN #{state?.joinCode ?? '…'}</span>
            </div>
            {state?.currentQuestion && (
              <span className="hidden items-center gap-1.5 text-on-surface sm:flex">
                <HelpCircle className="h-4 w-4 text-secondary" />
                {t('host.common.question')} {state.currentQuestion.orderIndex + 1}/{room.questions.length}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-space-md">
            {remaining !== null && (
              <span
                className="flex items-center gap-1.5 rounded-lg bg-surface-container px-space-sm py-1 font-bold text-secondary"
                data-testid="room-bottom-timer"
              >
                <Timer className="h-4 w-4" />
                {remaining}s
              </span>
            )}
            <span className="hidden items-center gap-1.5 md:flex">
              <Users className="h-4 w-4 text-tertiary" />
              {online} {plural('count.teamsOnline', online)}
            </span>
            <Pending feature="timer-controls" badge="inline">
              <span className="flex items-center gap-1 rounded-lg bg-error-container/20 px-space-sm py-1 text-error">
                <PauseCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{t('host.room.hostPause')}</span>
              </span>
            </Pending>
          </div>
        </div>
      </aside>

      {ending && (
        <ConfirmDialog
          icon={LogOut}
          tone="danger"
          title={t(state?.status === 'LOBBY' ? 'host.room.cancelTitle' : 'host.room.endTitle')}
          text={t(state?.status === 'LOBBY' ? 'host.room.cancelText' : 'host.room.endText')}
          confirmLabel={t('host.room.endConfirm')}
          busy={room.busy}
          onConfirm={() => {
            setEnding(false);
            void room.transition('FINISHED');
          }}
          onClose={() => setEnding(false)}
          testId="room-end-dialog"
        />
      )}
    </div>
  );
}
