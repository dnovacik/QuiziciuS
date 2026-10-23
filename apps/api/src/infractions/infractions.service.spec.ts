import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InfractionsRepository } from '../data/infractions.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { InfractionsService } from './infractions.service';

const SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  pub_id: null,
  league_id: null,
  status: 'QUESTION_ACTIVE',
  current_question_id: 'q1',
  question_ends_at: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: '2026-09-16T00:00:00.000Z',
  finished_at: null,
};

const INFRACTION = {
  id: 'inf1',
  session_id: 's1',
  team_id: 't1',
  type: 'VISIBILITY_HIDDEN' as const,
  detected_at: '2026-09-16T00:00:00.000Z',
  reviewed: false,
};

function buildHarness() {
  const sessions = { findById: jest.fn().mockResolvedValue(SESSION) } as unknown as SessionsRepository;
  const infractions: InfractionsRepository = {
    create: jest.fn().mockResolvedValue(INFRACTION),
    findById: jest.fn().mockResolvedValue(INFRACTION),
    listBySession: jest.fn().mockResolvedValue([]),
    markReviewed: jest.fn().mockResolvedValue({ ...INFRACTION, reviewed: true }),
  };
  const service = new InfractionsService(sessions, infractions);
  return { service, sessions, infractions };
}

describe('InfractionsService.report', () => {
  it('records an infraction for the reporting team', async () => {
    const { service, infractions } = buildHarness();

    await service.report('s1', 't1', 'VISIBILITY_HIDDEN');

    expect(infractions.create).toHaveBeenCalledWith('s1', 't1', 'VISIBILITY_HIDDEN');
  });

  it('rejects reporting against an unknown session', async () => {
    const { service, sessions } = buildHarness();
    (sessions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.report('missing', 't1', 'VISIBILITY_HIDDEN')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InfractionsService.listForHost', () => {
  it('returns the infraction list for the owning host', async () => {
    const { service, infractions } = buildHarness();

    await service.listForHost('s1', 'host1');

    expect(infractions.listBySession).toHaveBeenCalledWith('s1');
  });

  it('rejects a host who does not own the session', async () => {
    const { service } = buildHarness();

    await expect(service.listForHost('s1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('omits already-reviewed infractions from the host review queue', async () => {
    const { service, infractions } = buildHarness();
    (infractions.listBySession as jest.Mock).mockResolvedValue([INFRACTION, { ...INFRACTION, id: 'inf2', reviewed: true }]);

    await expect(service.listForHost('s1', 'host1')).resolves.toEqual([INFRACTION]);
  });
});

describe('InfractionsService.markReviewed', () => {
  it('marks an infraction reviewed for the owning host', async () => {
    const { service, infractions } = buildHarness();

    const result = await service.markReviewed('s1', 'inf1', 'host1');

    expect(infractions.markReviewed).toHaveBeenCalledWith('inf1');
    expect(result.reviewed).toBe(true);
  });

  it('rejects a host who does not own the session', async () => {
    const { service, infractions } = buildHarness();

    await expect(service.markReviewed('s1', 'inf1', 'someone-else')).rejects.toBeInstanceOf(ForbiddenException);
    expect(infractions.markReviewed).not.toHaveBeenCalled();
  });

  it('rejects an infraction that belongs to a different session', async () => {
    const { service, infractions } = buildHarness();
    (infractions.findById as jest.Mock).mockResolvedValue({ ...INFRACTION, session_id: 'other-session' });

    await expect(service.markReviewed('s1', 'inf1', 'host1')).rejects.toBeInstanceOf(NotFoundException);
    expect(infractions.markReviewed).not.toHaveBeenCalled();
  });

  it('rejects an unknown infraction', async () => {
    const { service, infractions } = buildHarness();
    (infractions.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.markReviewed('s1', 'missing', 'host1')).rejects.toBeInstanceOf(NotFoundException);
    expect(infractions.markReviewed).not.toHaveBeenCalled();
  });
});
