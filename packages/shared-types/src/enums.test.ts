import { describe, expect, it } from 'vitest';
import { QUIZ_STATES, QUESTION_TYPES, INFRACTION_TYPES } from './enums';

describe('enums', () => {
  it('lists all quiz states from the spec', () => {
    expect(QUIZ_STATES).toEqual(['LOBBY', 'LOCK_IN_ROUND', 'QUESTION_ACTIVE', 'QUESTION_REVEAL', 'PAUSE_BREAK', 'FINISHED']);
  });

  it('lists all question types from the spec', () => {
    expect(QUESTION_TYPES).toEqual(['MULTIPLE_CHOICE', 'FREE_TEXT', 'NUMERIC_NEAREST']);
  });

  it('lists all infraction types', () => {
    expect(INFRACTION_TYPES).toEqual(['VISIBILITY_HIDDEN', 'FULLSCREEN_EXIT', 'WAKE_LOCK_LOST']);
  });
});
