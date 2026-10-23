import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';
import { RealtimeBroadcastService } from '../realtime/realtime-broadcast.service';
import { hashToken } from './hash-token';
import { TeamTokenService } from './team-token.service';
import { TeamsService } from './teams.service';

const SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  pub_id: null,
  status: 'LOBBY',
  current_question_id: null,
  question_ends_at: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: null,
  finished_at: null,
};

const TEAM: TeamRecord = {
  id: 't1',
  session_id: 's1',
  name: 'The Quizzards',
  device_token_hash: null,
  joined_at: '2026-09-16T00:00:00.000Z',
  is_active: true,
  registered_team_id: null,
};

function buildHarness() {
  const sessions = { findById: jest.fn().mockResolvedValue(SESSION) } as unknown as SessionsRepository;
  const teams: TeamsRepository = {
    findById: jest.fn(),
    findBySessionAndName: jest.fn(),
    findBySessionAndRegisteredTeam: jest.fn().mockResolvedValue(null),
    upsertJoin: jest.fn().mockResolvedValue(TEAM),
    setDeviceTokenHash: jest.fn().mockResolvedValue(TEAM),
    listBySession: jest.fn(),
  };
  const teamTokens = new TeamTokenService(new JwtService({ secret: 'test-secret' }));
  const broadcast = { publish: jest.fn().mockResolvedValue(undefined) } as unknown as RealtimeBroadcastService;
  const service = new TeamsService(sessions, teams, teamTokens, broadcast);
  return { service, sessions, teams, teamTokens, broadcast };
}

describe('TeamsService.join', () => {
  it('creates the team and returns a token matching the stored hash', async () => {
    const { service, teams, teamTokens } = buildHarness();

    const result = await service.join('s1', 'The Quizzards');

    expect(teams.upsertJoin).toHaveBeenCalledWith('s1', 'The Quizzards', null);
    expect(result.teamId).toBe('t1');
    expect(result.name).toBe('The Quizzards');
    expect(teamTokens.verify(result.token)).toMatchObject({ sessionId: 's1', teamId: 't1' });
    expect(teams.setDeviceTokenHash).toHaveBeenCalledWith('t1', hashToken(result.token));
  });

  it('broadcasts a state change so the host live view picks up the new team', async () => {
    const { service, broadcast } = buildHarness();

    await service.join('s1', 'The Quizzards');

    expect(broadcast.publish).toHaveBeenCalledWith('s1', 'STATE_CHANGE', expect.any(Object));
  });

  it('rejects a blank team name', async () => {
    const { service } = buildHarness();
    await expect(service.join('s1', '   ')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects joining a session that does not exist', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.join('missing', 'Team')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects joining a finished session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue({ ...SESSION, status: 'FINISHED' });

    await expect(service.join('s1', 'Team')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TeamsService.join as a registered team', () => {
  it('links the session team to the registered team', async () => {
    const { service, teams } = buildHarness();

    await service.join('s1', 'The Quizzards', 'rt1');

    expect(teams.upsertJoin).toHaveBeenCalledWith('s1', 'The Quizzards', 'rt1');
  });

  it('keeps the existing session team when the registered team was renamed', async () => {
    const { service, teams } = buildHarness();
    jest.mocked(teams.findBySessionAndRegisteredTeam).mockResolvedValue({ ...TEAM, registered_team_id: 'rt1' });

    await service.join('s1', 'Renamed Quizzards', 'rt1');

    expect(teams.upsertJoin).toHaveBeenCalledWith('s1', 'The Quizzards', 'rt1');
  });

  it("refuses a one-off team that takes a registered team's name in the session", async () => {
    const { service, teams } = buildHarness();
    jest.mocked(teams.findBySessionAndName).mockResolvedValue({ ...TEAM, registered_team_id: 'rt1' });

    await expect(service.join('s1', 'The Quizzards')).rejects.toMatchObject({ response: { code: 'TEAM_NAME_RESERVED' } });
    expect(teams.upsertJoin).not.toHaveBeenCalled();
  });
});
