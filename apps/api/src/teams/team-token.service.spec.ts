import { JwtService } from '@nestjs/jwt';
import { TeamTokenService } from './team-token.service';

describe('TeamTokenService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new TeamTokenService(jwt);

  it('round-trips a signed payload', () => {
    const token = service.sign({ sessionId: 's1', teamId: 't1' });
    expect(service.verify(token)).toMatchObject({ sessionId: 's1', teamId: 't1' });
  });

  it('throws on a garbage token', () => {
    expect(() => service.verify('not-a-token')).toThrow();
  });
});
