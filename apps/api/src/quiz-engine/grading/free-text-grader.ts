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

/**
 * Every answer the host accepts: each entry as written, plus the parts of an entry written as a
 * list ("Bratislava, Pressburg; Pozsony"). Questions saved before the editor split such lists, and
 * CSV imports, still hold them in one entry.
 */
export function acceptedVariants(acceptedAnswers: string[]): string[] {
  const variants = new Set<string>();
  for (const accepted of acceptedAnswers) {
    if (accepted.trim()) variants.add(accepted.trim());
    for (const part of accepted.split(/[,;]/)) if (part.trim()) variants.add(part.trim());
  }
  return [...variants];
}

export function gradeFreeText(response: string, rawAcceptedAnswers: string[]): FreeTextGradeResult {
  const normalizedResponse = normalizeAnswer(response);
  const acceptedAnswers = acceptedVariants(rawAcceptedAnswers);

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
