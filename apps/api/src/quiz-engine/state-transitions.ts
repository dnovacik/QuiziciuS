import { QuizState } from '@quizicius/shared-types';

const TRANSITIONS: Record<QuizState, QuizState[]> = {
  LOBBY: ['LOCK_IN_ROUND', 'FINISHED'],
  LOCK_IN_ROUND: ['QUESTION_ACTIVE', 'FINISHED'],
  QUESTION_ACTIVE: ['QUESTION_REVEAL', 'FINISHED'],
  QUESTION_REVEAL: ['LOCK_IN_ROUND', 'PAUSE_BREAK', 'FINISHED'],
  PAUSE_BREAK: ['LOCK_IN_ROUND', 'FINISHED'],
  FINISHED: [],
};

export function isValidTransition(from: QuizState, to: QuizState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: QuizState,
    public readonly to: QuizState,
  ) {
    super(`Cannot transition from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function assertValidTransition(from: QuizState, to: QuizState): void {
  if (!isValidTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
