import { useEffect, useState } from 'react';
import type { AnswerSummaryDto } from '@quizicius/shared-types';
import { useI18n } from '../../lib/i18n';
import { hostApi, type Question } from '../api';
import { btn } from '../ui';
import { responseLabel } from './QuestionPanel';
import type { ControlRoom } from './use-control-room';

function GradeRow({ room, question, answer }: { room: ControlRoom; question: Question; answer: AnswerSummaryDto }) {
  const { t } = useI18n();
  const [points, setPoints] = useState(String(answer.scoreAwarded));
  const [correct, setCorrect] = useState(answer.isCorrect === true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setPoints(String(answer.scoreAwarded));
    setCorrect(answer.isCorrect === true);
  }, [answer.scoreAwarded, answer.isCorrect]);
  const numeric = Number(points);
  const valid = Number.isInteger(numeric) && numeric >= 0 && numeric <= question.points && (correct || numeric === 0);

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await hostApi.overrideAnswerGrade(room.hostToken, answer.id, correct, numeric);
      room.refreshAnswers();
      room.refetch();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('errors.generic'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-surface-container-high p-3" data-testid={`inline-grade-${answer.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{room.state?.teams.find((team) => team.id === answer.teamId)?.name ?? '—'}</span>
        <span className="min-w-0 flex-1 break-words">{responseLabel(question, answer)}</span>
        <span className="text-label-sm">
          {answer.isCorrect === null ? t('host.room.gradePending') : answer.isCorrect ? '✓' : '✗'} · {answer.scoreAwarded} /{' '}
          {question.points}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-label-sm">
          <input
            type="checkbox"
            checked={correct}
            onChange={(event) => {
              setCorrect(event.target.checked);
              if (!event.target.checked) setPoints('0');
              else setPoints(String(question.points));
            }}
          />
          {t('host.room.correct')}
        </label>
        <label className="flex items-center gap-2 text-label-sm">
          {t('host.room.awarded')}
          <input
            type="number"
            min={0}
            max={question.points}
            step={1}
            value={points}
            disabled={!correct}
            onChange={(event) => setPoints(event.target.value)}
            className="w-20 rounded-lg bg-surface-container px-2 py-1 text-on-surface"
            data-testid={`inline-points-${answer.id}`}
          />
        </label>
        <button
          type="button"
          className={btn.secondary}
          disabled={!valid || saving}
          onClick={() => void save()}
          data-testid={`inline-save-${answer.id}`}
        >
          {saving ? t('common.working') : t('host.editor.save')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function InlineGrading({ room, question, answers }: { room: ControlRoom; question: Question; answers: AnswerSummaryDto[] }) {
  const { t } = useI18n();
  return (
    <section className="space-y-2 rounded-xl bg-surface-container p-space-md" data-testid="room-inline-grading">
      <h3 className="text-headline-sm">{t('host.room.answersTitle')}</h3>
      {answers.map((answer) => (
        <GradeRow key={answer.id} room={room} question={question} answer={answer} />
      ))}
      {answers.length === 0 && <p className="text-on-surface-variant">{t('host.room.noAnswers')}</p>}
    </section>
  );
}
