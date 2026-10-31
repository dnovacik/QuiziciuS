import { useCallback, useEffect, useState } from 'react';
import type { AnswerSummaryDto, QuestionPublicDto } from '@quizicius/shared-types';
import { apiGet } from '../lib/api-client';
import { optionLetter, withUnit } from '../lib/quiz';
import { subscribeToSession } from '../lib/supabase-client';

/** What this device sent for a question, kept so the locked screen can show it back. */
export interface SubmittedAnswer {
  /** Human-readable answer ("Forrest Gump", "1994"). */
  display: string;
  /** Option letter for multiple choice, shown in the answer plate. */
  letter: string | null;
  submittedAt: number;
}

type AnswersByQuestion = Record<string, SubmittedAnswer>;

const storageKey = (sessionId: string) => `quizicius:answers:${sessionId}`;

function load(sessionId: string): AnswersByQuestion {
  try {
    return JSON.parse(localStorage.getItem(storageKey(sessionId)) ?? '{}') as AnswersByQuestion;
  } catch {
    return {};
  }
}

/** Keeps what the team sent across question changes and page reloads. */
export function useSubmittedAnswers(sessionId: string) {
  const [answers, setAnswers] = useState<AnswersByQuestion>(() => load(sessionId));

  const record = useCallback(
    (questionId: string, answer: SubmittedAnswer) => {
      setAnswers((current) => {
        const next = { ...current, [questionId]: answer };
        try {
          localStorage.setItem(storageKey(sessionId), JSON.stringify(next));
        } catch {
          // Storage blocked: the answer is still kept for this tab.
        }
        return next;
      });
    },
    [sessionId],
  );

  return { answers, record };
}

/**
 * The team's graded answers from the server. Grades of the open question are withheld by the API
 * until its timer has run out or the host reveals it. The response itself is still safe to
 * retrieve during answering, allowing an interrupted phone to recover its saved submission.
 */
export function useGradedAnswers(sessionId: string, token: string, refreshKey: string | null) {
  const [graded, setGraded] = useState<Record<string, AnswerSummaryDto>>({});
  // A submission, a reveal or a host's correction changes grades without a state change.
  const [scoreVersion, setScoreVersion] = useState(0);

  useEffect(() => subscribeToSession(sessionId, () => setScoreVersion((version) => version + 1), ['SCORE_UPDATE']), [sessionId]);

  useEffect(() => {
    if (refreshKey === null) return;
    let active = true;
    apiGet<AnswerSummaryDto[]>(`/sessions/${sessionId}/answers/mine`, token)
      .then((rows) => {
        if (active) setGraded(Object.fromEntries(rows.map((row) => [row.questionId, row])));
      })
      .catch(() => {
        // The reveal screen falls back to "still being graded".
      });
    return () => {
      active = false;
    };
  }, [sessionId, token, refreshKey, scoreVersion]);

  return graded;
}

/** Display form of an answer the server holds (e.g. sent from another device of the team). */
export function describeResponse(question: QuestionPublicDto, response: unknown): Pick<SubmittedAnswer, 'display' | 'letter'> {
  const value = (response ?? {}) as { optionId?: string; text?: string; value?: number };
  if (question.type === 'MULTIPLE_CHOICE') {
    const index = question.options?.findIndex((option) => option.id === value.optionId) ?? -1;
    return index >= 0 ? { display: question.options![index].label, letter: optionLetter(index) } : { display: '—', letter: null };
  }
  if (question.type === 'FREE_TEXT') return { display: value.text ?? '—', letter: null };
  return { display: value.value === undefined ? '—' : withUnit(value.value, question.unit), letter: null };
}
