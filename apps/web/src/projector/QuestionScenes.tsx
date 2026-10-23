import { BadgeCheck, Check, Flag, Hash, PencilLine, Pointer, Trophy } from 'lucide-react';
import type { QuestionPublicDto, QuizSessionStateDto, TeamSummaryDto } from '@quizicius/shared-types';
import { useI18n } from '../lib/i18n';
import { correctAnswerText, optionLetter, secondsLeft, useNow } from '../lib/quiz';
import { useCurrentQuestionMedia } from '../lib/use-current-question-media';

export function LockInScene({ question, teams = [] }: { question: QuestionPublicDto | null; teams?: TeamSummaryDto[] }) {
  const { t } = useI18n();
  const active = teams.filter((team) => team.isActive);
  const ready = active.filter((team) => team.ready).length;
  return (
    <section className="flex w-full flex-col items-center justify-center py-space-xl text-center" data-testid="projector-lock-in">
      <div className="relative flex w-full max-w-3xl flex-col items-center overflow-hidden rounded-xl bg-surface-container/90 p-space-xl shadow-2xl backdrop-blur-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary-container/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
        <div className="mb-space-md flex h-20 w-20 items-center justify-center rounded-full bg-primary-container shadow-[0_0_32px_rgba(160,120,255,0.4)]">
          <Flag className="h-11 w-11 text-on-primary-container" />
        </div>
        {question && (
          <span className="text-label-lg font-extrabold uppercase tracking-widest text-secondary">
            {t('play.question.number')} {question.orderIndex + 1} • {question.points} {t('projector.points')}
          </span>
        )}
        <h2 className="mt-space-xs text-display-lg font-extrabold uppercase tracking-tight text-on-surface">
          {t('projector.lockIn.title')}
        </h2>
        <div className="mt-space-xl h-4 w-full overflow-hidden rounded-full bg-surface-container-lowest p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-tertiary transition-all duration-500"
            style={{ width: `${active.length ? (ready / active.length) * 100 : 0}%` }}
            data-testid="projector-ready-bar"
          />
        </div>
        <p className="mt-space-sm text-headline-sm font-bold text-on-surface" data-testid="projector-ready-count">
          {ready} / {active.length} {t('projector.lockIn.teamsReady')}
        </p>
        {active.length > 0 && (
          <ul className="mt-space-md flex flex-wrap justify-center gap-space-xs">
            {active.map((team) => (
              <li
                key={team.id}
                data-testid={`projector-ready-${team.id}`}
                data-ready={team.ready}
                className={`flex items-center gap-1 rounded-full px-space-sm py-1 text-label-lg transition-colors ${
                  team.ready ? 'bg-tertiary-container/40 text-on-surface' : 'bg-surface-container-high text-outline'
                }`}
              >
                {team.ready && <Check className="h-4 w-4 text-tertiary" />}
                {team.name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-space-md text-label-md text-outline">{t('projector.lockIn.subtitle')}</p>
      </div>
    </section>
  );
}

export function QuestionScene({ state, question }: { state: QuizSessionStateDto; question: QuestionPublicDto }) {
  const { t } = useI18n();
  const revealed = state.status === 'QUESTION_REVEAL';
  const { media, error } = useCurrentQuestionMedia(state.id, question.id, state.status);

  return (
    <section className="flex w-full flex-col gap-space-lg" data-testid={revealed ? 'projector-reveal' : 'projector-question'}>
      {revealed ? (
        <div className="flex items-center gap-space-sm rounded-xl bg-tertiary-container/20 px-space-lg py-space-sm">
          <BadgeCheck className="h-7 w-7 text-tertiary" />
          <span className="text-headline-sm font-extrabold uppercase tracking-wide text-tertiary">{t('projector.reveal.title')}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-space-md rounded-xl bg-surface-container/70 px-space-lg py-space-sm shadow-md backdrop-blur-xl">
          <div className="flex items-center gap-space-md">
            <span className="rounded-full bg-primary-container px-space-md py-space-xs text-label-lg font-bold uppercase text-on-primary-container">
              {t('play.question.number')} {question.orderIndex + 1}
            </span>
            <span className="text-headline-sm text-on-surface-variant">{t(`play.question.type.${question.type}`)}</span>
          </div>
          <span className="flex items-center gap-space-xs text-headline-sm font-extrabold uppercase text-secondary">
            <Trophy className="h-5 w-5" />+{question.points} {t('projector.points')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 items-center gap-space-lg lg:grid-cols-12">
        <div
          className={`flex min-h-[180px] flex-col justify-between rounded-xl bg-surface-container/90 p-space-xl shadow-2xl backdrop-blur-2xl ${revealed ? 'lg:col-span-12' : 'lg:col-span-9'}`}
        >
          <div>
            <span className="mb-space-xs block text-label-sm uppercase tracking-widest text-outline">
              {t('projector.question.promptLabel')}
            </span>
            <h2 className="text-display-lg leading-tight text-on-surface xl:text-[52px] xl:leading-[62px]" data-testid="projector-prompt">
              {question.prompt}
            </h2>
          </div>
          {!revealed && (
            <div className="mt-space-md flex items-center gap-space-xs text-label-md text-on-surface-variant">
              <Pointer className="h-[18px] w-[18px] text-primary" />
              {t('projector.question.answerOnPhones')}
            </div>
          )}
        </div>
        {!revealed && state.questionEndsAt && (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl bg-surface-container/90 p-space-lg shadow-2xl backdrop-blur-2xl lg:col-span-3">
            <BigTimer endsAt={state.questionEndsAt} total={question.timeLimitSeconds} />
          </div>
        )}
      </div>

      {media?.mediaType === 'image' && media.url && (
        <img
          data-testid="projector-image"
          src={media.url}
          alt={t('play.question.image')}
          className="mx-auto max-h-[40vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
      )}
      {media?.mediaType === 'video' && media.url && (
        <video
          key={question.id}
          data-testid="projector-video"
          src={media.url}
          autoPlay={!revealed}
          controls
          playsInline
          preload="metadata"
          className="mx-auto max-h-[45vh] max-w-full rounded-xl bg-black shadow-2xl"
        />
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-error-container/60 p-space-md text-center text-body-lg text-on-error-container">
          {t('play.question.mediaUnavailable')}
        </p>
      )}

      {question.type === 'MULTIPLE_CHOICE' ? (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2" data-testid="projector-options">
          {question.options?.map((option, index) =>
            revealed && option.id === question.correctOptionId ? (
              <div
                key={option.id}
                data-testid="projector-correct-option"
                className="relative flex items-center justify-between gap-space-lg overflow-hidden rounded-xl bg-tertiary-container/30 p-space-lg shadow-[0_0_32px_rgba(78,222,163,0.35)] backdrop-blur-xl"
              >
                <div className="flex min-w-0 items-center gap-space-lg">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-tertiary text-headline-lg font-extrabold text-on-tertiary">
                    {optionLetter(index)}
                  </div>
                  <div>
                    <span className="block text-label-sm font-extrabold uppercase tracking-wider text-tertiary">
                      {t('projector.reveal.winning')}
                    </span>
                    <span className="text-headline-md font-extrabold text-on-surface">{option.label}</span>
                  </div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tertiary text-on-tertiary">
                  <Check className="h-6 w-6" strokeWidth={3} />
                </div>
              </div>
            ) : (
              <div
                key={option.id}
                className={`flex items-center gap-space-lg rounded-xl p-space-lg ${
                  revealed ? 'bg-surface-container-low/40 opacity-30' : 'bg-surface-container/80 shadow-lg backdrop-blur-xl'
                }`}
              >
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-headline-lg font-extrabold ${
                    revealed ? 'bg-surface-container text-outline' : 'bg-surface-container-highest text-primary'
                  }`}
                >
                  {optionLetter(index)}
                </div>
                <span className={`text-headline-md font-semibold ${revealed ? 'text-outline' : 'text-on-surface'}`}>{option.label}</span>
              </div>
            ),
          )}
        </div>
      ) : revealed ? (
        <div className="flex flex-col items-center rounded-xl bg-tertiary-container/30 p-space-xl text-center shadow-[0_0_32px_rgba(78,222,163,0.35)]">
          <span className="text-label-lg font-extrabold uppercase tracking-widest text-tertiary">{t('projector.reveal.answer')}</span>
          <span
            className="mt-space-xs text-display-lg text-on-surface xl:text-[56px] xl:leading-[64px]"
            data-testid="projector-correct-answer"
          >
            {correctAnswerText(question) ?? '—'}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl bg-surface-container/90 p-space-xl text-center">
          {question.type === 'FREE_TEXT' ? (
            <PencilLine className="mb-space-sm h-12 w-12 text-primary" />
          ) : (
            <Hash className="mb-space-sm h-12 w-12 text-secondary" />
          )}
          <h3 className="text-headline-lg font-bold uppercase text-on-surface">
            {t(`projector.question.${question.type === 'FREE_TEXT' ? 'text' : 'numeric'}Title`)}
          </h3>
          <p className="mt-space-xs max-w-xl text-body-lg text-on-surface-variant">
            {t(`projector.question.${question.type === 'FREE_TEXT' ? 'text' : 'numeric'}Hint`)}
          </p>
        </div>
      )}
    </section>
  );
}

function BigTimer({ endsAt, total }: { endsAt: string; total: number }) {
  const { t } = useI18n();
  const now = useNow(250);
  const seconds = secondsLeft(endsAt, now) ?? 0;
  const circumference = 2 * Math.PI * 42;
  const fraction = total > 0 ? Math.min(1, seconds / total) : 0;
  const urgent = seconds <= 5;
  return (
    <div
      className="relative flex h-36 w-36 items-center justify-center"
      role="timer"
      aria-label={`${seconds} ${t('play.seconds')}`}
      data-testid="projector-timer"
    >
      <svg aria-hidden="true" className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle className="text-surface-container-highest" cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" />
        <circle
          className={`${urgent ? 'text-red-400' : 'text-secondary'} transition-all duration-300`}
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-display-lg font-extrabold ${urgent ? 'text-red-300' : 'text-on-surface'}`}>
          {String(seconds).padStart(2, '0')}
        </span>
        <span className="text-label-sm uppercase tracking-wider text-outline">{t('play.seconds')}</span>
      </div>
    </div>
  );
}
