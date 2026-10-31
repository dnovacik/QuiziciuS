import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { QuizRoundDto } from '@quizicius/shared-types';
import { describeError } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { roundedQuestions } from '../../lib/rounds';
import { Modal } from '../../ui/Modal';
import { hostApi, type Quiz } from '../api';
import { btn, inputClass } from '../ui';

const MAX_ROUNDS = 30;
const DEFAULT_BREAK_MINUTES = 10;

/** Rows as typed: numbers stay text until saved, so a field can be cleared while editing. */
interface RoundRow {
  title: string;
  questionCount: string;
  breakMinutes: string;
}

const toRow = (round: QuizRoundDto): RoundRow => ({
  title: round.title,
  questionCount: String(round.questionCount),
  breakMinutes: String(round.breakMinutes),
});

/** The rows as rounds, or null while any row is incomplete. */
export function parseRounds(rows: RoundRow[]): QuizRoundDto[] | null {
  const rounds = rows.map((row) => ({
    title: row.title.trim(),
    questionCount: Number(row.questionCount),
    breakMinutes: Number(row.breakMinutes || 0),
  }));
  const valid = rounds.every(
    (round) =>
      round.title.length > 0 &&
      round.title.length <= 60 &&
      Number.isInteger(round.questionCount) &&
      round.questionCount >= 1 &&
      Number.isInteger(round.breakMinutes) &&
      round.breakMinutes >= 0 &&
      round.breakMinutes <= 120,
  );
  return valid ? rounds : null;
}

/** Rounds of the quiz: a title, how many of the next questions it takes, and the coffee break after it. */
export function RoundsDialog({
  token,
  quiz,
  questionCount,
  onClose,
  onSaved,
}: {
  token: string;
  quiz: Quiz;
  questionCount: number;
  onClose: () => void;
  onSaved: (quiz: Quiz) => void;
}) {
  const { t, plural } = useI18n();
  const [rows, setRows] = useState<RoundRow[]>(() => (quiz.rounds ?? []).map(toRow));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rounds = parseRounds(rows);
  const covered = roundedQuestions(rounds ?? []);

  const update = (index: number, patch: Partial<RoundRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const move = (index: number, by: number) =>
    setRows((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  const add = () =>
    setRows((current) => [
      ...current,
      {
        title: `${t('host.rounds.round')} ${current.length + 1}`,
        // A new round takes the questions no round covers yet, when there are any.
        questionCount: String(Math.max(1, questionCount - roundedQuestions(parseRounds(current) ?? []))),
        breakMinutes: String(DEFAULT_BREAK_MINUTES),
      },
    ]);

  async function save() {
    if (!rounds) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await hostApi.updateQuiz(token, quiz.id, { rounds }));
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <Modal tone="surface" labelledBy="quiz-rounds-title" onClose={onClose} className="max-w-2xl" testId="quiz-rounds-dialog">
      <div className="flex flex-col gap-space-md">
        <div>
          <h3 id="quiz-rounds-title" className="text-headline-sm text-on-surface">
            {t('host.rounds.title')}
          </h3>
          <p className="mt-1 text-body-sm text-on-surface-variant">{t('host.rounds.hint')}</p>
        </div>

        {rows.length === 0 && (
          <p className="rounded-xl bg-surface-container p-space-md text-center text-body-sm text-on-surface-variant">
            {t('host.rounds.none')}
          </p>
        )}
        <ol className="flex flex-col gap-space-sm">
          {rows.map((row, index) => (
            <li
              key={index}
              className="flex flex-wrap items-end gap-space-sm rounded-xl bg-surface-container p-space-sm"
              data-testid={`round-row-${index}`}
            >
              <span className="pb-2 text-label-md text-secondary">#{index + 1}</span>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-label-sm text-on-surface-variant">
                {t('host.rounds.name')}
                <input
                  className={`${inputClass} px-space-sm py-1.5`}
                  value={row.title}
                  maxLength={60}
                  onChange={(event) => update(index, { title: event.target.value })}
                  data-testid={`round-title-${index}`}
                />
              </label>
              <label className="flex w-24 flex-col gap-1 text-label-sm text-on-surface-variant">
                {t('host.rounds.questions')}
                <input
                  className={`${inputClass} px-space-sm py-1.5`}
                  type="number"
                  min={1}
                  value={row.questionCount}
                  onChange={(event) => update(index, { questionCount: event.target.value })}
                  data-testid={`round-count-${index}`}
                />
              </label>
              <label className="flex w-28 flex-col gap-1 text-label-sm text-on-surface-variant">
                {t('host.rounds.break')}
                <input
                  className={`${inputClass} px-space-sm py-1.5`}
                  type="number"
                  min={0}
                  max={120}
                  value={row.breakMinutes}
                  onChange={(event) => update(index, { breakMinutes: event.target.value })}
                  data-testid={`round-break-${index}`}
                />
              </label>
              <div className="flex items-center gap-1 pb-1">
                <button
                  type="button"
                  className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label={t('host.rounds.moveUp')}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label={t('host.rounds.moveDown')}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-1 text-on-surface-variant hover:text-error"
                  aria-label={t('host.rounds.remove')}
                  onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  data-testid={`round-remove-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          className={`${btn.ghost} self-start`}
          disabled={rows.length >= MAX_ROUNDS}
          onClick={add}
          data-testid="round-add"
        >
          <Plus className="h-4 w-4" />
          {t('host.rounds.add')}
        </button>

        {rounds && rows.length > 0 && covered !== questionCount && (
          <p className="text-body-sm text-secondary" data-testid="rounds-coverage">
            {t('host.rounds.coverage')} {covered} / {questionCount} {plural('count.questions', questionCount)}
          </p>
        )}
        {!rounds && <p className="text-body-sm text-error">{t('host.rounds.invalid')}</p>}
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-space-sm pt-space-sm">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {t('host.common.cancel')}
          </button>
          <button type="button" className={btn.primary} disabled={busy || !rounds} onClick={() => void save()} data-testid="rounds-save">
            {busy ? t('common.working') : t('host.editor.applySettings')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
