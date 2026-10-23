import { useEffect, useState } from 'react';
import type { QuestionPublicDto, TeamSummaryDto } from '@quizicius/shared-types';

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** The answer to show once a question is revealed; null before the server releases it. */
export function correctAnswerText(question: QuestionPublicDto): string | null {
  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      const index = question.options?.findIndex((option) => option.id === question.correctOptionId) ?? -1;
      return index >= 0 ? (question.options?.[index].label ?? null) : null;
    }
    case 'FREE_TEXT':
      return question.acceptedAnswers?.length ? question.acceptedAnswers.join(', ') : null;
    case 'NUMERIC_NEAREST':
      return question.correctNumeric === null ? null : String(question.correctNumeric);
  }
}

export interface RankedTeam extends TeamSummaryDto {
  rank: number;
}

/** Sorts by score; tied teams share a rank (1, 2, 2, 4). */
export function rankTeams(teams: TeamSummaryDto[]): RankedTeam[] {
  const sorted = [...teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return sorted.map((team) => ({ ...team, rank: sorted.filter((other) => other.score > team.score).length + 1 }));
}

/** Current time, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function secondsLeft(endsAt: string | null, now: number): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000));
}

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
