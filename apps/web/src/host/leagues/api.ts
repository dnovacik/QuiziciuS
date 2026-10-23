import type { HostLeagueDto, InvitableHostDto, LeagueDetailDto } from '@quizicius/shared-types';
import { apiGet, apiPatch, apiPost } from '../../lib/api-client';

export interface NewLeague {
  name: string;
  pubIds: string[];
  startsOn: string;
  endsOn: string | null;
  message: string;
  inviteHostIds: string[];
}

export const leaguesApi = {
  list: (token: string) => apiGet<HostLeagueDto[]>('/leagues', token),
  detail: (token: string, leagueId: string) => apiGet<LeagueDetailDto>(`/leagues/${leagueId}`, token),
  invitableHosts: (token: string) => apiGet<InvitableHostDto[]>('/leagues/hosts', token),
  create: (token: string, league: NewLeague) => apiPost<LeagueDetailDto>('/leagues', league, token),
  update: (token: string, leagueId: string, patch: Partial<Pick<NewLeague, 'name' | 'endsOn' | 'message'>> & { startsOn?: string }) =>
    apiPatch<LeagueDetailDto>(`/leagues/${leagueId}`, patch, token),
  accept: (token: string, leagueId: string, pubIds: string[]) =>
    apiPost<LeagueDetailDto>(`/leagues/${leagueId}/hosts/me/accept`, { pubIds }, token),
  decline: (token: string, leagueId: string) => apiPost<LeagueDetailDto>(`/leagues/${leagueId}/hosts/me/decline`, {}, token),
  close: (token: string, leagueId: string) => apiPost<LeagueDetailDto>(`/leagues/${leagueId}/close`, {}, token),
  createSuperLeague: (token: string, leagueId: string) => apiPost<LeagueDetailDto>(`/leagues/${leagueId}/super-league`, {}, token),
};
