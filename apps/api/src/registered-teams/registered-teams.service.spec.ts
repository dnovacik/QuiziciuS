import { JwtService } from '@nestjs/jwt';
import { PubsService } from '../pubs/pubs.service';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { TeamTokenService } from '../teams/team-token.service';
import { TeamsService } from '../teams/teams.service';
import {
  InMemoryPubsRepository,
  InMemoryRegisteredTeamsRepository,
  InMemorySessionsRepository,
  InMemoryTeamsRepository,
} from '../test-utils/in-memory-repositories';
import { RegisterTeamDto } from './dto/registered-team.dto';
import { RegisteredTeamsService } from './registered-teams.service';

const CAPTAIN = 'captain-1';
const OTHER_CAPTAIN = 'captain-2';
const HOST = 'host-1';

function build() {
  const registered = new InMemoryRegisteredTeamsRepository();
  const pubsRepo = new InMemoryPubsRepository();
  const sessions = new InMemorySessionsRepository();
  const sessionTeams = new InMemoryTeamsRepository();
  const broadcast = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as RealtimeBroadcastService;
  const teamsService = new TeamsService(sessions, sessionTeams, new TeamTokenService(new JwtService({ secret: 'test' })), broadcast);
  const service = new RegisteredTeamsService(registered, new PubsService(pubsRepo), teamsService);
  return { service, registered, pubsRepo, sessions, sessionTeams, teamsService };
}

function dto(overrides: Partial<RegisterTeamDto> = {}): RegisterTeamDto {
  return { name: 'Wise Ducks', expectedMembers: 4, ...overrides };
}

describe('RegisteredTeamsService', () => {
  describe('registering a team', () => {
    it('creates the team for the captain with default badge and colour', async () => {
      const { service } = build();

      const team = await service.create(CAPTAIN, dto({ name: '  Wise Ducks ' }));

      expect(team).toMatchObject({ name: 'Wise Ducks', captain_id: CAPTAIN, badge: 'shield', badge_color: 'purple', pubs: [] });
      expect(await service.mine(CAPTAIN)).toEqual([team]);
    });

    it('links the chosen pubs and makes the first one primary when none is picked', async () => {
      const { service, pubsRepo } = build();
      const hoffman = await pubsRepo.create({ name: 'KC Hoffman', city: 'Žilina', address: null });
      const bazant = await pubsRepo.create({ name: 'Zlatý Bažant', city: 'Žilina', address: null });

      const team = await service.create(CAPTAIN, dto({ pubIds: [hoffman.id, bazant.id] }));

      expect(team.pubs).toEqual([
        { id: hoffman.id, name: 'KC Hoffman', city: 'Žilina', isPrimary: true },
        { id: bazant.id, name: 'Zlatý Bažant', city: 'Žilina', isPrimary: false },
      ]);
    });

    it('refuses a pub that does not exist', async () => {
      const { service } = build();

      await expect(service.create(CAPTAIN, dto({ pubIds: ['nope'] }))).rejects.toMatchObject({ response: { code: 'PUB_NOT_FOUND' } });
    });

    it('refuses a name another team already has, ignoring case', async () => {
      const { service } = build();
      await service.create(OTHER_CAPTAIN, dto());

      await expect(service.create(CAPTAIN, dto({ name: 'wise ducks' }))).rejects.toMatchObject({ response: { code: 'NAME_TAKEN' } });
    });

    it('refuses names shorter than 3 characters after trimming', async () => {
      const { service } = build();

      await expect(service.create(CAPTAIN, dto({ name: '  ab  ' }))).rejects.toMatchObject({ response: { code: 'INVALID_NAME' } });
    });
  });

  describe('checking whether a name is free', () => {
    it('reports invalid, taken and available names', async () => {
      const { service } = build();
      await service.create(OTHER_CAPTAIN, dto());

      await expect(service.availability('ab')).resolves.toEqual({ available: false, code: 'INVALID_NAME' });
      await expect(service.availability('WISE DUCKS')).resolves.toEqual({ available: false, code: 'NAME_TAKEN' });
      await expect(service.availability('Quiz Owls')).resolves.toEqual({ available: true, code: 'NAME_AVAILABLE' });
    });
  });

  describe('listing teams', () => {
    it('shows a captain only their own teams', async () => {
      const { service } = build();
      await service.create(CAPTAIN, dto());
      await service.create(OTHER_CAPTAIN, dto({ name: 'Quiz Owls' }));

      expect((await service.mine(CAPTAIN)).map((team) => team.name)).toEqual(['Wise Ducks']);
    });
  });

  describe("another captain's team", () => {
    it('cannot be edited, joined or have its roster read', async () => {
      const { service } = build();
      const team = await service.create(OTHER_CAPTAIN, dto());
      const notFound = { response: { code: 'TEAM_NOT_FOUND' } };

      await expect(service.update(CAPTAIN, team.id, { name: 'Hijacked' })).rejects.toMatchObject(notFound);
      await expect(service.players(CAPTAIN, team.id)).rejects.toMatchObject(notFound);
      await expect(service.addPlayer(CAPTAIN, team.id, 'Eve')).rejects.toMatchObject(notFound);
      await expect(service.joinSession(CAPTAIN, team.id, 'any-session')).rejects.toMatchObject(notFound);
    });
  });

  describe('editing a team', () => {
    it('updates the profile and clears a blank description', async () => {
      const { service } = build();
      const team = await service.create(CAPTAIN, dto({ description: 'Ducks that know things' }));

      const edited = await service.update(CAPTAIN, team.id, { name: ' Wiser Ducks ', description: '   ', color: 'amber' });

      expect(edited).toMatchObject({ name: 'Wiser Ducks', description: null, badge_color: 'amber' });
    });

    it('can change only the pubs, keeping the rest of the profile', async () => {
      const { service, pubsRepo } = build();
      const hoffman = await pubsRepo.create({ name: 'KC Hoffman', city: 'Žilina', address: null });
      const bazant = await pubsRepo.create({ name: 'Zlatý Bažant', city: 'Žilina', address: null });
      const team = await service.create(CAPTAIN, dto({ pubIds: [hoffman.id] }));

      const edited = await service.update(CAPTAIN, team.id, { pubIds: [hoffman.id, bazant.id], primaryPubId: bazant.id });

      expect(edited.name).toBe('Wise Ducks');
      expect(edited.pubs.find((pub) => pub.isPrimary)?.id).toBe(bazant.id);
    });

    it('refuses a rename to a taken name and an empty change', async () => {
      const { service } = build();
      await service.create(OTHER_CAPTAIN, dto({ name: 'Quiz Owls' }));
      const team = await service.create(CAPTAIN, dto());

      await expect(service.update(CAPTAIN, team.id, { name: 'QUIZ OWLS' })).rejects.toMatchObject({ response: { code: 'NAME_TAKEN' } });
      await expect(service.update(CAPTAIN, team.id, {})).rejects.toMatchObject({ response: { code: 'NO_CHANGES' } });
    });
  });

  describe('the roster', () => {
    it('adds, renames and removes players', async () => {
      const { service } = build();
      const team = await service.create(CAPTAIN, dto());

      const anna = await service.addPlayer(CAPTAIN, team.id, 'Anna');
      await service.addPlayer(CAPTAIN, team.id, 'Boris');
      await service.renamePlayer(CAPTAIN, team.id, anna.id, ' Anička ');
      await service.removePlayer(CAPTAIN, team.id, anna.id);

      expect((await service.players(CAPTAIN, team.id)).map((p) => p.name)).toEqual(['Boris']);
    });

    it('refuses duplicate players, ignoring case', async () => {
      const { service } = build();
      const team = await service.create(CAPTAIN, dto());
      await service.addPlayer(CAPTAIN, team.id, 'Anna');

      await expect(service.addPlayer(CAPTAIN, team.id, 'ANNA')).rejects.toMatchObject({ response: { code: 'PLAYER_EXISTS' } });
    });

    it('holds at most six players', async () => {
      const { service } = build();
      const team = await service.create(CAPTAIN, dto());
      for (const name of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) await service.addPlayer(CAPTAIN, team.id, name);

      await expect(service.addPlayer(CAPTAIN, team.id, 'A7')).rejects.toMatchObject({ response: { code: 'ROSTER_FULL' } });
    });

    it('reports players that are not on the roster', async () => {
      const { service } = build();
      const team = await service.create(CAPTAIN, dto());
      const other = await service.create(OTHER_CAPTAIN, dto({ name: 'Quiz Owls' }));
      const outsider = await service.addPlayer(OTHER_CAPTAIN, other.id, 'Eve');

      await expect(service.renamePlayer(CAPTAIN, team.id, outsider.id, 'Mallory')).rejects.toMatchObject({
        response: { code: 'PLAYER_NOT_FOUND' },
      });
      await expect(service.removePlayer(CAPTAIN, team.id, outsider.id)).rejects.toMatchObject({ response: { code: 'PLAYER_NOT_FOUND' } });
      expect(await service.players(OTHER_CAPTAIN, other.id)).toHaveLength(1);
    });
  });

  describe('joining a quiz night', () => {
    it('joins under the team name and links the session team to the registered team', async () => {
      const { service, sessions, sessionTeams } = build();
      const session = await sessions.create('quiz-1', HOST, 'AB12');
      const team = await service.create(CAPTAIN, dto());

      const joined = await service.joinSession(CAPTAIN, team.id, session.id);

      expect(joined.name).toBe('Wise Ducks');
      expect(joined.token).toEqual(expect.any(String));
      expect(await sessionTeams.findById(joined.teamId)).toMatchObject({ registered_team_id: team.id });
    });

    it('reserves the name in that night, so a one-off team cannot take it', async () => {
      const { service, sessions, teamsService } = build();
      const session = await sessions.create('quiz-1', HOST, 'AB12');
      const team = await service.create(CAPTAIN, dto());
      await service.joinSession(CAPTAIN, team.id, session.id);

      await expect(teamsService.join(session.id, 'Wise Ducks')).rejects.toMatchObject({ response: { code: 'TEAM_NAME_RESERVED' } });
    });

    it('keeps the same session team when the captain renames the team mid-night', async () => {
      const { service, sessions } = build();
      const session = await sessions.create('quiz-1', HOST, 'AB12');
      const team = await service.create(CAPTAIN, dto());
      const first = await service.joinSession(CAPTAIN, team.id, session.id);

      await service.update(CAPTAIN, team.id, { name: 'Renamed Ducks' });
      const again = await service.joinSession(CAPTAIN, team.id, session.id);

      expect(again).toMatchObject({ teamId: first.teamId, name: 'Wise Ducks' });
    });

    it("does not let a host's team play the host's own quiz night", async () => {
      const { service, sessions } = build();
      const session = await sessions.create('quiz-1', CAPTAIN, 'AB12');
      const team = await service.create(CAPTAIN, dto());

      await expect(service.joinSession(CAPTAIN, team.id, session.id)).rejects.toMatchObject({ response: { code: 'OWN_QUIZ' } });
    });
  });
});
