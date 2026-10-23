import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TeamRecord, TeamsRepository } from '../data/teams.repository';
import { hashToken } from './hash-token';
import { TeamTokenGuard } from './team-token.guard';
import { TeamTokenService } from './team-token.service';

function contextWithHeader(header?: string): ExecutionContext {
  const req: Record<string, unknown> = { headers: header ? { authorization: header } : {} };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function buildTeam(overrides?: Partial<TeamRecord>): TeamRecord {
  return {
    id: 't1',
    session_id: 's1',
    name: 'The Quizzards',
    device_token_hash: null,
    joined_at: '2026-09-16T00:00:00.000Z',
    is_active: true,
    registered_team_id: null,
    ...overrides,
  };
}

describe('TeamTokenGuard', () => {
  const teamTokens = new TeamTokenService(new JwtService({ secret: 'test-secret' }));

  it('rejects a missing token', async () => {
    const teams = { findById: jest.fn() } as unknown as TeamsRepository;
    const guard = new TeamTokenGuard(teamTokens, teams);

    await expect(guard.canActivate(contextWithHeader())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const teams = { findById: jest.fn() } as unknown as TeamsRepository;
    const guard = new TeamTokenGuard(teamTokens, teams);

    await expect(guard.canActivate(contextWithHeader('Bearer garbage'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a validly-signed token that was superseded by a later join ("last device wins")', async () => {
    const token = teamTokens.sign({ sessionId: 's1', teamId: 't1' });
    const teams = {
      findById: jest.fn().mockResolvedValue(buildTeam({ device_token_hash: hashToken('a-newer-token') })),
    } as unknown as TeamsRepository;
    const guard = new TeamTokenGuard(teamTokens, teams);

    await expect(guard.canActivate(contextWithHeader(`Bearer ${token}`))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the team payload when the token hash matches the current device', async () => {
    const token = teamTokens.sign({ sessionId: 's1', teamId: 't1' });
    const teams = {
      findById: jest.fn().mockResolvedValue(buildTeam({ device_token_hash: hashToken(token) })),
    } as unknown as TeamsRepository;
    const guard = new TeamTokenGuard(teamTokens, teams);
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.team).toMatchObject({ sessionId: 's1', teamId: 't1' });
  });
});
