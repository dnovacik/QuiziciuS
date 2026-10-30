import { distance } from 'fastest-levenshtein';

export interface FreeTextGradeResult {
  isCorrect: boolean | null;
  needsReview: boolean;
  confidence: number;
  matchedAnswer: string | null;
}

export function normalizeAnswer(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenSort(normalized: string): string {
  return normalized.split(' ').filter(Boolean).sort().join(' ');
}

function similarity(a: string, b: string): number {
  const sortedA = tokenSort(a);
  const sortedB = tokenSort(b);
  const maxLen = Math.max(sortedA.length, sortedB.length);
  if (maxLen === 0) return 1;
  return 1 - distance(sortedA, sortedB) / maxLen;
}

const AUTO_ACCEPT_THRESHOLD = 0.8;
const REVIEW_THRESHOLD = 0.5;

export function gradeFreeText(response: string, acceptedAnswers: string[]): FreeTextGradeResult {
  const normalizedResponse = normalizeAnswer(response);

  // An exact normalized match should never depend on a fuzzy acceptance threshold.
  for (const accepted of acceptedAnswers) {
    if (normalizedResponse && normalizedResponse === normalizeAnswer(accepted)) {
      return { isCorrect: true, needsReview: false, confidence: 1, matchedAnswer: accepted };
    }
  }

  let best: { answer: string | null; confidence: number } = { answer: null, confidence: 0 };
  for (const accepted of acceptedAnswers) {
    const confidence = similarity(normalizedResponse, normalizeAnswer(accepted));
    if (confidence > best.confidence) {
      best = { answer: accepted, confidence };
    }
  }

  if (best.confidence >= AUTO_ACCEPT_THRESHOLD) {
    return { isCorrect: true, needsReview: false, confidence: best.confidence, matchedAnswer: best.answer };
  }
  if (best.confidence >= REVIEW_THRESHOLD) {
    return { isCorrect: null, needsReview: true, confidence: best.confidence, matchedAnswer: best.answer };
  }
  return { isCorrect: false, needsReview: false, confidence: best.confidence, matchedAnswer: best.answer };
}
