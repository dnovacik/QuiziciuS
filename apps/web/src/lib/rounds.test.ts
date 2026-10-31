import { describe, expect, it } from 'vitest';
import { roundAt, roundBreakAfter, roundedQuestions } from './rounds';

const ROUNDS = [
  { title: 'Music', questionCount: 3, breakMinutes: 10 },
  { title: 'Film', questionCount: 2, breakMinutes: 0 },
  { title: 'Final', questionCount: 2, breakMinutes: 5 },
];

describe('roundAt', () => {
  it('finds the round of a question by its place in the quiz', () => {
    expect(roundAt(ROUNDS, 0)).toMatchObject({ index: 0, first: true, last: false });
    expect(roundAt(ROUNDS, 2)).toMatchObject({ index: 0, first: false, last: true });
    expect(roundAt(ROUNDS, 3)).toMatchObject({ index: 1, first: true });
    expect(roundAt(ROUNDS, 7)).toBeNull();
    expect(roundAt([], 0)).toBeNull();
    expect(roundAt(undefined, 0)).toBeNull();
  });
});

describe('roundBreakAfter', () => {
  it('offers the break after the last question of a round', () => {
    expect(roundBreakAfter(ROUNDS, 2, 7)).toEqual({ finished: ROUNDS[0], next: ROUNDS[1], minutes: 10 });
    expect(roundBreakAfter(ROUNDS, 1, 7)).toBeNull();
  });

  it('offers none for a round without a break, after the final round or after the last question', () => {
    expect(roundBreakAfter(ROUNDS, 4, 7)).toBeNull();
    expect(roundBreakAfter(ROUNDS, 6, 7)).toBeNull();
    expect(roundBreakAfter(ROUNDS, 2, 3)).toBeNull();
  });
});

describe('roundedQuestions', () => {
  it('counts the questions the rounds cover', () => {
    expect(roundedQuestions(ROUNDS)).toBe(7);
    expect(roundedQuestions(undefined)).toBe(0);
  });
});
