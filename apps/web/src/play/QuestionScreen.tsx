import { useState, type FormEvent } from 'react';
import {
  Check,
  CircleX,
  Hourglass,
  Infinity as InfinityIcon,
  Image as ImageIcon,
  LockKeyhole,
  Minus,
  Pause,
  PencilLine,
  Plus,
  Send,
  ShieldCheck,
  Timer,
  Trophy,
  Users,
  ZoomIn,
} from 'lucide-react';
import type { AnswerSummaryDto, QuestionPublicDto, QuizSessionStateDto } from '@quizicius/shared-types';
import { apiPost } from '../lib/api-client';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { formatClock, isUntimed, optionLetter, rankTeams, secondsLeft, useNow } from '../lib/quiz';
import type { TeamSeat } from '../lib/team-seat';
import { useCurrentQuestionMedia } from '../lib/use-current-question-media';
import { ProjectorMediaCard } from '../ui/ProjectorMediaCard';
import { Modal } from '../ui/Modal';
import { PlayerShell } from './PlayerShell';
import { StandingPill, TimerRing } from './parts';
import type { SubmittedAnswer } from './submitted-answers';

/**
 * Stitch "Živá Otázka s Odpočtom" while answering, and "Odpoveď Odoslaná a Zamknutá" once sent.
 * Rendered with key={question.id}, so the draft answer resets for every question.
 */
export function QuestionScreen({
  state,
  question,
  seat,
  submitted,
  onSubmitted,
}: {
  state: QuizSessionStateDto;
  question: QuestionPublicDto;
  seat: TeamSeat;
  submitted: SubmittedAnswer | undefined;
  onSubmitted: (answer: SubmittedAnswer) => void;
}) {
  const { t, plural } = useI18n();
  const now = useNow();
  const remaining = secondsLeft(state.questionEndsAt, now, state.questionPausedAt);
  const untimed = isUntimed(question.timeLimitSeconds);
  const ranked = rankTeams(state.teams);
  const own = ranked.find((team) => team.id === seat.teamId);

  if (submitted) {
    return (
      <PlayerShell joinCode={state.joinCode} phase="locked" testId="player-locked">
        <LockedView state={state} question={question} answer={submitted} remaining={remaining} />
        <RoomProgress state={state} />
        {own && <StandingPill team={own} leader={ranked[0]} />}
      </PlayerShell>
    );
  }

  return (
    <PlayerShell joinCode={state.joinCode} phase="question" testId="player-question">
      <section className="relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-surface-container/70 p-4 shadow-lg backdrop-blur-xl">
        <div className="flex-1 pr-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
              {t('play.question.number')} {question.orderIndex + 1}
            </span>
            <span className="flex items-center gap-1 text-label-sm font-bold text-secondary">
              <Trophy className="h-3.5 w-3.5" />+{question.points} {plural('count.pointsShort', question.points)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest p-0.5">
            <div
              className="h-full rounded-full bg-secondary transition-all duration-1000 ease-linear"
              style={{ width: `${remaining === null ? 100 : untimed ? 0 : (remaining / question.timeLimitSeconds) * 100}%` }}
            />
          </div>
          <span className="mt-2 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
            <PencilLine className="h-3.5 w-3.5 text-primary" />
            {t(`play.question.type.${question.type}`)}
          </span>
        </div>
        {untimed
          ? remaining === null && (
              <span className="flex flex-col items-center text-secondary" data-testid="player-untimed" title={t('play.question.untimed')}>
                <InfinityIcon className="h-8 w-8" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t('play.question.untimedShort')}</span>
              </span>
            )
          : remaining !== null && <TimerRing seconds={remaining} total={question.timeLimitSeconds} />}
      </section>

      <RoomProgress state={state} />
      <QuestionCard state={state} question={question} />

      {remaining === 0 ? (
        <section
          role="status"
          data-testid="player-expired"
          className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-4 shadow-xl"
        >
          <Timer className="h-6 w-6 shrink-0 text-red-300" />
          <p className="text-body-md font-semibold text-on-surface">{t('play.question.expired')}</p>
        </section>
      ) : (
        <AnswerForm question={question} seat={seat} sessionId={state.id} onSubmitted={onSubmitted} />
      )}

      {own && <StandingPill team={own} leader={ranked[0]} />}
    </PlayerShell>
  );
}

/** The timer is paused by the host, and how many teams have answered so far. */
function RoomProgress({ state }: { state: QuizSessionStateDto }) {
  const { t } = useI18n();
  const teams = state.teams.filter((team) => team.isActive).length;
  if (!state.questionPausedAt && state.answeredCount === null) return null;
  return (
    <section className="flex w-full flex-wrap items-center justify-between gap-2 px-1 text-label-sm" aria-live="polite">
      {state.questionPausedAt ? (
        <span
          className="flex items-center gap-1 rounded-full bg-secondary-container/30 px-2.5 py-0.5 font-bold uppercase text-secondary"
          data-testid="player-paused"
        >
          <Pause className="h-3.5 w-3.5" />
          {t('play.question.paused')}
        </span>
      ) : (
        <span />
      )}
      {state.answeredCount !== null && (
        <span className="flex items-center gap-1 text-on-surface-variant" data-testid="player-answered">
          <Users className="h-3.5 w-3.5 text-tertiary" />
          {state.answeredCount} / {teams} {t('play.question.answered')}
        </span>
      )}
    </section>
  );
}

function QuestionCard({ state, question }: { state: QuizSessionStateDto; question: QuestionPublicDto }) {
  const { t } = useI18n();
  const { media, error } = useCurrentQuestionMedia(state.id, question.id, state.status);
  const [zoomed, setZoomed] = useState(false);

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl bg-surface-container-high/85 p-4 shadow-xl backdrop-blur-xl">
      <h1 className="text-headline-sm font-extrabold leading-snug tracking-tight text-on-surface" data-testid="player-prompt">
        {question.prompt}
      </h1>
      {media?.kind === 'image' && (
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="group relative h-40 w-full overflow-hidden rounded-xl shadow-md"
          aria-label={t('play.question.zoomImage')}
        >
          <img
            data-testid="player-question-image"
            src={media.url}
            alt={t('play.question.image')}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-surface-container-lowest/90 via-surface-container-lowest/20 to-transparent p-3">
            <span className="flex items-center gap-1 rounded-lg bg-surface-container-lowest/70 px-2 py-1 text-label-sm font-medium text-on-surface backdrop-blur-md">
              <ImageIcon className="h-3.5 w-3.5 text-secondary" />
              {t('play.question.image')}
            </span>
            <span className="flex items-center justify-center rounded-lg bg-primary p-1.5 text-on-primary shadow-lg">
              <ZoomIn className="h-[18px] w-[18px]" />
            </span>
          </div>
        </button>
      )}
      {media && media.kind !== 'image' && <ProjectorMediaCard kind={media.kind} />}
      {error && (
        <p role="alert" className="rounded-xl bg-error-container/60 p-3 text-body-sm text-on-error-container">
          {t('play.question.mediaUnavailable')}
        </p>
      )}
      {zoomed && media?.kind === 'image' && (
        <Modal labelledBy="player-image-title" onClose={() => setZoomed(false)} className="max-w-md bg-surface-container-high p-2 sm:p-2">
          <img src={media.url} alt={t('play.question.image')} className="max-h-[70vh] w-full rounded-xl object-contain" />
          <p id="player-image-title" className="p-2 text-center text-body-md font-semibold text-on-surface">
            {t('play.question.number')} {question.orderIndex + 1}
          </p>
        </Modal>
      )}
    </section>
  );
}

function AnswerForm({
  question,
  seat,
  sessionId,
  onSubmitted,
}: {
  question: QuestionPublicDto;
  seat: TeamSeat;
  sessionId: string;
  onSubmitted: (answer: SubmittedAnswer) => void;
}) {
  const { t } = useI18n();
  const [optionId, setOptionId] = useState('');
  const [text, setText] = useState('');
  const [numeric, setNumeric] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = question.options ?? [];
  const optionIndex = options.findIndex((option) => option.id === optionId);
  const ready =
    question.type === 'MULTIPLE_CHOICE'
      ? optionIndex >= 0
      : question.type === 'FREE_TEXT'
        ? text.trim() !== ''
        : numeric.trim() !== '' && Number.isFinite(Number(numeric));

  function nudge(delta: number) {
    setNumeric((value) => String((Number(value) || 0) + delta));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || sending) return;
    const response =
      question.type === 'MULTIPLE_CHOICE'
        ? { optionId }
        : question.type === 'FREE_TEXT'
          ? { text: text.trim() }
          : { value: Number(numeric) };
    const letter = question.type === 'MULTIPLE_CHOICE' ? optionLetter(optionIndex) : null;
    const display =
      question.type === 'MULTIPLE_CHOICE' ? options[optionIndex].label : question.type === 'FREE_TEXT' ? text.trim() : numeric.trim();

    setSending(true);
    setError(null);
    try {
      await apiPost<AnswerSummaryDto>(`/sessions/${sessionId}/answers`, { questionId: question.id, response }, seat.token);
      onSubmitted({ display, letter, submittedAt: Date.now() });
    } catch (err) {
      setError(describeError(err, t, 'play.question.submitFailed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-space-md" data-testid="player-answer-form">
      {question.type === 'MULTIPLE_CHOICE' && (
        <div className="flex w-full flex-col gap-2.5" role="radiogroup" aria-label={t('play.question.type.MULTIPLE_CHOICE')}>
          {options.map((option, index) => {
            const selected = option.id === optionId;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`player-option-${option.id}`}
                onClick={() => setOptionId(option.id)}
                className={`relative flex min-h-[60px] w-full items-center justify-between overflow-hidden rounded-xl px-4 py-3 text-left transition-all active:scale-[0.98] ${
                  selected
                    ? 'bg-surface-container-high shadow-[0_0_20px_rgba(208,188,255,0.35)]'
                    : 'bg-surface-container/60 shadow-sm hover:bg-surface-container'
                }`}
              >
                {selected && <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-primary" />}
                <div className={`flex min-w-0 items-center gap-3 ${selected ? 'pl-1' : ''}`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-label-lg font-extrabold ${
                      selected ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    {optionLetter(index)}
                  </div>
                  <span className={`text-body-lg text-on-surface ${selected ? 'font-bold' : 'font-semibold'}`}>{option.label}</span>
                </div>
                {selected && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-md">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'FREE_TEXT' && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-high/90 p-4 shadow-md backdrop-blur-md">
          <label htmlFor="player-text-answer" className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            {t('play.question.textLabel')}
          </label>
          <div className="relative flex items-center">
            <PencilLine className="absolute left-3 h-5 w-5 text-on-surface-variant" />
            <input
              id="player-text-answer"
              data-testid="player-text-answer"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('play.question.textPlaceholder')}
              maxLength={120}
              autoComplete="off"
              className="h-14 w-full rounded-xl bg-surface-container-lowest pl-11 pr-12 text-headline-sm text-on-surface shadow-inner outline-none transition-all placeholder:text-on-surface-variant/40 focus:bg-surface-container"
            />
            {text && (
              <button
                type="button"
                aria-label={t('play.question.clear')}
                onClick={() => setText('')}
                className="absolute right-3 p-1.5 text-on-surface-variant hover:text-on-surface"
              >
                <CircleX className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
          <p className="flex items-center gap-1 pt-1 text-body-sm text-on-surface-variant">
            <Check className="h-3.5 w-3.5 text-tertiary" />
            {t('play.question.textHint')}
          </p>
        </div>
      )}

      {question.type === 'NUMERIC_NEAREST' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-container-high/90 p-4 shadow-md backdrop-blur-md">
          <span className="w-full text-label-sm uppercase tracking-wider text-on-surface-variant">{t('play.question.numericLabel')}</span>
          <div className="flex w-full items-center justify-center gap-4 py-2">
            <button
              type="button"
              aria-label="-1"
              onClick={() => nudge(-1)}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container text-primary shadow-lg transition-transform hover:bg-surface-variant active:scale-90"
            >
              <Minus className="h-7 w-7" strokeWidth={3} />
            </button>
            <input
              data-testid="player-numeric-answer"
              type="number"
              step="any"
              inputMode="decimal"
              aria-label={t('play.question.numericLabel')}
              value={numeric}
              onChange={(event) => setNumeric(event.target.value)}
              placeholder="0"
              className="w-32 rounded-2xl bg-surface-container-lowest px-4 py-2 text-center text-display-lg-mobile text-secondary shadow-inner outline-none placeholder:text-secondary/30"
            />
            <button
              type="button"
              aria-label="+1"
              onClick={() => nudge(1)}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container text-primary shadow-lg transition-transform hover:bg-surface-variant active:scale-90"
            >
              <Plus className="h-7 w-7" strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      <div className="sticky bottom-24 flex w-full flex-col gap-3 rounded-2xl bg-surface-container-low/95 p-4 shadow-2xl backdrop-blur-xl">
        {error && (
          <p role="alert" className="rounded-xl bg-error-container/70 p-3 text-body-sm text-on-error-container">
            {error}
          </p>
        )}
        <button
          type="submit"
          data-testid="player-submit-answer"
          disabled={!ready || sending}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-label-lg font-extrabold uppercase tracking-wide text-on-primary shadow-[0_0_24px_rgba(208,188,255,0.4)] transition-all hover:bg-primary-fixed active:scale-[0.98] disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
          {sending ? t('play.question.sending') : t('play.question.submit')}
        </button>
        <p className="text-center text-label-sm text-on-surface-variant/80">{t('play.question.lockNotice')}</p>
      </div>
    </form>
  );
}

function LockedView({
  state,
  question,
  answer,
  remaining,
}: {
  state: QuizSessionStateDto;
  question: QuestionPublicDto;
  answer: SubmittedAnswer;
  remaining: number | null;
}) {
  const { t } = useI18n();
  const startedAt =
    state.questionEndsAt && !isUntimed(question.timeLimitSeconds)
      ? Date.parse(state.questionEndsAt) - question.timeLimitSeconds * 1000
      : null;
  const took = startedAt === null ? null : Math.max(0, (answer.submittedAt - startedAt) / 1000);

  return (
    <>
      <section className="flex w-full items-center justify-between rounded-xl bg-surface-container-high/90 px-space-md py-2.5 shadow-lg backdrop-blur-md">
        <span className="flex items-center gap-space-xs text-label-sm font-bold uppercase tracking-wider text-tertiary">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-tertiary shadow-[0_0_8px_rgba(78,222,163,0.8)]" />
          {t('play.question.number')} {question.orderIndex + 1}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-error-container px-2.5 py-0.5 text-label-sm font-bold uppercase tracking-wider text-on-error-container shadow-sm">
          <LockKeyhole className="h-3 w-3" />
          {t('play.locked.badge')}
        </span>
      </section>

      <section className="relative flex w-full items-start gap-3 overflow-hidden rounded-2xl bg-tertiary-container/30 p-space-md shadow-[0_0_24px_rgba(0,165,114,0.25)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-tertiary/10 blur-2xl" />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tertiary-container text-on-tertiary shadow-[0_0_14px_rgba(78,222,163,0.4)]">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h2 className="text-headline-sm font-bold leading-tight tracking-tight text-tertiary">{t('play.locked.title')}</h2>
            {took !== null && (
              <span className="rounded-full bg-on-tertiary/40 px-2 py-0.5 text-label-sm text-tertiary">{took.toFixed(1)} s</span>
            )}
          </div>
          <p className="mt-0.5 text-body-md text-on-surface">{t('play.locked.subtitle')}</p>
        </div>
      </section>

      <section className="relative w-full overflow-hidden rounded-2xl bg-surface-container/85 p-space-md shadow-2xl backdrop-blur-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <span className="mb-3 block text-label-md font-bold uppercase tracking-wider text-on-surface-variant">
          {t('play.locked.yourAnswer')}
        </span>
        <div className="flex w-full items-center justify-between gap-space-sm rounded-xl bg-surface-container-highest/90 p-space-md shadow-[0_0_20px_rgba(208,188,255,0.15)]">
          <div className="flex min-w-0 items-center gap-3">
            {answer.letter && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-headline-sm font-extrabold text-on-primary shadow-[0_0_12px_rgba(208,188,255,0.5)]">
                {answer.letter}
              </div>
            )}
            <span
              className="block truncate text-headline-sm font-extrabold tracking-tight text-on-surface"
              data-testid="player-locked-answer"
            >
              {answer.display}
            </span>
          </div>
          <Check className="h-7 w-7 shrink-0 text-primary" strokeWidth={3} />
        </div>
      </section>

      <section className="flex w-full items-center gap-3 rounded-2xl bg-surface-container-low/95 p-space-md shadow-xl">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container/40 text-secondary">
          <Hourglass className="h-[18px] w-[18px] animate-spin [animation-duration:3s]" />
        </span>
        <p className="flex-1 text-body-md font-semibold leading-snug text-on-surface">{t('play.locked.waiting')}</p>
        {remaining !== null && remaining > 0 && <span className="text-label-md font-bold text-secondary">{formatClock(remaining)}</span>}
      </section>
    </>
  );
}
