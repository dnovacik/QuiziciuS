import { QuizState } from '@quizicius/shared-types';
import { SessionRecord } from '../data/sessions.repository';

/** Matches the answer submission grace period: results stay hidden while late answers may still land. */
export const RESULT_GRACE_MS = 2000;

const REVEALED_STATES: readonly QuizState[] = ['QUESTION_REVEAL', 'PAUSE_BREAK', 'FINISHED'];

/**
 * Whether grading for the session's current question may be exposed (scores, a team's own result).
 * Results become visible once the host reveals the answer or the question's timer has run out —
 * never while teams can still submit, so an early answer cannot tell anyone what is correct.
 */
export function currentQuestionResultsVisible(
  session: Pick<SessionRecord, 'status' | 'question_ends_at'>,
  now: number = Date.now(),
): boolean {
  if (REVEALED_STATES.includes(session.status)) return true;
  if (session.status !== 'QUESTION_ACTIVE' || !session.question_ends_at) return false;
  return now > Date.parse(session.question_ends_at) + RESULT_GRACE_MS;
}

/** Answers to the current question are hidden until its results are visible; earlier questions always count. */
export function isAnswerResultVisible(
  answer: { question_id: string },
  session: Pick<SessionRecord, 'status' | 'question_ends_at' | 'current_question_id'>,
  now: number = Date.now(),
): boolean {
  return answer.question_id !== session.current_question_id || currentQuestionResultsVisible(session, now);
}
