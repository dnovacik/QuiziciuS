import { useCallback, useState } from 'react';
import type { AnswerSummaryDto } from '@quizicius/shared-types';

/** What this device sent for a question, plus the server's grading of it. */
export interface SubmittedAnswer {
  /** Human-readable answer ("B — Forrest Gump", "1994"). */
  display: string;
  /** Option letter for multiple choice, shown in the answer plate. */
  letter: string | null;
  submittedAt: number;
  result: AnswerSummaryDto;
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

/**
 * Keeps the team's answers for this session across question changes and page reloads,
 * so the locked and reveal screens can show what was sent and how it was graded.
 */
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
