import { LeagueStandingDto } from '@quizicius/shared-types';
import { leagueStandings, LeagueMember, NightResult, placePoints, qualifiers, rankNight, superLeagueStandings } from './standings';

function night(day: number, scores: Record<string, number>, pubId: string | null = 'pub-1'): NightResult {
  return {
    sessionId: `s${day}`,
    finishedAt: `2027-01-${String(day).padStart(2, '0')}T22:00:00Z`,
    pubId,
    teams: Object.entries(scores).map(([id, score]) => ({ registeredTeamId: id.startsWith('one-off') ? null : id, score })),
  };
}

function member(id: string, pubId: string | null = 'pub-1'): LeagueMember {
  return { registeredTeamId: id, teamName: id, pubId };
}

function row(id: string, rank: number, pubId: string | null): LeagueStandingDto {
  return { rank, registeredTeamId: id, teamName: id, pubId, points: 0, nights: 1, placements: [] };
}

describe('placePoints', () => {
  it('gives 10, 8, 6, 5, 4, 3, 2, 1 and then nothing', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(placePoints)).toEqual([10, 8, 6, 5, 4, 3, 2, 1, 0]);
  });
});

describe('rankNight', () => {
  it('places only registered teams, so a one-off winner does not push them down', () => {
    const places = rankNight(night(1, { 'one-off-1': 50, A: 40, B: 30 }).teams);

    expect(Object.fromEntries(places)).toEqual({ A: 1, B: 2 });
  });

  it('lets tied teams share the better place and skips the next one', () => {
    const places = rankNight(night(1, { A: 40, B: 40, C: 30 }).teams);

    expect(Object.fromEntries(places)).toEqual({ A: 1, B: 1, C: 3 });
  });
});

describe('leagueStandings', () => {
  it('sums placing points over the nights and lists members who have not played yet', () => {
    const standings = leagueStandings([night(1, { A: 40, B: 30 }), night(2, { A: 20, B: 25 })], [member('A'), member('B'), member('C')]);

    expect(
      standings.map(({ registeredTeamId, points, nights, placements, rank }) => ({ registeredTeamId, points, nights, placements, rank })),
    ).toEqual([
      { registeredTeamId: 'A', points: 18, nights: 2, placements: [1, 2], rank: 1 },
      { registeredTeamId: 'B', points: 18, nights: 2, placements: [2, 1], rank: 1 },
      { registeredTeamId: 'C', points: 0, nights: 0, placements: [], rank: 3 },
    ]);
  });

  it('breaks equal points by more first places, then more second places', () => {
    // A: 1st + 3rd = 16; B: 2nd + 2nd = 16 → A ahead thanks to a win.
    const standings = leagueStandings(
      [night(1, { A: 40, B: 30, C: 20 }), night(2, { C: 40, B: 30, A: 20 })],
      [member('A'), member('B'), member('C')],
    );

    expect(standings.map((s) => [s.registeredTeamId, s.points, s.rank])).toEqual([
      ['A', 16, 1],
      ['C', 16, 1],
      ['B', 16, 3],
    ]);
  });

  it('puts fewer nights first on an equal record, then sorts by name', () => {
    // Y wins once and finishes 9th (0 points) once: same points and wins as B, A and Z, but more nights.
    const ninth = Object.fromEntries([...'12345678'].map((n, i) => [`T${n}`, 100 - i]));
    const standings = leagueStandings(
      [night(1, { B: 40 }), night(2, { Y: 40 }), night(3, { ...ninth, Y: 1 }), night(4, { Z: 40 }), night(5, { A: 40 })],
      [member('Y'), member('B'), member('Z'), member('A')],
    );

    expect(standings.map((s) => [s.registeredTeamId, s.points, s.nights, s.rank])).toEqual([
      ['A', 10, 1, 1],
      ['B', 10, 1, 1],
      ['Z', 10, 1, 1],
      ['Y', 10, 2, 4],
    ]);
  });

  it('plays nights in the order they finished, whatever order they arrive in', () => {
    const standings = leagueStandings([night(2, { A: 10, B: 20 }), night(1, { A: 20, B: 10 })], [member('A'), member('B')]);

    expect(standings.find((s) => s.registeredTeamId === 'A')?.placements).toEqual([1, 2]);
  });
});

describe('superLeagueStandings', () => {
  it('ranks qualified teams by raw quiz points and ignores everyone else', () => {
    const standings = superLeagueStandings(
      [night(1, { A: 41, B: 47, C: 47, X: 60, 'one-off-1': 70 })],
      [member('A'), member('B'), member('C')],
    );

    expect(standings.map((s) => [s.registeredTeamId, s.points, s.rank])).toEqual([
      ['B', 47, 1],
      ['C', 47, 1],
      ['A', 41, 3],
    ]);
  });
});

describe('qualifiers', () => {
  it('takes the top 3 of each pub', () => {
    const standings = [
      row('A1', 1, 'p1'),
      row('B1', 2, 'p2'),
      row('A2', 3, 'p1'),
      row('A3', 4, 'p1'),
      row('B2', 5, 'p2'),
      row('A4', 6, 'p1'),
      row('B3', 7, 'p2'),
      row('B4', 8, 'p2'),
    ];

    expect(qualifiers(standings).map((s) => s.registeredTeamId)).toEqual(['A1', 'B1', 'A2', 'A3', 'B2', 'B3']);
  });

  it('lets everyone tied for third place in a pub qualify', () => {
    const standings = [row('A1', 1, 'p1'), row('A2', 2, 'p1'), row('A3', 3, 'p1'), row('A4', 3, 'p1'), row('A5', 5, 'p1')];

    expect(qualifiers(standings).map((s) => s.registeredTeamId)).toEqual(['A1', 'A2', 'A3', 'A4']);
  });

  it('never qualifies a team without a pub', () => {
    expect(qualifiers([row('A1', 1, null), row('A2', 2, 'p1')]).map((s) => s.registeredTeamId)).toEqual(['A2']);
  });
});

describe('teams that have not played', () => {
  it('rank below teams that played, even when those scored no points', () => {
    const tenth = Object.fromEntries([...'123456789'].map((n, i) => [`T${n}`, 100 - i]));
    const standings = leagueStandings([night(1, { ...tenth, Late: 1 })], [member('Absent'), member('Late')]);

    expect(standings.map((s) => [s.registeredTeamId, s.points, s.rank])).toEqual([
      ['Late', 0, 1],
      ['Absent', 0, 2],
    ]);
  });

  it('never qualify', () => {
    const played = row('A1', 1, 'p1');
    const absent = ['Z1', 'Z2', 'Z3'].map((id) => ({ ...row(id, 2, 'p1'), nights: 0 }));

    expect(qualifiers([played, ...absent]).map((s) => s.registeredTeamId)).toEqual(['A1']);
  });
});
