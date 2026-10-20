import { gradeNumericNearest } from './numeric-grader';

describe('gradeNumericNearest', () => {
  it('returns an empty array for no answers', () => {
    expect(gradeNumericNearest([], 100)).toEqual([]);
  });

  it('marks the single closest answer correct', () => {
    const results = gradeNumericNearest(
      [
        { teamId: 't1', value: 90 },
        { teamId: 't2', value: 150 },
      ],
      100,
    );
    expect(results.find((r) => r.teamId === 't1')).toMatchObject({ isCorrect: true, distance: 10 });
    expect(results.find((r) => r.teamId === 't2')).toMatchObject({ isCorrect: false, distance: 50 });
  });

  it('marks every tied closest answer correct', () => {
    const results = gradeNumericNearest(
      [
        { teamId: 't1', value: 90 },
        { teamId: 't2', value: 110 },
        { teamId: 't3', value: 50 },
      ],
      100,
    );
    expect(results.find((r) => r.teamId === 't1')?.isCorrect).toBe(true);
    expect(results.find((r) => r.teamId === 't2')?.isCorrect).toBe(true);
    expect(results.find((r) => r.teamId === 't3')?.isCorrect).toBe(false);
  });
});
