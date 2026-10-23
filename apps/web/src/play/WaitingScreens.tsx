import { useState } from 'react';
import { Brain, CheckCircle2, Coffee, Lightbulb, Radio, Users, Zap } from 'lucide-react';
import type { QuizSessionStateDto } from '@quizicius/shared-types';
import { useI18n } from '../lib/i18n';
import { rankTeams } from '../lib/quiz';
import { PlayerShell } from './PlayerShell';
import { StandingPill, StatusCard } from './parts';

function QuizBanner({ title }: { title: string | null }) {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-md shadow-md">
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-secondary/10 blur-2xl" />
      <div className="relative z-10 flex flex-col gap-1.5">
        <span className="text-label-sm uppercase tracking-wider text-secondary">{t('play.lobby.tonight')}</span>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-headline-sm font-bold text-on-surface" data-testid="player-quiz-title">
            {title ?? t('play.join.eventFallback')}
          </h2>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-tertiary/10 px-2 py-0.5 text-label-sm font-bold text-tertiary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tertiary" />
            LIVE
          </span>
        </div>
      </div>
    </section>
  );
}

export function LobbyScreen({ state, teamId, title }: { state: QuizSessionStateDto; teamId: string; title: string | null }) {
  const { t } = useI18n();
  const team = state.teams.find((row) => row.id === teamId);
  return (
    <PlayerShell joinCode={state.joinCode} phase="lobby" testId="player-lobby">
      <QuizBanner title={title} />

      <StatusCard icon={Radio} spin badge={t('play.lobby.badge')} title={t('play.lobby.title')} testId="player-lobby-status">
        <p className="mt-space-xs max-w-[310px] text-body-sm text-on-surface-variant">{t('play.lobby.subtitle')}</p>
        <div className="mt-space-md flex items-center gap-2 rounded-full bg-surface-container-lowest/80 px-space-md py-1.5 shadow-sm">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-label-md text-on-surface">
            <span className="font-bold text-primary" data-testid="player-team-count">
              {state.teams.length}
            </span>{' '}
            {t('play.lobby.teamsConnected')}
          </span>
        </div>
      </StatusCard>

      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-md shadow-md">
        <div className="flex items-center justify-between gap-space-sm">
          <div className="flex min-w-0 items-center gap-space-sm">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-container shadow-[0_0_16px_rgba(160,120,255,0.35)]">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/30 to-tertiary/20" />
              <Brain className="relative z-10 h-8 w-8 text-primary" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm font-bold uppercase text-primary">{t('play.lobby.ourTeam')}</span>
              <h2 className="truncate text-headline-sm font-extrabold text-on-surface" data-testid="player-team-name-display">
                {team?.name ?? '—'}
              </h2>
              <span className="mt-0.5 flex items-center gap-1 text-body-sm font-semibold text-tertiary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('play.lobby.registered')}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-label-sm font-bold uppercase text-on-surface-variant">{t('play.lobby.code')}</span>
            <span className="text-headline-sm font-extrabold tracking-wider text-secondary">#{state.joinCode}</span>
          </div>
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-xl bg-surface-container-high/60 p-space-md shadow-sm">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/15">
          <Lightbulb className="h-[18px] w-[18px] text-secondary" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-label-sm font-bold uppercase text-secondary">{t('play.lobby.tipTitle')}</span>
          <p className="text-body-sm leading-relaxed text-on-surface-variant">{t('play.lobby.tip')}</p>
        </div>
      </section>
    </PlayerShell>
  );
}

/** Between questions: one tap from the player lets the browser enter fullscreen for the round. */
export function LockInScreen({ state, teamId, onReady }: { state: QuizSessionStateDto; teamId: string; onReady: () => Promise<void> }) {
  const { t } = useI18n();
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  // Comes back from the server, so it survives a reload and resets for the next question.
  const ready = state.teams.find((team) => team.id === teamId)?.ready ?? false;
  return (
    <PlayerShell joinCode={state.joinCode} phase="lobby" testId="player-lock-in">
      <StatusCard icon={Zap} badge={t('play.lockIn.badge')} title={t('play.lockIn.title')}>
        <p className="mt-space-xs max-w-[310px] text-body-sm text-on-surface-variant">{t('play.lockIn.subtitle')}</p>
        <button
          type="button"
          data-testid="player-ready"
          disabled={sending}
          aria-pressed={ready}
          onClick={() => {
            setSending(true);
            setFailed(false);
            onReady()
              .catch(() => setFailed(true))
              .finally(() => setSending(false));
          }}
          className="mt-space-md flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-container to-inverse-primary text-label-lg font-bold text-on-primary-container shadow-[0_0_24px_-4px_rgba(160,120,255,0.45)] transition-all active:scale-[0.98]"
        >
          {ready ? <CheckCircle2 className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          {ready ? t('play.lockIn.ready') : sending ? t('common.working') : t('play.lockIn.button')}
        </button>
        {failed && (
          <p role="alert" className="mt-space-sm text-body-sm text-error" data-testid="player-ready-error">
            {t('play.lockIn.failed')}
          </p>
        )}
      </StatusCard>
    </PlayerShell>
  );
}

export function PauseScreen({ state, teamId }: { state: QuizSessionStateDto; teamId: string }) {
  const { t } = useI18n();
  const ranked = rankTeams(state.teams);
  const own = ranked.find((team) => team.id === teamId);
  return (
    <PlayerShell joinCode={state.joinCode} phase="reveal" testId="player-pause">
      <StatusCard icon={Coffee} badge={t('play.pause.badge')} title={t('play.pause.title')}>
        <p className="mt-space-xs max-w-[310px] text-body-sm text-on-surface-variant">{t('play.pause.subtitle')}</p>
      </StatusCard>
      {own && <StandingPill team={own} leader={ranked[0]} />}
    </PlayerShell>
  );
}
