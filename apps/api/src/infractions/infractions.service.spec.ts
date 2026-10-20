import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InfractionsRepository } from '../data/infractions.repository';
import { SessionRecord, SessionsRepository } from '../data/sessions.repository';
import { InfractionsService } from './infractions.service';

const SESSION: SessionRecord = {
  id: 's1',
  quiz_id: 'quiz1',
  host_id: 'host1',
  join_code: 'AB12',
  status: 'QUESTION_ACTIVE',
  current_question_id: 'q1',
  question_ends_at: null,
  created_at: '2026-09-16T00:00:00.000Z',
  started_at: '2026-09-16T00:00:00.000Z',
  finished_at: null,
};

function buildHarness() {
  const sessions = { findById: jest.fn().mockResolvedValue(SESSION) } as unknown as SessionsRepository;
  const infractions: InfractionsRepository = {
    create: jest.fn().mockResolvedValue({
      id: 'inf1',
      session_id: 's1',
      team_id: 't1',
      type: 'VISIBILITY_HIDDEN',
      detected_at: '2026-09-16T00:00:00.000Z',
      reviewed: false,
    }),
    listBySession: jest.fn().mockResolvedValue([]),
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
});
