import { apiGet, apiPost } from './api-client';

/** A team's place in one quiz session: the bearer token it answers with. */
export type AttendanceMode = 'IN_PERSON' | 'REMOTE';

export interface TeamSeat {
  attendanceMode?: AttendanceMode;
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

/**
 * What a scanned QR code points to: a quiz night's join link (`…/play/<id>`) or a bare 4-character
 * join code; null for anything else.
 */
export function parseJoinTarget(text: string): { sessionId: string } | { code: string } | null {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/^\/play\/([^/]+)\/?$/);
    return match ? { sessionId: decodeURIComponent(match[1]) } : null;
  } catch {
    const code = normalizeJoinCode(trimmed);
    return /^[A-Z0-9]{4}$/.test(code) && trimmed.replace(/[\s-]/g, '').length === 4 ? { code } : null;
  }
}

export async function findSessionByCode(code: string): Promise<string> {
  const session = await apiGet<{ id: string }>(`/sessions/by-code/${encodeURIComponent(normalizeJoinCode(code))}`);
  return session.id;
}

/**
 * Joins a quiz night; the table number (optional) helps the host find the team in the room.
 * With the team PIN, the phone joins as the registered team of that name (e.g. without the captain).
 */
export async function joinSession(sessionId: string, teamName: string, tableNumber = '', teamPin = '', attendanceMode: AttendanceMode = 'IN_PERSON'): Promise<TeamSeat> {
  const body = {
    name: teamName.trim(),
    ...(tableNumber.trim() ? { tableNumber: tableNumber.trim() } : {}),
  };
  const result = teamPin.trim()
    ? await apiPost<{ teamId: string; token: string }>(`/team-access/sessions/${sessionId}/join`, { ...body, pin: teamPin.trim() })
    : await apiPost<{ teamId: string; token: string }>(`/sessions/${sessionId}/teams/join`, body);
  const seat = { sessionId, teamId: result.teamId, token: result.token, attendanceMode };
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

/** A one-off team on a league night that went to register; picked up by the team page. */
export interface PendingClaim extends TeamSeat {
  teamName: string;
}

const PENDING_CLAIM_KEY = 'quizicius:pending-claim';

export function savePendingClaim(claim: PendingClaim): void {
  try {
    sessionStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(claim));
  } catch {
    // Without storage the player can still register later from the team page.
  }
}

export function pendingClaim(): PendingClaim | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CLAIM_KEY);
    return raw ? (JSON.parse(raw) as PendingClaim) : null;
  } catch {
    return null;
  }
}

export function clearPendingClaim(): void {
  try {
    sessionStorage.removeItem(PENDING_CLAIM_KEY);
  } catch {
    // Nothing to clear.
  }
}
