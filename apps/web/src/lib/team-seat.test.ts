import { describe, expect, it } from 'vitest';
import { parseJoinTarget } from './team-seat';

describe('parseJoinTarget', () => {
  it('reads a quiz night join link from any host', () => {
    expect(parseJoinTarget('https://quiz.example.sk/play/1b2c3d')).toEqual({ sessionId: '1b2c3d' });
    expect(parseJoinTarget(' https://abc.ngrok-free.app/play/s1/ ')).toEqual({ sessionId: 's1' });
  });

  it('reads a bare join code', () => {
    expect(parseJoinTarget('a7f3')).toEqual({ code: 'A7F3' });
    expect(parseJoinTarget('A7-F3')).toEqual({ code: 'A7F3' });
  });

  it('ignores anything else', () => {
    expect(parseJoinTarget('https://example.com/menu')).toBeNull();
    expect(parseJoinTarget('Happy hour 18-20')).toBeNull();
    expect(parseJoinTarget('AB1')).toBeNull();
  });
});
