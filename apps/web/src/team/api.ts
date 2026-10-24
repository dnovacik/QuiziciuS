import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client';
import type { AccountDto, PubLeaderboardDto, TeamLeagueDto, TeamScheduledNightDto } from '@quizicius/shared-types';
import type { Pub } from '../lib/pubs';
import { saveSeat, type TeamSeat } from '../lib/team-seat';

export const BADGES = ['shield', 'crown', 'bolt', 'star', 'brain', 'trophy'] as const;
export const COLORS = ['purple', 'amber', 'cyan', 'green', 'pink'] as const;
export type Badge = (typeof BADGES)[number];
export type TeamColor = (typeof COLORS)[number];

export interface RegisteredTeam {
  id: string;
  name: string;
  description: string | null;
  badge: Badge;
  badge_color: TeamColor;
  expected_members: number;
  /** Legacy free-text home pub from before pubs were shared records; shown only until pubs are picked. */
  home_pub: string | null;
  /** The pubs the team plays at, primary first. */
  pubs: TeamPub[];
  created_at: string;
}

export interface TeamPub extends Pub {
  isPrimary: boolean;
}

/** A team can play at several pubs; the primary one is the pub it represents in leagues. */
export const MAX_TEAM_PUBS = 5;

export interface TeamAccess {
  pin: string;
  inviteToken: string;
}

/** The link a teammate opens to put their name on the roster. */
export function inviteUrl(inviteToken: string): string {
  return new URL(`/join-team/${inviteToken}`, window.location.origin).href;
}

export interface Player {
  id: string;
  name: string;
  created_at: string;
}

export interface TeamProfile {
  name: string;
  description: string;
  badge: Badge;
  color: TeamColor;
  expectedMembers: number;
  pubIds: string[];
  primaryPubId: string | null;
}

export const MAX_PLAYERS = 6;

export const teamApi = {
  /** The captain's own name, shown instead of the e-mail; empty resets it to the e-mail. */
  renameCaptain: (token: string, displayName: string) => apiPatch<AccountDto>('/me', { displayName: displayName.trim() }, token),
  mine: (token: string) => apiGet<RegisteredTeam[]>('/registered-teams/mine', token),
  availability: (token: string, name: string) =>
    apiGet<{ available: boolean; code: string }>(`/registered-teams/availability/${encodeURIComponent(name.trim().toLowerCase())}`, token),
  create: (token: string, profile: TeamProfile) =>
    apiPost<RegisteredTeam>('/registered-teams', { ...profile, name: profile.name.trim() }, token),
  update: (token: string, teamId: string, profile: TeamProfile) =>
    apiPatch<RegisteredTeam>(`/registered-teams/${teamId}`, { ...profile, name: profile.name.trim() }, token),
  players: (token: string, teamId: string) => apiGet<Player[]>(`/registered-teams/${teamId}/players`, token),
  /** The team PIN and invite link secret; created on first use. */
  access: (token: string, teamId: string) => apiGet<TeamAccess>(`/registered-teams/${teamId}/access`, token),
  rotateAccess: (token: string, teamId: string, what: 'pin' | 'invite') =>
    apiPost<TeamAccess>(`/registered-teams/${teamId}/access/rotate`, { what }, token),
  addPlayer: (token: string, teamId: string, name: string) =>
    apiPost<Player>(`/registered-teams/${teamId}/players`, { name: name.trim() }, token),
  renamePlayer: (token: string, teamId: string, playerId: string, name: string) =>
    apiPatch<Player>(`/registered-teams/${teamId}/players/${playerId}`, { name: name.trim() }, token),
  removePlayer: (token: string, teamId: string, playerId: string) => apiDelete(`/registered-teams/${teamId}/players/${playerId}`, token),
  leagues: (token: string, teamId: string) => apiGet<TeamLeagueDto[]>(`/registered-teams/${teamId}/leagues`, token),
  /** Quiz nights planned at the team's pubs, soonest first. */
  schedule: (token: string, teamId: string) => apiGet<TeamScheduledNightDto[]>(`/registered-teams/${teamId}/schedule`, token),
  /** A pub's table over its finished quiz nights: this year, or all of them. */
  pubLeaderboard: (token: string, pubId: string, period: 'year' | 'all') =>
    apiGet<PubLeaderboardDto>(`/registered-teams/pubs/${pubId}/leaderboard?period=${period}`, token),
  respondToLeague: (token: string, teamId: string, leagueId: string, join: boolean) =>
    apiPost<TeamLeagueDto>(`/registered-teams/${teamId}/leagues/${leagueId}/${join ? 'join' : 'decline'}`, {}, token),
  /** Links the phone's one-off team (its seat) to this registered team; the seat keeps its token. */
  claimSeat: async (token: string, teamId: string, seat: TeamSeat): Promise<TeamSeat> => {
    await apiPost<{ teamId: string; token: string }>(
      `/registered-teams/${teamId}/sessions/${seat.sessionId}/claim`,
      { teamToken: seat.token },
      token,
    );
    const claimed = { sessionId: seat.sessionId, teamId: seat.teamId, token: seat.token };
    saveSeat(claimed);
    return claimed;
  },
  /** The captain joins a live session as this registered team; the seat is stored like any team's. */
  joinSession: async (token: string, teamId: string, sessionId: string): Promise<TeamSeat> => {
    const result = await apiPost<{ teamId: string; token: string }>(`/registered-teams/${teamId}/sessions/${sessionId}/join`, {}, token);
    const seat = { sessionId, teamId: result.teamId, token: result.token };
    saveSeat(seat);
    return seat;
  },
};

export function profileOf(team: RegisteredTeam): TeamProfile {
  return {
    name: team.name,
    description: team.description ?? '',
    badge: team.badge,
    color: team.badge_color,
    expectedMembers: team.expected_members,
    pubIds: team.pubs.map((pub) => pub.id),
    primaryPubId: team.pubs.find((pub) => pub.isPrimary)?.id ?? null,
  };
}
