import { apiGet, apiPost } from './api-client';

/** A team's place in one quiz session: the bearer token it answers with. */
export interface TeamSeat {
  sessionId: string;
  teamId: string;
  token: string;
}

const storageKey = (sessionId: string) => `quizicius:team:${sessionId}`;

export function normalizeJoinCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export async function findSessionByCode(code: string): Promise<string> {
  const session = await apiGet<{ id: string }>(`/sessions/by-code/${encodeURIComponent(normalizeJoinCode(code))}`);
  return session.id;
}

export async function joinSession(sessionId: string, teamName: string): Promise<TeamSeat> {
  const result = await apiPost<{ teamId: string; token: string }>(`/sessions/${sessionId}/teams/join`, {
    name: teamName.trim(),
  });
  const seat = { sessionId, teamId: result.teamId, token: result.token };
  saveSeat(seat);
  rememberTeamName(teamName.trim());
  return seat;
}

const RECENT_TEAMS_KEY = 'quizicius:recent-teams';

/** Team names used on this device, newest first — offered as one-tap chips on the join screen. */
export function recentTeamNames(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_TEAMS_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function rememberTeamName(name: string): void {
  try {
    const names = [name, ...recentTeamNames().filter((item) => item !== name)].slice(0, 3);
    localStorage.setItem(RECENT_TEAMS_KEY, JSON.stringify(names));
  } catch {
    // Optional convenience only.
  }
}

export function saveSeat(seat: TeamSeat): void {
  try {
    localStorage.setItem(storageKey(seat.sessionId), JSON.stringify(seat));
  } catch {
    // Best effort: the game still works in this tab without persistence.
  }
}

export function loadSeat(sessionId: string | undefined): TeamSeat | null {
  if (!sessionId) return null;
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as TeamSeat) : null;
  } catch {
    return null;
  }
}
