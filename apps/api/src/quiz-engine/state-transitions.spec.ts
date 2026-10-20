import { QUIZ_STATES, QuizState } from '@quizicius/shared-types';
import { InvalidTransitionError, assertValidTransition, isValidTransition } from './state-transitions';

const LEGAL: [QuizState, QuizState][] = [
  ['LOBBY', 'LOCK_IN_ROUND'],
  ['LOBBY', 'FINISHED'],
  ['LOCK_IN_ROUND', 'QUESTION_ACTIVE'],
  ['LOCK_IN_ROUND', 'FINISHED'],
  ['QUESTION_ACTIVE', 'QUESTION_REVEAL'],
  ['QUESTION_ACTIVE', 'FINISHED'],
  ['QUESTION_REVEAL', 'LOCK_IN_ROUND'],
  ['QUESTION_REVEAL', 'PAUSE_BREAK'],
  ['QUESTION_REVEAL', 'FINISHED'],
  ['PAUSE_BREAK', 'LOCK_IN_ROUND'],
  ['PAUSE_BREAK', 'FINISHED'],
];

describe('state-transitions', () => {
  it.each(LEGAL)('allows %s -> %s', (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  it('rejects every other combination', () => {
    const legalSet = new Set(LEGAL.map(([f, t]) => `${f}->${t}`));
    for (const from of QUIZ_STATES) {
      for (const to of QUIZ_STATES) {
        if (!legalSet.has(`${from}->${to}`)) {
          expect(isValidTransition(from, to)).toBe(false);
        }
      }
    }
  });

  it('FINISHED has no outgoing transitions', () => {
    for (const to of QUIZ_STATES) {
      expect(isValidTransition('FINISHED', to)).toBe(false);
    }
  });

  it('assertValidTransition throws InvalidTransitionError on an illegal edge', () => {
    expect(() => assertValidTransition('LOBBY', 'QUESTION_ACTIVE')).toThrow(InvalidTransitionError);
  });

  it('assertValidTransition does not throw on a legal edge', () => {
    expect(() => assertValidTransition('LOBBY', 'LOCK_IN_ROUND')).not.toThrow();
  });
});
