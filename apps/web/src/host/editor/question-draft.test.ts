import { describe, expect, it } from 'vitest';
import { blankQuestion } from './question-draft';

describe('blankQuestion', () => {
  it('is worth one point, as most pub quizzes score one point per question', () => {
    expect(blankQuestion(0).points).toBe(1);
  });
});
