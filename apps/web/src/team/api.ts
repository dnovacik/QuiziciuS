import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client';
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
  mine: (token: string) => apiGet<RegisteredTeam[]>('/registered-teams/mine', token),
  availability: (token: string, name: string) =>
    apiGet<{ available: boolean; code: string }>(`/registered-teams/availability/${encodeURIComponent(name.trim().toLowerCase())}`, token),
  create: (token: string, profile: TeamProfile) =>
    apiPost<RegisteredTeam>('/registered-teams', { ...profile, name: profile.name.trim() }, token),
  update: (token: string, teamId: string, profile: TeamProfile) =>
    apiPatch<RegisteredTeam>(`/registered-teams/${teamId}`, { ...profile, name: profile.name.trim() }, token),
  players: (token: string, teamId: string) => apiGet<Player[]>(`/registered-teams/${teamId}/players`, token),
  addPlayer: (token: string, teamId: string, name: string) =>
    apiPost<Player>(`/registered-teams/${teamId}/players`, { name: name.trim() }, token),
  renamePlayer: (token: string, teamId: string, playerId: string, name: string) =>
    apiPatch<Player>(`/registered-teams/${teamId}/players/${playerId}`, { name: name.trim() }, token),
  removePlayer: (token: string, teamId: string, playerId: string) => apiDelete(`/registered-teams/${teamId}/players/${playerId}`, token),
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
