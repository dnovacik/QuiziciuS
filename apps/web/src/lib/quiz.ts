import { useEffect, useState } from 'react';
import type { QuestionPublicDto, TeamSummaryDto } from '@quizicius/shared-types';

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** The answer to show once a question is revealed; null before the server releases it. */
/** A number with the question's unit after it, e.g. "1994" or "384 km". */
export function withUnit(value: number | string, unit: string | null | undefined): string {
  return unit ? `${value} ${unit}` : String(value);
}

export function correctAnswerText(question: QuestionPublicDto): string | null {
  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      const index = question.options?.findIndex((option) => option.id === question.correctOptionId) ?? -1;
      return index >= 0 ? (question.options?.[index].label ?? null) : null;
    }
    case 'FREE_TEXT':
      return question.acceptedAnswers?.length ? question.acceptedAnswers.join(', ') : null;
    case 'NUMERIC_NEAREST':
      return question.correctNumeric === null ? null : withUnit(question.correctNumeric, question.unit);
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

/** Whole seconds until the deadline; a paused timer stands still at the moment it was paused. */
export function secondsLeft(endsAt: string | null, now: number, pausedAt: string | null = null): number | null {
  if (!endsAt) return null;
  const at = pausedAt ? Date.parse(pausedAt) : now;
  return Math.max(0, Math.ceil((Date.parse(endsAt) - at) / 1000));
}

/** Questions with a 0 s limit have no timer: answering stays open until the host closes it. */
export function isUntimed(timeLimitSeconds: number): boolean {
  return timeLimitSeconds <= 0;
}

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "m:ss" left until a break ends, or null without a planned end; it stays at 0:00 once over. */
export function breakClock(endsAt: string | null, now: number): string | null {
  if (!endsAt) return null;
  return formatClock(Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000)));
}
