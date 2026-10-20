import { gradeMultipleChoice } from './multiple-choice-grader';

describe('gradeMultipleChoice', () => {
  it('is correct when the selected option matches', () => {
    expect(gradeMultipleChoice('opt-a', 'opt-a')).toBe(true);
  });

  it('is incorrect when the selected option does not match', () => {
    expect(gradeMultipleChoice('opt-b', 'opt-a')).toBe(false);
  });
});
