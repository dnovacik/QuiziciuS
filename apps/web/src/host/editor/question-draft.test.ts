import { describe, expect, it } from 'vitest';
import { blankQuestion, cleanForSave, listedVariants } from './question-draft';

describe('listedVariants', () => {
  it('finds variants written as a list in one field', () => {
    expect(listedVariants('Missouri, Misouri')).toEqual(['Missouri', 'Misouri']);
    expect(listedVariants('Missouri; Misouri ;')).toEqual(['Missouri', 'Misouri']);
  });

  it('leaves single answers alone', () => {
    expect(listedVariants('Missouri')).toBeNull();
    expect(listedVariants('Missouri,')).toBeNull();
    expect(listedVariants('')).toBeNull();
  });
});

describe('blankQuestion', () => {
  it('is worth one point, as most pub quizzes score one point per question', () => {
    expect(blankQuestion(0).points).toBe(1);
  });
});

describe('cleanForSave', () => {
  it('expands several variants and discards blank alternatives', () => {
    const draft = { ...blankQuestion(0), type: 'FREE_TEXT' as const, accepted_answers: ['Bratislava, Pressburg', 'Pozsony', '  ', 'Prešporok; Presporok'] };
    expect(cleanForSave(draft).accepted_answers).toEqual(['Bratislava', 'Pressburg', 'Pozsony', 'Prešporok', 'Presporok']);
  });
});
