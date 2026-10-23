import { QuizEngineService } from '../quiz-engine/quiz-engine.service';
import {
  InMemoryLeaguesRepository,
  InMemoryProfilesRepository,
  InMemoryPubsRepository,
  InMemoryRegisteredTeamsRepository,
  InMemorySessionsRepository,
  InMemoryTeamsRepository,
} from '../test-utils/in-memory-repositories';
import { CreateLeagueDto } from './dto/league.dto';
import { LeaguesService } from './leagues.service';

const OWNER = 'host-owner';
const COHOST = 'host-co';
const STRANGER = 'host-stranger';

async function build() {
  const leagues = new InMemoryLeaguesRepository();
  const sessions = new InMemorySessionsRepository();
  const pubs = new InMemoryPubsRepository();
  const profiles = new InMemoryProfilesRepository();
  const teams = new InMemoryRegisteredTeamsRepository();
  const scores = new Map<string, { registeredTeamId: string | null; score: number }[]>();
  const engine = {
    getState: async (sessionId: string) => ({ teams: (scores.get(sessionId) ?? []).map((t) => ({ ...t, id: 'x', name: 'x' })) }),
  } as unknown as QuizEngineService;
  const sessionTeams = new InMemoryTeamsRepository();
  const service = new LeaguesService(leagues, sessions, pubs, profiles, teams, engine, sessionTeams);

  profiles.add(OWNER, 'HOST', 'owner@pub.sk');
  profiles.add(COHOST, 'HOST', 'co@pub.sk');
  profiles.add(STRANGER, 'HOST', 'stranger@pub.sk');
  const hoffman = await pubs.create({ name: 'KC Hoffman', city: 'Žilina', address: null });
  const mamut = await pubs.create({ name: 'Pub U Mamuta', city: 'Žilina', address: null });
  await pubs.linkHost(OWNER, hoffman.id);
  await pubs.linkHost(COHOST, mamut.id);

  async function team(name: string, primaryPub: string | null) {
    const created = await teams.create({
      captainId: `cap-${name}`,
      name,
      description: '',
      badge: 'shield',
      color: 'purple',
      expectedMembers: 4,
    });
    if (primaryPub) leagues.teamPubs.set(created.id, { pubIds: [primaryPub], primary: primaryPub });
    if (primaryPub) await pubs.setTeamPubs(created.id, [primaryPub], primaryPub);
    return created.id;
  }

  let day = 0;
  /** A finished league night at `pubId` with the given final scores (registered team id → score). */
  async function night(leagueId: string, pubId: string, result: Record<string, number>, oneOff: number[] = []) {
    const session = await sessions.create('quiz', OWNER, `C${day}`, pubId, leagueId);
    day += 1;
    await sessions.updateStatus(session.id, { status: 'FINISHED', finished_at: `2027-01-${String(10 + day).padStart(2, '0')}T22:00:00Z` });
    for (const registeredTeamId of Object.keys(result))
      await sessionTeams.upsertJoin(session.id, `seat-${registeredTeamId}`, registeredTeamId);
    scores.set(session.id, [
      ...Object.entries(result).map(([registeredTeamId, score]) => ({ registeredTeamId, score })),
      ...oneOff.map((score) => ({ registeredTeamId: null, score })),
    ]);
    return session.id;
  }

  function dto(overrides: Partial<CreateLeagueDto> = {}): CreateLeagueDto {
    return {
      name: 'Zimná liga Žilina',
      pubIds: [hoffman.id],
      startsOn: '2026-10-01',
      endsOn: '2027-03-30',
      message: 'Finále v Hoffmane',
      inviteHostIds: [],
      ...overrides,
    };
  }

  const elsewhere = await pubs.create({ name: 'Elsewhere', city: 'Martin', address: null });
  return { service, leagues, sessions, scores, hoffman: hoffman.id, mamut: mamut.id, elsewhere: elsewhere.id, team, night, dto };
}

// "Today" is 23 Oct 2026 in Slovakia.
beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-23T10:00:00Z') }));
afterEach(() => jest.useRealTimers());

describe('LeaguesService', () => {
  describe('proposing a league', () => {
    it("makes the owner a host, adds the owner's pub and invites its teams and the chosen hosts", async () => {
      const { service, hoffman, mamut, team, dto, leagues } = await build();
      const regular = await team('Wise Ducks', hoffman);
      const elsewhere = await team('Quiz Owls', mamut);
      const visitor = await team('Visitors', null);
      leagues.playedAt.set(visitor, [hoffman]);

      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));

      expect(league).toMatchObject({ isOwner: true, myStatus: 'ACCEPTED', phase: 'RUNNING', kind: 'LEAGUE' });
      expect(league.pubs.map((p) => p.id)).toEqual([hoffman]);
      expect(league.hosts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: OWNER, status: 'ACCEPTED' }),
          expect.objectContaining({ id: COHOST, status: 'INVITED' }),
        ]),
      );
      expect(league.teams.map((t) => [t.registeredTeamId, t.status]).sort()).toEqual(
        [
          [regular, 'INVITED'],
          [visitor, 'INVITED'],
        ].sort(),
      );
      expect(league.teams.map((t) => t.registeredTeamId)).not.toContain(elsewhere);
    });

    it("refuses a pub that is not in the owner's pub list", async () => {
      const { service, mamut, dto } = await build();

      await expect(service.create(OWNER, dto({ pubIds: [mamut] }))).rejects.toMatchObject({ response: { code: 'PUB_NOT_IN_LEAGUE' } });
    });

    it('is in preparation until its start date', async () => {
      const { service, dto } = await build();

      expect((await service.create(OWNER, dto({ startsOn: '2026-10-24' }))).phase).toBe('PREPARING');
    });
  });

  describe('co-hosts', () => {
    it("adds an accepting host's pubs and invites their teams, once", async () => {
      const { service, hoffman, mamut, team, dto } = await build();
      const both = await team('Both Pubs', hoffman);
      const theirs = await team('Mamut Regulars', mamut);
      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));

      const accepted = await service.respond(COHOST, league.id, true, [mamut]);

      expect(accepted.myStatus).toBe('ACCEPTED');
      expect(accepted.pubs.map((p) => p.id).sort()).toEqual([hoffman, mamut].sort());
      expect(accepted.teams.filter((t) => t.registeredTeamId === both)).toHaveLength(1);
      expect(accepted.teams.map((t) => t.registeredTeamId)).toContain(theirs);
    });

    it('adds nothing when the host declines', async () => {
      const { service, mamut, team, dto } = await build();
      const theirs = await team('Mamut Regulars', mamut);
      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));

      const declined = await service.respond(COHOST, league.id, false, []);

      expect(declined.myStatus).toBe('DECLINED');
      expect(declined.teams.map((t) => t.registeredTeamId)).not.toContain(theirs);
    });

    it('hides a league from hosts who are not part of it', async () => {
      const { service, dto } = await build();
      const league = await service.create(OWNER, dto());

      await expect(service.detail(STRANGER, league.id)).rejects.toMatchObject({ response: { code: 'LEAGUE_NOT_FOUND' } });
      await expect(service.respond(STRANGER, league.id, true, [])).rejects.toMatchObject({ response: { code: 'LEAGUE_NOT_FOUND' } });
    });

    it('lists the leagues a host owns and the invitations they have', async () => {
      const { service, dto } = await build();
      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));

      expect((await service.list(COHOST)).map((l) => [l.id, l.myStatus, l.isOwner])).toEqual([[league.id, 'INVITED', false]]);
      expect(await service.list(STRANGER)).toEqual([]);
    });

    it('offers every other active host to invite, with their pubs', async () => {
      const { service, mamut } = await build();

      const hosts = await service.invitableHosts(OWNER);

      expect(hosts.map((h) => h.id).sort()).toEqual([COHOST, STRANGER].sort());
      expect(hosts.find((h) => h.id === COHOST)?.pubs.map((p) => p.id)).toEqual([mamut]);
    });
  });

  describe('standings', () => {
    it('scores league nights by placing; one-off teams never count', async () => {
      const { service, hoffman, team, night, dto } = await build();
      const a = await team('Alpha', hoffman);
      const b = await team('Bravo', hoffman);
      const league = await service.create(OWNER, dto());
      await night(league.id, hoffman, { [a]: 40, [b]: 30 }, [99]);
      await night(league.id, hoffman, { [a]: 20, [b]: 25 });

      const detail = await service.detail(OWNER, league.id);

      expect(detail.nightsPlayed).toBe(2);
      expect(detail.standings.map((s) => [s.teamName, s.points, s.placements])).toEqual([
        ['Alpha', 18, [1, 2]],
        ['Bravo', 18, [2, 1]],
      ]);
    });

    it('lets a team that declined the invitation join by playing a league night', async () => {
      const { service, hoffman, team, night, dto } = await build();
      const a = await team('Alpha', hoffman);
      const league = await service.create(OWNER, dto());
      await service.respondAsTeam(a, league.id, false);
      await night(league.id, hoffman, { [a]: 40 });

      const detail = await service.detail(OWNER, league.id);

      expect(detail.teams.find((t) => t.registeredTeamId === a)).toMatchObject({ status: 'JOINED', pubId: hoffman });
      expect(detail.standings[0]).toMatchObject({ registeredTeamId: a, points: 10 });
    });

    it("records the night's pub for a team whose own pub is not in the league", async () => {
      const { service, hoffman, mamut, team, night, dto } = await build();
      const traveller = await team('Travellers', mamut);
      const league = await service.create(OWNER, dto());
      await night(league.id, hoffman, { [traveller]: 40 });

      const detail = await service.detail(OWNER, league.id);

      expect(detail.teams.find((t) => t.registeredTeamId === traveller)).toMatchObject({ status: 'JOINED', pubId: hoffman });
    });

    it('asks the owner to close the league once its end date has passed', async () => {
      const { service, dto } = await build();
      const league = await service.create(OWNER, dto({ endsOn: '2026-10-22' }));

      expect((await service.detail(OWNER, league.id)).endedAwaitingClose).toBe(true);
    });
  });

  describe('closing', () => {
    it('freezes the table, so later score corrections do not change it, and lists the top 3 per pub', async () => {
      const { service, hoffman, team, night, dto, scores } = await build();
      const ids = [];
      for (const name of ['A', 'B', 'C', 'D']) ids.push(await team(`Team ${name}`, hoffman));
      const league = await service.create(OWNER, dto());
      const sessionId = await night(league.id, hoffman, { [ids[0]]: 40, [ids[1]]: 30, [ids[2]]: 20, [ids[3]]: 10 });

      const closed = await service.close(OWNER, league.id);
      scores.set(sessionId, [{ registeredTeamId: ids[3], score: 99 }]);
      const later = await service.detail(OWNER, league.id);

      expect(closed.phase).toBe('CLOSED');
      expect(later.standings.map((s) => s.teamName)).toEqual(['Team A', 'Team B', 'Team C', 'Team D']);
      expect(later.qualified.map((s) => s.teamName)).toEqual(['Team A', 'Team B', 'Team C']);
    });

    it('can only be done by the owner', async () => {
      const { service, mamut, dto } = await build();
      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));
      await service.respond(COHOST, league.id, true, [mamut]);

      await expect(service.close(COHOST, league.id)).rejects.toMatchObject({ response: { code: 'NOT_LEAGUE_OWNER' } });
    });
  });

  describe('the Super League', () => {
    it('invites the qualified teams and the co-hosts, and is scored by raw points', async () => {
      const { service, hoffman, mamut, team, night, dto } = await build();
      const ids = [];
      for (const name of ['A', 'B', 'C', 'D']) ids.push(await team(`Team ${name}`, hoffman));
      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));
      await service.respond(COHOST, league.id, true, [mamut]);
      await night(league.id, hoffman, { [ids[0]]: 40, [ids[1]]: 30, [ids[2]]: 20, [ids[3]]: 10 });
      await service.close(OWNER, league.id);

      const superLeague = await service.createSuperLeague(OWNER, league.id);
      await night(superLeague.id, hoffman, { [ids[0]]: 41, [ids[1]]: 47, [ids[2]]: 12, [ids[3]]: 90 });
      const detail = await service.detail(OWNER, superLeague.id);

      expect(superLeague).toMatchObject({ kind: 'SUPER', parentLeagueId: league.id });
      expect(superLeague.pubs.map((p) => p.id)).toEqual([hoffman]);
      expect(superLeague.hosts).toEqual(expect.arrayContaining([expect.objectContaining({ id: COHOST, status: 'INVITED' })]));
      expect(detail.standings.map((s) => [s.teamName, s.points])).toEqual([
        ['Team B', 47],
        ['Team A', 41],
        ['Team C', 12],
      ]);
      expect((await service.detail(OWNER, league.id)).superLeagueId).toBe(superLeague.id);
    });

    it('needs a closed league and is created only once', async () => {
      const { service, dto } = await build();
      const league = await service.create(OWNER, dto());

      await expect(service.createSuperLeague(OWNER, league.id)).rejects.toMatchObject({ response: { code: 'LEAGUE_NOT_CLOSED' } });
      await service.close(OWNER, league.id);
      await service.createSuperLeague(OWNER, league.id);
      await expect(service.createSuperLeague(OWNER, league.id)).rejects.toMatchObject({ response: { code: 'SUPER_LEAGUE_EXISTS' } });
    });
  });

  describe('launching a league night', () => {
    it('is allowed for an accepted host at a league pub they run, and refused otherwise', async () => {
      const { service, hoffman, mamut, dto } = await build();
      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));

      await expect(service.assertCanLaunch(OWNER, league.id, hoffman)).resolves.toBeUndefined();
      await expect(service.assertCanLaunch(OWNER, league.id, mamut)).rejects.toMatchObject({ response: { code: 'PUB_NOT_IN_LEAGUE' } });
      await expect(service.assertCanLaunch(OWNER, league.id, null)).rejects.toMatchObject({ response: { code: 'PUB_NOT_IN_LEAGUE' } });
      await expect(service.assertCanLaunch(COHOST, league.id, mamut)).rejects.toMatchObject({ response: { code: 'NOT_LEAGUE_HOST' } });
      await service.close(OWNER, league.id);
      await expect(service.assertCanLaunch(OWNER, league.id, hoffman)).rejects.toMatchObject({ response: { code: 'LEAGUE_CLOSED' } });
    });
  });

  describe('review fixes', () => {
    it("qualifies a team that joined from its invitation and played at a co-host's pub, through that pub", async () => {
      const { service, hoffman, mamut, elsewhere, team, night, dto, leagues } = await build();
      const traveller = await team('Travellers', elsewhere);
      leagues.playedAt.set(traveller, [hoffman]);
      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));
      await service.respond(COHOST, league.id, true, [mamut]);
      await service.respondAsTeam(traveller, league.id, true);
      await night(league.id, mamut, { [traveller]: 40 });

      const closed = await service.close(OWNER, league.id);

      expect(closed.teams.find((t) => t.registeredTeamId === traveller)?.pubId).toBe(mamut);
      expect(closed.qualified.map((s) => [s.registeredTeamId, s.pubId])).toEqual([[traveller, mamut]]);
    });

    it("does not invite a co-host's teams into a Super League", async () => {
      const { service, hoffman, mamut, team, night, dto } = await build();
      const winner = await team('Winners', hoffman);
      const coRegular = await team('Mamut Regulars', mamut);
      const league = await service.create(OWNER, dto({ inviteHostIds: [COHOST] }));
      await service.respond(COHOST, league.id, true, [mamut]);
      await night(league.id, hoffman, { [winner]: 40 });
      await service.close(OWNER, league.id);
      const superLeague = await service.createSuperLeague(OWNER, league.id);

      const accepted = await service.respond(COHOST, superLeague.id, true, [mamut]);

      expect(accepted.teams.map((t) => t.registeredTeamId)).not.toContain(coRegular);
      await expect(service.respondAsTeam(coRegular, superLeague.id, true)).rejects.toMatchObject({
        response: { code: 'LEAGUE_NOT_FOUND' },
      });
    });

    it('never qualifies teams that joined but did not play a single night', async () => {
      const { service, hoffman, team, night, dto } = await build();
      const player = await team('Players', hoffman);
      const absent = [];
      for (const name of ['Ghost A', 'Ghost B', 'Ghost C']) absent.push(await team(name, hoffman));
      const league = await service.create(OWNER, dto());
      for (const id of absent) await service.respondAsTeam(id, league.id, true);
      await night(league.id, hoffman, { [player]: 40 });

      const closed = await service.close(OWNER, league.id);

      expect(closed.qualified.map((s) => s.registeredTeamId)).toEqual([player]);
    });

    it('shows a league on the team page as soon as the team has played in it, without an invitation', async () => {
      const { service, hoffman, team, night, dto } = await build();
      const newcomer = await team('Newcomers', null);
      const league = await service.create(OWNER, dto());
      await night(league.id, hoffman, { [newcomer]: 40 });

      const leagues = await service.forTeam(newcomer);

      expect(leagues.map((l) => [l.league.id, l.status])).toEqual([[league.id, 'JOINED']]);
      expect(leagues[0].standings[0]).toMatchObject({ registeredTeamId: newcomer, points: 10 });
    });
  });
});
