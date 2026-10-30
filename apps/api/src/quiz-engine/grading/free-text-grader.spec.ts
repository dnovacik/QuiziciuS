import { gradeFreeText, normalizeAnswer } from './free-text-grader';

describe('normalizeAnswer', () => {
  it('lowercases, strips punctuation and diacritics, and collapses whitespace', () => {
    expect(normalizeAnswer('  Zürich,  Switzerland! ')).toBe('zurich switzerland');
  });
});

describe('gradeFreeText', () => {
  it('auto-accepts an exact match', () => {
    const result = gradeFreeText('Paris', ['Paris']);
    expect(result).toMatchObject({ isCorrect: true, needsReview: false, matchedAnswer: 'Paris' });
    expect(result.confidence).toBe(1);
  });

  it('auto-accepts reordered words via token-sort comparison', () => {
    const result = gradeFreeText('France, Paris', ['Paris, France']);
    expect(result).toMatchObject({ isCorrect: true, needsReview: false });
  });

  it('sends a close-but-not-exact answer to review', () => {
    // "Pahris" vs "Paris": edit distance 1 over max length 6 -> confidence ~0.83, but with the
    // extra token-sort pass on single words this still lands in the review band for a near-miss.
    const result = gradeFreeText('Pahhris', ['Paris']);
    expect(result.needsReview).toBe(true);
    expect(result.isCorrect).toBeNull();
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.8);
  });

  it('auto-rejects an unrelated answer', () => {
    const result = gradeFreeText('Berlin', ['Paris']);
    expect(result).toMatchObject({ isCorrect: false, needsReview: false });
  });

  it('accepts the fourth or fifth alternative', () => {
    expect(gradeFreeText('Prešporok', ['Bratislava', 'Pressburg', 'Pozsony', 'Prešporok', 'Presporok']))
      .toMatchObject({ isCorrect: true, needsReview: false, matchedAnswer: 'Prešporok' });
  });

  it('accepts a fuzzy score exactly on the acceptance threshold', () => {
    // "abcdx" versus "abcde" is 0.8 similar.
    expect(gradeFreeText('abcdx', ['abcde']).isCorrect).toBe(true);
  });

  it('picks the best match across multiple accepted answers', () => {
    const result = gradeFreeText('JFK', ['John F. Kennedy', 'JFK']);
    expect(result).toMatchObject({ isCorrect: true, matchedAnswer: 'JFK' });
  });
});
