import type { QuizRoundDto } from '@quizicius/shared-types';

/** Where a question sits in the quiz's rounds. */
export interface RoundPlace {
  index: number;
  round: QuizRoundDto;
  /** The round's first and last question. */
  first: boolean;
  last: boolean;
}

/** The round of the question at `position` in quiz order; null without rounds or past the last one. */
export function roundAt(rounds: QuizRoundDto[] | null | undefined, position: number): RoundPlace | null {
  if (position < 0) return null;
  let start = 0;
  for (const [index, round] of (rounds ?? []).entries()) {
    const end = start + round.questionCount;
    if (position < end) return { index, round, first: position === start, last: position === end - 1 };
    start = end;
  }
  return null;
}

/** How many questions the rounds cover, to compare with the quiz's questions. */
export function roundedQuestions(rounds: QuizRoundDto[] | null | undefined): number {
  return (rounds ?? []).reduce((sum, round) => sum + round.questionCount, 0);
}

export interface RoundBreak {
  finished: QuizRoundDto;
  next: QuizRoundDto;
  minutes: number;
}

/**
 * The coffee break after the question at `position`: when it closes a round with a break and
 * another round with questions follows. None after the final round.
 */
export function roundBreakAfter(rounds: QuizRoundDto[] | null | undefined, position: number, questionCount: number): RoundBreak | null {
  const here = roundAt(rounds, position);
  if (!here?.last || here.round.breakMinutes <= 0 || position + 1 >= questionCount) return null;
  const next = rounds?.[here.index + 1];
  return next ? { finished: here.round, next, minutes: here.round.breakMinutes } : null;
}
