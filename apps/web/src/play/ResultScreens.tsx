import { useState } from 'react';
import {
  BadgeCheck,
  ChevronDown,
  Crown,
  Download,
  Flag,
  Home,
  Hourglass,
  PartyPopper,
  Share2,
  ThumbsDown,
  Trophy,
  Users,
} from 'lucide-react';
import type { AnswerSummaryDto, QuestionPublicDto, QuizSessionStateDto } from '@quizicius/shared-types';
import { apiPost } from '../lib/api-client';
import { downloadCertificate } from '../lib/certificate';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { correctAnswerText, optionLetter, rankTeams, type RankedTeam } from '../lib/quiz';
import { useCurrentQuestionMedia } from '../lib/use-current-question-media';
import { ProjectorMediaCard } from '../ui/ProjectorMediaCard';
import { PlayerShell } from './PlayerShell';
import { StandingRow } from './parts';
import { describeResponse, type SubmittedAnswer } from './submitted-answers';

type Verdict = 'correct' | 'wrong' | 'review' | 'grading' | 'none';

/** Verdict from the server's grade; a sent answer without a grade yet is still being graded. */
function verdictOf(sent: SubmittedAnswer | undefined, graded: AnswerSummaryDto | undefined): Verdict {
  if (graded?.needsReview) return 'review';
  if (graded?.isCorrect === true) return 'correct';
  if (graded?.isCorrect === false) return 'wrong';
  return sent || graded ? 'grading' : 'none';
}

const VERDICT_STYLE: Record<Verdict, { box: string; text: string; icon: typeof PartyPopper }> = {
  correct: { box: 'bg-tertiary-container/20 shadow-[0_0_28px_rgba(78,222,163,0.22)]', text: 'text-tertiary', icon: PartyPopper },
  wrong: { box: 'bg-error-container/25 shadow-[0_0_28px_rgba(255,180,171,0.15)]', text: 'text-error', icon: ThumbsDown },
  review: { box: 'bg-secondary-container/15 shadow-glow-gold', text: 'text-secondary', icon: Hourglass },
  grading: { box: 'bg-surface-container', text: 'text-on-surface-variant', icon: Hourglass },
  none: { box: 'bg-surface-container', text: 'text-on-surface-variant', icon: Hourglass },
};

/** Stitch "Odhalenie Odpovede a Body". */
export function RevealScreen({
  state,
  question,
  teamId,
  token,
  sent,
  graded,
}: {
  state: QuizSessionStateDto;
  question: QuestionPublicDto;
  teamId: string;
  /** The team's seat token, for disputing the grade. */
  token: string;
  sent: SubmittedAnswer | undefined;
  graded: AnswerSummaryDto | undefined;
}) {
  const { t, plural } = useI18n();
  const ranked = rankTeams(state.teams);
  const own = ranked.find((team) => team.id === teamId);
  const verdict = verdictOf(sent, graded);
  const style = VERDICT_STYLE[verdict];
  const correctIndex = question.options?.findIndex((option) => option.id === question.correctOptionId) ?? -1;
  const awarded = graded?.scoreAwarded ?? 0;
  const answer = sent ?? (graded ? describeResponse(question, graded.response) : undefined);
  const { revealMedia } = useCurrentQuestionMedia(state.id, question.id, state.status);

  return (
    <PlayerShell joinCode={state.joinCode} phase="reveal" testId="player-reveal">
      {revealMedia?.kind === 'image' && (
        <img
          src={revealMedia.url}
          alt={t('play.question.image')}
          className="max-h-56 w-full rounded-xl object-cover shadow-md"
          data-testid="player-reveal-image"
        />
      )}
      {revealMedia && revealMedia.kind !== 'image' && <ProjectorMediaCard kind={revealMedia.kind} />}
      <section
        data-testid="player-verdict"
        data-verdict={verdict}
        className={`relative overflow-hidden rounded-xl p-space-md ${style.box}`}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-tertiary/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-primary/20 blur-xl" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-lowest/40">
            <style.icon className={`h-8 w-8 ${style.text}`} />
          </div>
          <span className={`mb-0.5 text-label-sm font-extrabold uppercase tracking-widest ${style.text}`}>
            {t('play.question.number')} {question.orderIndex + 1}
          </span>
          <h2 className="text-headline-md font-extrabold tracking-tight text-on-surface">{t(`play.reveal.${verdict}.title`)}</h2>
          <p className="mt-0.5 text-body-sm text-on-surface-variant">{t(`play.reveal.${verdict}.subtitle`)}</p>
          {verdict === 'correct' && state.scoresVisible && (
            <div className="mt-3 flex w-full items-center justify-between rounded-lg bg-surface-container-lowest/60 p-space-sm">
              <span className={`text-label-md font-extrabold uppercase ${style.text}`}>{t('play.reveal.earned')}</span>
              <span className={`text-headline-sm font-extrabold tracking-tight ${style.text}`} data-testid="player-awarded">
                +{awarded} {plural('count.pointsShort', awarded)}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-surface-container p-space-md shadow-md">
        <span className="mb-2 flex items-center gap-1 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
          <BadgeCheck className="h-4 w-4 text-primary" />
          {t('play.reveal.correctAnswer')}
        </span>
        <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-high p-space-sm">
          {correctIndex >= 0 && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tertiary-container shadow-[0_0_12px_rgba(0,165,114,0.35)]">
              <span className="text-headline-sm font-extrabold text-on-tertiary-container">{optionLetter(correctIndex)}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-label-sm text-on-surface-variant">{question.prompt}</div>
            <div className="text-body-lg font-bold text-on-surface" data-testid="player-correct-answer">
              {correctAnswerText(question) ?? '—'}
            </div>
          </div>
        </div>
      </section>

      {own && (
        <section className="space-y-3 rounded-xl bg-surface-container p-space-md shadow-md">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <span className="text-headline-sm font-bold text-on-surface">{t('play.reveal.teamResult')}</span>
          </div>
          <div className="grid grid-cols-2 gap-space-xs">
            <div className="flex flex-col rounded-lg bg-surface-container-lowest p-space-sm">
              <span className="text-label-sm uppercase text-on-surface-variant">{t('play.reveal.yourAnswer')}</span>
              <span className={`mt-0.5 break-words text-body-lg font-bold ${style.text}`}>
                {answer ? [answer.letter, answer.display].filter(Boolean).join(' — ') : t('play.reveal.noAnswer')}
              </span>
            </div>
            {state.scoresVisible && (
              <div className="flex flex-col justify-between rounded-lg bg-surface-container-lowest p-space-sm">
                <span className="text-label-sm uppercase text-on-surface-variant">{t('play.reveal.totalScore')}</span>
                <span className="mt-0.5 text-headline-md font-extrabold text-primary" data-testid="player-total-score">
                  {own.score}
                </span>
                <span className="text-label-sm text-on-surface-variant/70">
                  {t('play.reveal.position')} #{own.rank}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {state.scoresVisible && (
        <section className="rounded-xl bg-surface-container p-space-md">
          <span className="mb-2.5 block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
            {t('play.reveal.top3')}
          </span>
          <ol className="space-y-1.5">
            {ranked.slice(0, 3).map((team) => (
              <StandingRow key={team.id} team={team} isOwn={team.id === teamId} />
            ))}
          </ol>
        </section>
      )}

      {graded && graded.isCorrect === false && (!graded.needsReview || graded.disputed) && (
        <DisputeCard key={graded.id} sessionId={state.id} token={token} answer={graded} />
      )}

      <section className="flex items-center gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Hourglass className="h-5 w-5 animate-spin text-primary [animation-duration:4s]" />
        </div>
        <p className="text-body-md font-bold text-on-surface">{t('play.reveal.nextComing')}</p>
      </section>
    </PlayerShell>
  );
}

/** A wrong answer can be sent back to the host once, with a short reason. */
function DisputeCard({ sessionId, token, answer }: { sessionId: string; token: string; answer: AnswerSummaryDto }) {
  const { t } = useI18n();
  const [sent, setSent] = useState(answer.disputed);
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/sessions/${sessionId}/answers/${answer.id}/dispute`, note.trim() ? { note: note.trim() } : {}, token);
      setSent(true);
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section
        className="flex items-center gap-2 rounded-xl bg-secondary-container/15 p-space-md"
        data-testid="player-dispute-sent"
        role="status"
      >
        <Hourglass className="h-5 w-5 shrink-0 text-secondary" />
        <p className="text-body-sm font-semibold text-on-surface">{t('play.reveal.disputeSent')}</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-space-md" data-testid="player-dispute">
      <h3 className="text-label-md font-bold text-on-surface">{t('play.reveal.disputeTitle')}</h3>
      <p className="text-body-sm leading-relaxed text-on-surface-variant">{t('play.reveal.disputeText')}</p>
      {writing && (
        <textarea
          rows={2}
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('play.reveal.disputeNotePlaceholder')}
          className="w-full resize-none rounded-lg bg-surface-container-lowest p-2.5 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="player-dispute-note"
        />
      )}
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => (writing ? void send() : setWriting(true))}
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-surface-container-high px-3.5 text-label-md font-bold text-on-surface disabled:opacity-50"
          data-testid="player-dispute-button"
        >
          <Flag className="h-4 w-4 text-secondary" />
          {t(writing ? 'play.reveal.disputeSend' : 'play.reveal.disputeButton')}
        </button>
      </div>
    </section>
  );
}

/** Stitch "Finálne Poradie a Víťazi". */
export function ResultsScreen({
  state,
  teamId,
  title,
  pub = null,
  onExit,
}: {
  state: QuizSessionStateDto;
  teamId: string;
  title: string | null;
  /** The pub the night was played at, for the certificate. */
  pub?: string | null;
  onExit: () => void;
}) {
  const { t, plural, locale } = useI18n();
  const [making, setMaking] = useState(false);
  const ranked = rankTeams(state.teams);
  const own = ranked.find((team) => team.id === teamId);
  const [showAll, setShowAll] = useState(false);
  const [shared, setShared] = useState(false);
  const visible = showAll ? ranked : ranked.slice(0, 3);

  /** The team's result as an A4 PDF certificate. */
  async function certificate() {
    if (!own || making) return;
    setMaking(true);
    try {
      const teams = ranked.length;
      const today = new Date().toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB', { dateStyle: 'long' });
      await downloadCertificate({
        heading: t('play.results.certificateHeading'),
        teamName: own.name,
        // "2. miesto z 14": no noun after the count, which would need its own grammar case.
        placeLine: `${own.rank}. ${t('play.results.place')} ${t('play.results.of')} ${teams}`,
        scoreLine: `${own.score} ${plural('count.points', own.score)}`,
        details: [title, pub, today].filter((line): line is string => Boolean(line)),
        fileName: `quizicius-${
          own.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'team'
        }.pdf`,
      });
    } finally {
      setMaking(false);
    }
  }

  async function share() {
    if (!own) return;
    const text = `🏆 ${own.name} — ${own.rank}. ${t('play.results.place')}, ${own.score} ${plural('count.pointsShort', own.score)}! #QuiziciuS`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setShared(true);
    } catch {
      // The user dismissed the share sheet.
    }
  }

  return (
    <PlayerShell joinCode={state.joinCode} phase="results" testId="player-results">
      <section className="relative overflow-hidden rounded-xl bg-surface-container-low p-space-md shadow-xl">
        <Trophy className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 text-secondary opacity-10" />
        <div className="mb-1 flex items-center gap-space-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-label-sm font-bold uppercase tracking-wider text-secondary">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-secondary" />
            {t('play.results.finished')}
          </span>
        </div>
        <h1 className="text-headline-md font-extrabold tracking-tight text-on-surface">{title ?? t('play.join.eventFallback')}</h1>
        <p className="mt-0.5 text-body-sm text-on-surface-variant">{t('play.results.subtitle')}</p>
      </section>

      {own && (
        <section className="relative overflow-hidden rounded-xl bg-surface-container p-space-md shadow-2xl" data-testid="player-own-result">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary-container" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative z-10 flex items-start justify-between gap-space-sm">
            <div className="min-w-0">
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-label-sm font-extrabold uppercase tracking-wider text-primary">
                {t('play.results.yourTeam')}
              </span>
              <h2 className="mt-1 truncate text-headline-sm font-bold text-on-surface">{own.name}</h2>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span
                className="rounded-full bg-surface-container-highest px-3 py-1 text-headline-sm font-extrabold leading-none text-on-surface"
                data-testid="player-final-rank"
              >
                {own.rank}.
              </span>
              <span className="mt-1 text-label-sm uppercase tracking-wider text-on-surface-variant">{t('play.results.place')}</span>
            </div>
          </div>
          <div className="mt-space-md flex items-baseline gap-1 rounded-lg bg-surface-container-lowest/80 p-space-sm">
            <span className="block text-label-sm uppercase text-on-surface-variant">{t('play.results.finalScore')}</span>
            <span className="ml-auto text-display-lg-mobile leading-none text-secondary" data-testid="player-final-score">
              {own.score}
            </span>
            <span className="text-label-md text-on-surface-variant">{plural('count.pointsShort', own.score)}</span>
          </div>
        </section>
      )}

      {ranked.length > 0 && <Podium ranked={ranked} teamId={teamId} />}

      <section className="rounded-xl bg-surface-container-low p-space-md shadow-md">
        <h3 className="mb-space-sm text-headline-sm font-bold text-on-surface">{t('play.results.standings')}</h3>
        <ol className="flex flex-col gap-2">
          {visible.map((team) => (
            <StandingRow key={team.id} team={team} isOwn={team.id === teamId} />
          ))}
        </ol>
        {ranked.length > 3 && (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="mt-space-xs flex w-full items-center justify-center gap-1 rounded-lg bg-surface-container py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            {showAll ? t('play.results.showLess') : `${t('play.results.showAll')} (${ranked.length})`}
            <ChevronDown className={`h-[18px] w-[18px] transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </button>
        )}
      </section>

      <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-md shadow-lg">
        <button
          type="button"
          data-testid="player-share"
          onClick={() => void share()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container text-label-lg text-on-primary-container shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <Share2 className="h-5 w-5" />
          {shared ? t('play.results.shared') : t('play.results.share')}
        </button>
        <div className="grid grid-cols-2 gap-space-xs">
          <button
            type="button"
            data-testid="player-exit"
            onClick={onExit}
            className="flex h-12 items-center justify-center gap-1.5 rounded-lg bg-surface-container-high px-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-highest"
          >
            <Home className="h-[18px] w-[18px] text-secondary" />
            {t('play.results.home')}
          </button>
          {own && (
            <button
              type="button"
              disabled={making}
              onClick={() => void certificate()}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-lg bg-surface-container-high px-2 text-label-md text-on-surface disabled:opacity-50"
              data-testid="player-certificate"
            >
              <Download className="h-[18px] w-[18px] text-tertiary" />
              {making ? t('common.working') : t('play.results.certificate')}
            </button>
          )}
        </div>
      </section>
    </PlayerShell>
  );
}

function Podium({ ranked, teamId }: { ranked: RankedTeam[]; teamId: string }) {
  const { t, plural } = useI18n();
  // Visual order: 2nd, 1st, 3rd.
  const places = [ranked[1], ranked[0], ranked[2]];
  const heights = ['h-16', 'h-24', 'h-12'];
  return (
    <section className="rounded-xl bg-surface-container-low p-space-md shadow-lg" data-testid="player-podium">
      <div className="mb-space-sm flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-headline-sm font-bold text-on-surface">
          <Trophy className="h-5 w-5 text-secondary" />
          {t('play.results.podium')}
        </h3>
        <span className="text-label-sm text-on-surface-variant">
          {ranked.length} {plural('count.teamsTotal', ranked.length)}
        </span>
      </div>
      <div className="grid grid-cols-3 items-end gap-2 pb-2 pt-6 text-center">
        {places.map((team, slot) =>
          team ? (
            <div key={team.id} className="flex flex-col items-center">
              <div
                className={`mb-1 flex items-center justify-center rounded-full ${
                  slot === 1
                    ? 'h-12 w-12 bg-secondary-container/30 shadow-[0_0_16px_rgba(238,152,0,0.4)]'
                    : 'h-10 w-10 bg-surface-container-highest shadow-md'
                }`}
              >
                {slot === 1 ? (
                  <Crown className="h-6 w-6 text-secondary" />
                ) : (
                  <span className="text-label-lg font-extrabold text-on-surface">{team.rank}</span>
                )}
              </div>
              <span className={`w-full truncate px-1 text-label-sm font-bold ${slot === 1 ? 'text-secondary' : 'text-on-surface'}`}>
                {team.name}
              </span>
              <span
                className={`text-label-sm font-bold ${team.id === teamId ? 'text-primary' : slot === 1 ? 'text-secondary' : 'text-on-surface-variant'}`}
              >
                {team.score} {plural('count.pointsShort', team.score)}
              </span>
              <div
                className={`mt-2 flex w-full flex-col justify-end rounded-t-lg pb-1 shadow-inner ${heights[slot]} ${
                  slot === 1
                    ? 'bg-gradient-to-t from-secondary/30 via-secondary-container/20 to-surface-container-highest'
                    : 'bg-gradient-to-t from-primary/20 to-surface-container-high'
                }`}
              >
                {team.id === teamId && <span className="text-label-sm font-bold uppercase text-on-surface-variant">{t('play.you')}</span>}
              </div>
            </div>
          ) : (
            <div key={slot} />
          ),
        )}
      </div>
    </section>
  );
}
