import { LEAGUE_PLACE_POINTS, LeagueStandingDto } from '@quizicius/shared-types';

/** One finished league night: every session team's final score; one-off teams have no registered team. */
export interface NightResult {
  sessionId: string;
  finishedAt: string;
  pubId: string | null;
  teams: { registeredTeamId: string | null; score: number }[];
}

export interface LeagueMember {
  registeredTeamId: string;
  teamName: string;
  pubId: string | null;
}

/** 10, 8, 6, 5, 4, 3, 2, 1 for places 1–8, then 0. */
export function placePoints(place: number): number {
  return LEAGUE_PLACE_POINTS[place - 1] ?? 0;
}

/** Competition ranking (1, 1, 3) of `items` by `score` descending; equal scores share a rank. */
function competitionRanks<T>(items: T[], compare: (a: T, b: T) => number): number[] {
  return items.map((_, index) => {
    let rank = index;
    while (rank > 0 && compare(items[rank - 1], items[index]) === 0) rank--;
    return rank + 1;
  });
}

/** Places of the registered teams on one night; one-off teams are left out and do not push anyone down. */
export function rankNight(teams: NightResult['teams']): Map<string, number> {
  const linked = teams.filter((team): team is { registeredTeamId: string; score: number } => team.registeredTeamId !== null);
  linked.sort((a, b) => b.score - a.score);
  const ranks = competitionRanks(linked, (a, b) => b.score - a.score);
  return new Map(linked.map((team, index) => [team.registeredTeamId, ranks[index]]));
}

function inNightOrder(nights: NightResult[]): NightResult[] {
  return [...nights].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
}

/** Counts of 1st … 8th places; only places that score points break ties. */
function placeCounts(placements: number[]): number[] {
  return LEAGUE_PLACE_POINTS.map((_, index) => placements.filter((place) => place === index + 1).length);
}

function compareRecords(a: LeagueStandingDto, b: LeagueStandingDto): number {
  if (b.points !== a.points) return b.points - a.points;
  const countsA = placeCounts(a.placements);
  const countsB = placeCounts(b.placements);
  for (let i = 0; i < countsA.length; i++) {
    if (countsB[i] !== countsA[i]) return countsB[i] - countsA[i];
  }
  // A team that has not played yet is below every team that has, then fewer nights wins.
  if ((a.nights === 0) !== (b.nights === 0)) return a.nights === 0 ? 1 : -1;
  return a.nights - b.nights;
}

function ranked(rows: LeagueStandingDto[], compare: (a: LeagueStandingDto, b: LeagueStandingDto) => number): LeagueStandingDto[] {
  rows.sort((a, b) => compare(a, b) || a.teamName.localeCompare(b.teamName));
  const ranks = competitionRanks(rows, compare);
  return rows.map((row, index) => ({ ...row, rank: ranks[index] }));
}

/** A LEAGUE's table: placing points summed over its nights. Members who have not played yet have 0. */
export function leagueStandings(nights: NightResult[], members: LeagueMember[]): LeagueStandingDto[] {
  const rows = new Map<string, LeagueStandingDto>(
    members.map((m) => [m.registeredTeamId, { rank: 0, ...m, points: 0, nights: 0, placements: [] }]),
  );
  for (const night of inNightOrder(nights)) {
    for (const [teamId, place] of rankNight(night.teams)) {
      const row = rows.get(teamId);
      if (!row) continue;
      row.points += placePoints(place);
      row.nights += 1;
      row.placements.push(place);
    }
  }
  return ranked([...rows.values()], compareRecords);
}

/** A SUPER league's table: raw quiz points of the qualified teams; everyone else is ignored. */
export function superLeagueStandings(nights: NightResult[], members: LeagueMember[]): LeagueStandingDto[] {
  const rows = new Map<string, LeagueStandingDto>(
    members.map((m) => [m.registeredTeamId, { rank: 0, ...m, points: 0, nights: 0, placements: [] }]),
  );
  for (const night of inNightOrder(nights)) {
    const memberTeams = night.teams.filter((team) => team.registeredTeamId !== null && rows.has(team.registeredTeamId));
    const places = rankNight(memberTeams);
    for (const team of memberTeams) {
      const row = rows.get(team.registeredTeamId!)!;
      row.points += team.score;
      row.nights += 1;
      row.placements.push(places.get(team.registeredTeamId!)!);
    }
  }
  return ranked([...rows.values()], (a, b) => b.points - a.points);
}

/** The top `perPub` of each pub, in table order; everyone tied at the cut-off qualifies. Teams that never played do not. */
export function qualifiers(standings: LeagueStandingDto[], perPub = 3): LeagueStandingDto[] {
  const byPub = new Map<string, LeagueStandingDto[]>();
  for (const row of standings) {
    if (!row.pubId || row.nights === 0) continue;
    byPub.set(row.pubId, [...(byPub.get(row.pubId) ?? []), row]);
  }
  const qualified = new Set<LeagueStandingDto>();
  for (const rows of byPub.values()) {
    const cutoff = rows[Math.min(perPub, rows.length) - 1]?.rank;
    for (const row of rows) if (row.rank <= cutoff) qualified.add(row);
  }
  return standings.filter((row) => qualified.has(row));
}
