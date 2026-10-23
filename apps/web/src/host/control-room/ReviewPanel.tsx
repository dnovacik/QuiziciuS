import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, BadgeCheck, Check, CheckCircle2, Gavel, PenLine, ShieldAlert, X, XCircle } from 'lucide-react';
import type { AnswerSummaryDto } from '@quizicius/shared-types';
import { describeError } from '../../lib/errors';
import { isTranslationKey, useI18n } from '../../lib/i18n';
import { hostApi, type Infraction } from '../api';
import { btn, inputClass, Label, useToast } from '../ui';
import { correctLabel, responseLabel } from './QuestionPanel';
import type { ControlRoom } from './use-control-room';

/** Stitch "Kontrola & Spor" plus infractions and manual (paper round) scoring. */
export function ReviewPanel({
  room,
  token,
  sessionId,
  onDone,
}: {
  room: ControlRoom;
  token: string;
  sessionId: string;
  onDone: () => void;
}) {
  const { t, plural } = useI18n();
  const toast = useToast();
  const state = room.state!;
  const question = room.currentQuestion;
  const [disputes, setDisputes] = useState<AnswerSummaryDto[]>([]);
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void hostApi
      .listDisputes(token, sessionId)
      .then(setDisputes)
      .catch(() => setDisputes([]));
    void hostApi
      .listInfractions(token, sessionId)
      .then(setInfractions)
      .catch(() => setInfractions([]));
  }, [token, sessionId]);
  useEffect(load, [load, state]);

  const teamName = (teamId: string) => state.teams.find((team) => team.id === teamId)?.name ?? '—';
  const questionById = (id: string) => room.questions.find((row) => row.id === id) ?? null;
  const graded = room.answers;
  const correct = graded.filter((answer) => answer.isCorrect === true).length;
  const wrong = graded.filter((answer) => answer.isCorrect === false && !answer.needsReview).length;

  async function act(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await action();
      toast(done);
      load();
      room.refetch();
      room.refreshAnswers();
    } catch (err) {
      room.setError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-space-md" data-testid="room-review">
      <div className="flex flex-col items-start justify-between gap-space-md rounded-2xl bg-surface-container-low p-space-md shadow-xl sm:p-space-lg md:flex-row md:items-center">
        <div className="flex items-center gap-space-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
            <Gavel className="h-7 w-7" />
          </div>
          <div>
            <span className="text-label-sm uppercase tracking-wider text-secondary">
              {question
                ? `${t('host.room.evaluation')} ${room.questions.indexOf(question) + 1}/${room.questions.length}`
                : t('host.room.tab.review')}
            </span>
            <h2 className="text-headline-md text-on-surface" data-testid="review-summary">
              {question
                ? `${correct} ${t('host.room.correctCount')} • ${wrong} ${t('host.room.wrongCount')} • ${disputes.length} ${t('host.room.disputedCount')}`
                : t('host.room.noQuestionYet')}
            </h2>
          </div>
        </div>
        {question && (
          <span className="flex items-center gap-1.5 rounded-xl bg-tertiary-container/20 px-space-md py-1.5 text-label-md text-tertiary">
            <BadgeCheck className="h-[18px] w-[18px]" />
            {correctLabel(question)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-lg shadow-xl" data-testid="review-disputes">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className={`h-3 w-3 rounded-full ${disputes.length ? 'animate-pulse bg-secondary' : 'bg-tertiary'}`} />
            <h3 className="text-headline-sm text-on-surface">{t('host.room.disputesTitle')}</h3>
          </div>
          <span className="rounded-full bg-secondary/20 px-space-sm py-0.5 text-label-sm font-bold uppercase text-secondary">
            {disputes.length} {t('host.room.toReview')}
          </span>
        </div>
        {disputes.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">{t('host.room.noDisputes')}</p>
        ) : (
          disputes.map((dispute) => {
            const disputedQuestion = questionById(dispute.questionId);
            return (
              <div
                key={dispute.id}
                className="flex flex-col items-start justify-between gap-space-md rounded-xl bg-surface-container p-space-md md:flex-row md:items-center"
                data-testid={`dispute-${dispute.id}`}
              >
                <div className="flex flex-col">
                  <span className="text-headline-sm text-on-surface">{teamName(dispute.teamId)}</span>
                  <div className="mt-1 flex flex-wrap items-center gap-space-sm">
                    <span className="text-body-sm text-on-surface-variant">{t('host.room.teamText')}</span>
                    <span className="rounded bg-surface-container-high px-space-xs py-0.5 text-label-lg text-secondary">
                      „{responseLabel(disputedQuestion, dispute)}“
                    </span>
                    {disputedQuestion && (
                      <span className="text-body-sm text-outline">
                        ({t('host.room.expected')}: {correctLabel(disputedQuestion)})
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex w-full items-center gap-space-sm md:w-auto">
                  <button
                    type="button"
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-tertiary-container px-space-lg py-2.5 text-label-md text-on-tertiary-container shadow-sm transition-all hover:brightness-110 disabled:opacity-50 md:flex-none"
                    onClick={() => void act(() => hostApi.resolveDispute(token, dispute.id, 'APPROVE'), t('host.room.approved'))}
                    data-testid={`dispute-approve-${dispute.id}`}
                  >
                    <Check className="h-[18px] w-[18px]" />
                    {t('host.room.approve')} (+{disputedQuestion?.points ?? '?'}{' '}
                    {plural('count.pointsShort', disputedQuestion?.points ?? 0)})
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-error-container/20 px-space-md py-2.5 text-label-md text-error transition-all hover:bg-error-container/40 disabled:opacity-50 md:flex-none"
                    onClick={() => void act(() => hostApi.resolveDispute(token, dispute.id, 'REJECT'), t('host.room.rejected'))}
                    data-testid={`dispute-reject-${dispute.id}`}
                  >
                    <X className="h-[18px] w-[18px]" />
                    {t('host.room.reject')} (0 {plural('count.pointsShort', 0)})
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {question && (
        <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-lg shadow-xl">
          <div className="flex flex-col items-start justify-between gap-space-xs sm:flex-row sm:items-center">
            <div>
              <h3 className="text-headline-md text-on-surface">{t('host.room.answersTitle')}</h3>
              <p className="text-body-sm text-on-surface-variant">{t('host.room.answersHint')}</p>
            </div>
            <span className="rounded-lg bg-surface-container px-space-sm py-1 text-label-sm text-on-surface-variant">
              {graded.length} / {state.teams.length} {t('host.room.submittedShort')}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm text-on-surface" data-testid="review-answers">
              <thead className="bg-surface-container text-label-sm uppercase text-on-surface-variant">
                <tr>
                  <th className="rounded-l-lg p-space-sm">{t('host.room.team')}</th>
                  <th className="p-space-sm">{t('host.room.answer')}</th>
                  <th className="p-space-sm">{t('host.room.status')}</th>
                  <th className="rounded-r-lg p-space-sm text-right">{t('host.room.awarded')}</th>
                </tr>
              </thead>
              <tbody>
                {graded.map((answer) => {
                  const ok = answer.isCorrect === true;
                  return (
                    <tr key={answer.id} className="transition-colors hover:bg-surface-container/40">
                      <td className="p-space-sm text-label-md">{teamName(answer.teamId)}</td>
                      <td className="p-space-sm">
                        <span
                          className={`rounded px-space-xs py-0.5 font-bold ${ok ? 'bg-tertiary-container/20 text-tertiary' : answer.needsReview ? 'bg-secondary/15 text-secondary' : 'bg-error-container/20 text-error'}`}
                        >
                          {responseLabel(question, answer)}
                        </span>
                      </td>
                      <td className="p-space-sm">
                        <span
                          className={`flex items-center gap-1 text-label-sm ${ok ? 'text-tertiary' : answer.needsReview ? 'text-secondary' : 'text-error'}`}
                        >
                          {ok ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : answer.needsReview ? (
                            <ShieldAlert className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {t(
                            ok
                              ? 'host.room.correct'
                              : answer.needsReview
                                ? 'host.room.disputed'
                                : answer.isCorrect === null
                                  ? 'host.room.ungraded'
                                  : 'host.room.wrong',
                          )}
                        </span>
                      </td>
                      <td className={`p-space-sm text-right text-headline-sm ${ok ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                        {ok ? '+' : ''}
                        {answer.scoreAwarded} {plural('count.pointsShort', answer.scoreAwarded)}
                      </td>
                    </tr>
                  );
                })}
                {graded.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-space-md text-center text-on-surface-variant">
                      {t('host.room.noAnswers')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
        <InfractionsCard
          infractions={infractions}
          teamName={teamName}
          busy={busy}
          onDismiss={(id) => void act(() => hostApi.dismissInfraction(token, sessionId, id), t('host.room.dismissed'))}
        />
        <PaperScoreCard
          teams={state.teams}
          busy={busy}
          onAward={(teamId, points, reason) =>
            act(() => hostApi.addPaperScore(token, sessionId, teamId, points, reason), t('host.room.pointsAdded'))
          }
        />
      </div>

      <div className="flex justify-end">
        <button type="button" className={`${btn.primary} px-space-xl py-3.5`} onClick={onDone} data-testid="review-done">
          {t('host.room.confirmAndRank')}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

function InfractionsCard({
  infractions,
  teamName,
  busy,
  onDismiss,
}: {
  infractions: Infraction[];
  teamName: (teamId: string) => string;
  busy: boolean;
  onDismiss: (id: string) => void;
}) {
  const { t } = useI18n();
  const infractionLabel = (type: string) => {
    const key = `host.room.infraction.${type}`;
    return isTranslationKey(key) ? t(key) : type;
  };
  return (
    <div className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-lg shadow-xl" data-testid="review-infractions">
      <div className="flex items-center gap-space-xs">
        <ShieldAlert className="h-5 w-5 text-error" />
        <h3 className="text-headline-sm text-on-surface">{t('host.room.infractionsTitle')}</h3>
      </div>
      <p className="text-body-sm text-on-surface-variant">{t('host.room.infractionsHint')}</p>
      {infractions.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">{t('host.room.noInfractions')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {infractions.map((infraction) => (
            <li key={infraction.id} className="flex items-center justify-between rounded-lg bg-error-container/15 px-space-sm py-space-xs">
              <span className="text-label-md text-on-surface">
                {teamName(infraction.team_id)} <span className="text-label-sm text-error">• {infractionLabel(infraction.type)}</span>
              </span>
              <button
                type="button"
                className={`${btn.ghost} px-space-sm py-1 text-label-sm`}
                disabled={busy}
                onClick={() => onDismiss(infraction.id)}
              >
                {t('host.room.dismiss')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaperScoreCard({
  teams,
  busy,
  onAward,
}: {
  teams: { id: string; name: string }[];
  busy: boolean;
  onAward: (teamId: string, points: number, reason: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [teamId, setTeamId] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(points);
    if (!teamId || !Number.isInteger(value) || value === 0) return;
    await onAward(teamId, value, reason);
    setPoints('');
  }

  return (
    <form
      className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-low p-space-lg shadow-xl"
      onSubmit={(event) => void submit(event)}
      data-testid="review-paper"
    >
      <div className="flex items-center gap-space-xs">
        <PenLine className="h-5 w-5 text-secondary" />
        <h3 className="text-headline-sm text-on-surface">{t('host.room.paperTitle')}</h3>
      </div>
      <p className="text-body-sm text-on-surface-variant">{t('host.room.paperHint')}</p>
      <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="paper-team">{t('host.room.team')}</Label>
          <select
            id="paper-team"
            data-testid="paper-team"
            className={inputClass}
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            required
          >
            <option value="">—</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="paper-points">{t('host.editor.points')}</Label>
          <input
            id="paper-points"
            data-testid="paper-points"
            type="number"
            step={1}
            className={inputClass}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="paper-reason">{t('host.room.reason')}</Label>
        <input
          id="paper-reason"
          className={inputClass}
          value={reason}
          maxLength={120}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('host.room.reasonPlaceholder')}
        />
      </div>
      <button type="submit" className={`${btn.secondary} self-end`} disabled={busy || !teamId || !points} data-testid="paper-submit">
        {t('host.room.addPoints')}
      </button>
    </form>
  );
}
