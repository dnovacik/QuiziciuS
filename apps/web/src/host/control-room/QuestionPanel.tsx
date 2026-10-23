import { useEffect, useState } from 'react';
import { AlarmClockPlus, ArrowRight, Check, CheckCircle2, Coffee, Eye, Flag, ListChecks, Lock, Pause, Play } from 'lucide-react';
import type { AnswerSummaryDto } from '@quizicius/shared-types';
import { useI18n } from '../../lib/i18n';
import { optionLetter, rankTeams, secondsLeft, useNow } from '../../lib/quiz';
import { Pending } from '../../ui/Pending';
import type { Question } from '../api';
import { btn } from '../ui';
import type { ControlRoom } from './use-control-room';

/** Short form of a team's response for lists and tables. */
export function responseLabel(question: Question | null, answer: AnswerSummaryDto): string {
  const response = (answer.response ?? {}) as { optionId?: string; text?: string; value?: number };
  if (question?.type === 'MULTIPLE_CHOICE') {
    const index = question.options?.findIndex((option) => option.id === response.optionId) ?? -1;
    return index >= 0 ? `${optionLetter(index)}) ${question.options![index].label}` : '—';
  }
  return String(response.text ?? response.value ?? '—');
}

export function correctLabel(question: Question): string {
  if (question.type === 'MULTIPLE_CHOICE') {
    const index = question.options?.findIndex((option) => option.isCorrect) ?? -1;
    return index >= 0 ? `${optionLetter(index)}) ${question.options![index].label}` : '—';
  }
  if (question.type === 'FREE_TEXT') return question.accepted_answers?.join(', ') ?? '—';
  return question.correct_numeric === null ? '—' : String(question.correct_numeric);
}

export function QuestionPanel({ room, onReview, onEnd }: { room: ControlRoom; onReview: () => void; onEnd: () => void }) {
  const { t } = useI18n();
  const state = room.state!;
  const now = useNow();
  const status = state.status;
  const showingCurrent = status === 'LOCK_IN_ROUND' || status === 'QUESTION_ACTIVE' || status === 'QUESTION_REVEAL';
  const focus = showingCurrent ? room.currentQuestion : (room.questions.find((question) => question.id === room.selectedId) ?? null);
  const focusIndex = focus ? room.questions.findIndex((question) => question.id === focus.id) : -1;
  const remaining = status === 'QUESTION_ACTIVE' ? secondsLeft(state.questionEndsAt, now) : null;
  const canPick = status === 'LOBBY' || status === 'QUESTION_REVEAL' || status === 'PAUSE_BREAK';
  const answers = showingCurrent ? room.answers : [];
  const answeredTeams = new Set(answers.map((answer) => answer.teamId));
  const ranked = rankTeams(state.teams);
  const mediaUrl = useMediaUrl(room, focus);

  return (
    <section className="grid grid-cols-1 items-start gap-space-md lg:grid-cols-12" data-testid="room-question">
      <div className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-md shadow-xl lg:col-span-3">
        <div className="flex items-center justify-between pb-space-xs">
          <div>
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('host.room.overview')}</span>
            <h3 className="text-headline-sm text-on-surface">{t('host.editor.questions')}</h3>
          </div>
          <span className="rounded bg-surface-container-high px-space-xs py-1 text-label-sm text-primary">
            {room.played.length} / {room.questions.length}
          </span>
        </div>
        <ol className="mt-space-xs flex max-h-[520px] flex-col gap-1.5 overflow-y-auto pr-1">
          {room.questions.map((question, index) => {
            const live = showingCurrent && question.id === room.currentQuestion?.id;
            const done = room.played.includes(question.id) && !live;
            const next = !live && question.id === room.selectedId;
            return (
              <li key={question.id}>
                <button
                  type="button"
                  disabled={!canPick || live}
                  onClick={() => room.setSelectedId(question.id)}
                  data-testid={`room-question-${question.id}`}
                  data-state={live ? 'live' : next ? 'next' : done ? 'done' : 'waiting'}
                  className={`flex w-full items-center justify-between gap-space-sm rounded-xl p-space-sm text-left transition-colors ${
                    live || next
                      ? 'bg-surface-container-high shadow-md'
                      : done
                        ? 'bg-surface-container hover:bg-surface-container-high'
                        : 'bg-surface-container/60 opacity-80 hover:opacity-100'
                  } disabled:cursor-default`}
                >
                  <div className="flex min-w-0 items-center gap-space-sm">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-label-sm ${
                        live
                          ? 'bg-primary font-bold text-on-primary'
                          : done
                            ? 'bg-tertiary-container/30 text-tertiary'
                            : next
                              ? 'bg-secondary text-on-secondary'
                              : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className={`text-label-md ${live ? 'font-bold text-primary' : 'text-on-surface'}`}>
                        {t('host.common.question')} {index + 1}
                      </span>
                      <span className="truncate text-body-sm text-on-surface-variant">
                        {question.prompt} • {question.points}
                        {t('host.common.pointsShort')}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded px-space-xs py-0.5 text-label-sm ${
                      live
                        ? 'bg-primary-container text-on-primary-container'
                        : next
                          ? 'bg-secondary/20 text-secondary'
                          : done
                            ? 'text-tertiary'
                            : 'text-outline'
                    }`}
                  >
                    {t(live ? 'host.room.qLive' : next ? 'host.room.qNext' : done ? 'host.room.qDone' : 'host.room.qWaiting')}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-lg shadow-xl lg:col-span-6">
        {focus ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-space-xs pb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="rounded-full bg-primary-container/20 px-space-sm py-1 text-label-sm uppercase tracking-wide text-primary">
                  {t(showingCurrent ? `host.status.${status}` : 'host.room.upNext')}
                </span>
                <span className="rounded bg-surface-container px-space-xs py-1 text-label-sm text-on-surface-variant">
                  {t(`host.editor.typeShort.${focus.type}`)}
                </span>
              </div>
              <span className="rounded-full bg-surface-container px-space-sm py-1 text-label-sm text-on-surface">
                {focus.points} {t('host.common.pointsShort')}
              </span>
            </div>
            <div>
              <span className="text-label-sm uppercase tracking-widest text-primary">
                {t('host.common.question')} {focusIndex + 1} / {room.questions.length}
              </span>
              <h2 className="mt-1 text-headline-lg leading-snug tracking-tight text-on-surface" data-testid="room-focus-prompt">
                {focus.prompt}
              </h2>
            </div>

            {(mediaUrl || status === 'QUESTION_ACTIVE') && (
              <div className="grid grid-cols-1 items-center gap-space-md rounded-2xl bg-surface-container p-space-md sm:grid-cols-12">
                {mediaUrl && (
                  <div
                    className={`relative overflow-hidden rounded-xl shadow-md ${status === 'QUESTION_ACTIVE' ? 'sm:col-span-5' : 'sm:col-span-12'}`}
                  >
                    {focus.media_type === 'video' ? (
                      <video src={mediaUrl} controls preload="metadata" className="h-32 w-full bg-black object-contain" />
                    ) : (
                      <img src={mediaUrl} alt={t('play.question.image')} className="h-32 w-full object-cover" />
                    )}
                  </div>
                )}
                {status === 'QUESTION_ACTIVE' && remaining !== null && (
                  <div
                    className={`flex flex-col items-center justify-center gap-space-xs p-space-xs ${mediaUrl ? 'sm:col-span-7' : 'sm:col-span-12'}`}
                  >
                    <div className="flex items-center justify-center gap-space-md">
                      <Ring seconds={remaining} total={focus.time_limit_seconds} />
                      <Pending feature="timer-controls">
                        <div className="flex flex-col gap-1.5">
                          <span className={`${btn.secondary} px-space-sm py-1 text-label-sm`}>
                            <Pause className="h-4 w-4" />
                            {t('host.room.pauseTimer')}
                          </span>
                          <span className={`${btn.secondary} px-space-sm py-1 text-label-sm text-secondary`}>
                            <AlarmClockPlus className="h-4 w-4" />
                            +10 s
                          </span>
                        </div>
                      </Pending>
                    </div>
                  </div>
                )}
              </div>
            )}

            {focus.type === 'MULTIPLE_CHOICE' ? (
              <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2" data-testid="room-distribution">
                {(focus.options ?? []).map((option, index) => {
                  const count = answers.filter((answer) => (answer.response as { optionId?: string })?.optionId === option.id).length;
                  return (
                    <div
                      key={option.id}
                      className={`flex items-center justify-between rounded-xl p-space-sm ${option.isCorrect ? 'bg-primary-container/20 shadow-[0_0_12px_rgba(160,120,255,0.2)]' : 'bg-surface-container'}`}
                    >
                      <div className="flex min-w-0 items-center gap-space-sm">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-label-md font-bold ${
                            option.isCorrect ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface'
                          }`}
                        >
                          {optionLetter(index)}
                        </span>
                        <span className={`truncate text-body-md ${option.isCorrect ? 'font-bold text-primary' : 'text-on-surface'}`}>
                          {option.label}
                          {option.isCorrect && ` (${t('host.room.correct')})`}
                        </span>
                      </div>
                      {showingCurrent && (
                        <span
                          className={`shrink-0 text-label-sm ${option.isCorrect ? 'font-bold text-primary' : 'text-on-surface-variant'}`}
                        >
                          {count} {t('host.room.teamsShort')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-primary-container/20 p-space-sm">
                <span className="text-label-md text-primary">
                  {t('host.room.correct')}: <strong>{correctLabel(focus)}</strong>
                </span>
                {showingCurrent && (
                  <span className="text-label-sm text-on-surface-variant">
                    {answers.length} {t('host.room.answersShort')}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="py-space-xl text-center text-body-lg text-on-surface-variant" data-testid="room-all-played">
            {t(room.questions.length ? 'host.room.allPlayed' : 'host.room.noQuestions')}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-space-sm pt-space-sm" data-testid="room-actions">
          {status === 'LOBBY' && (
            <button
              type="button"
              className={`${btn.primary} flex-1 py-3`}
              disabled={room.busy || !room.selectedId}
              onClick={() => void room.transition('LOCK_IN_ROUND')}
              data-testid="room-action-lock-in"
            >
              <Play className="h-5 w-5" />
              {t('host.room.start')}
            </button>
          )}
          {status === 'LOCK_IN_ROUND' && (
            <button
              type="button"
              className={`${btn.primary} flex-1 py-3`}
              disabled={room.busy}
              onClick={() => void room.transition('QUESTION_ACTIVE')}
              data-testid="room-action-show"
            >
              <Eye className="h-5 w-5" />
              {t('host.room.showQuestion')}
            </button>
          )}
          {status === 'QUESTION_ACTIVE' && (
            <>
              <Pending feature="timer-controls" className="flex-1">
                <span className={`${btn.secondary} w-full py-3`}>
                  <Lock className="h-5 w-5 text-secondary" />
                  {t('host.room.stopAnswers')}
                </span>
              </Pending>
              <button
                type="button"
                className={`${btn.primary} flex-1 py-3`}
                disabled={room.busy}
                onClick={() => void room.transition('QUESTION_REVEAL')}
                data-testid="room-action-reveal"
              >
                <Eye className="h-5 w-5" />
                {t('host.room.reveal')}
              </button>
            </>
          )}
          {status === 'QUESTION_REVEAL' && (
            <>
              <button
                type="button"
                className={`${btn.secondary} flex-1 py-3 text-tertiary`}
                onClick={onReview}
                data-testid="room-action-review"
              >
                <ListChecks className="h-5 w-5" />
                {t('host.room.evaluate')}
              </button>
              <button
                type="button"
                className={`${btn.secondary} flex-1 py-3`}
                disabled={room.busy}
                onClick={() => void room.transition('PAUSE_BREAK')}
                data-testid="room-action-pause"
              >
                <Coffee className="h-5 w-5 text-secondary" />
                {t('host.room.pause')}
              </button>
            </>
          )}
          {(status === 'QUESTION_REVEAL' || status === 'PAUSE_BREAK') &&
            (room.selectedId ? (
              <button
                type="button"
                className={`${btn.primary} flex-1 py-3`}
                disabled={room.busy}
                onClick={() => void room.transition('LOCK_IN_ROUND')}
                data-testid="room-action-next"
              >
                {t('host.room.next')}
                <ArrowRight className="h-5 w-5" />
              </button>
            ) : (
              <button type="button" className={`${btn.gold} flex-1 py-3`} onClick={onEnd} data-testid="room-action-finish">
                <Flag className="h-5 w-5" />
                {t('host.room.finishQuiz')}
              </button>
            ))}
        </div>
      </div>

      <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-md shadow-xl lg:col-span-3">
        <div>
          <div className="flex items-center justify-between pb-1">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('host.room.submitted')}</span>
            <span className="text-label-md font-bold text-tertiary" data-testid="room-answered-count">
              {answeredTeams.size} / {state.teams.length}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-container to-tertiary transition-all duration-500"
              style={{ width: `${state.teams.length ? (answeredTeams.size / state.teams.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <ul className="flex max-h-[380px] flex-col gap-1.5 overflow-y-auto pr-1">
          {state.teams.map((team) => {
            const answer = answers.find((row) => row.teamId === team.id);
            return (
              <li
                key={team.id}
                className={`flex items-center justify-between rounded-lg p-space-xs px-space-sm ${answer ? 'bg-surface-container' : 'bg-secondary/10'}`}
              >
                <div className="flex items-center gap-space-xs truncate">
                  {answer ? (
                    <CheckCircle2 className="h-4 w-4 text-tertiary" />
                  ) : (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
                  )}
                  <span className={`truncate text-label-sm ${answer ? 'text-on-surface' : 'text-secondary'}`}>{team.name}</span>
                </div>
                <span className={`shrink-0 text-label-sm ${answer ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                  {answer
                    ? responseLabel(room.currentQuestion, answer).slice(0, 18)
                    : showingCurrent && status !== 'LOCK_IN_ROUND'
                      ? t('host.room.thinking')
                      : ''}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="rounded-xl bg-surface-container p-space-sm">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('host.room.top3')}</span>
          <ol className="mt-1 flex flex-col gap-1">
            {ranked.slice(0, 3).map((team, index) => (
              <li key={team.id} className="flex items-center justify-between text-label-sm">
                <span
                  className={index === 0 ? 'font-bold text-secondary' : index === 1 ? 'font-bold text-primary' : 'text-on-surface-variant'}
                >
                  {team.rank}. {team.name}
                </span>
                <span className="text-on-surface">
                  {team.score} {t('host.common.pointsShort')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function useMediaUrl(room: ControlRoom, question: Question | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const { mediaUrl } = room;
  useEffect(() => {
    setUrl(null);
    if (!question?.media_path) return;
    let active = true;
    mediaUrl(question)
      .then((value) => active && setUrl(value))
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
    };
  }, [question, mediaUrl]);
  return url;
}

function Ring({ seconds, total }: { seconds: number; total: number }) {
  const { t } = useI18n();
  const fraction = total > 0 ? Math.min(1, seconds / total) : 0;
  return (
    <div
      className="relative flex h-20 w-20 items-center justify-center"
      role="timer"
      aria-label={`${seconds} ${t('play.seconds')}`}
      data-testid="room-timer"
    >
      <svg aria-hidden="true" className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
        <circle
          className="text-surface-container-highest"
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <circle
          className={`${seconds <= 5 ? 'text-red-400' : 'text-secondary'} transition-all duration-1000 ease-linear`}
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${fraction * 100}, 100`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-headline-lg leading-none text-secondary">{seconds}</span>
        <span className="text-label-sm text-on-surface-variant">{t('play.secondsShort')}</span>
      </div>
    </div>
  );
}
