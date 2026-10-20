import { Logger } from '@nestjs/common';
import { RealtimeBroadcastService } from './realtime-broadcast.service';
import { SupabaseService } from '../supabase/supabase.service';

function buildHarness(sendImpl: jest.Mock) {
  const channel = jest.fn().mockReturnValue({ send: sendImpl });
  const supabase = { getClient: () => ({ channel }) } as unknown as SupabaseService;
  const service = new RealtimeBroadcastService(supabase);
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  return { service, channel, warn };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RealtimeBroadcastService', () => {
  it('sends a broadcast event on the session channel with a short timeout', async () => {
    const send = jest.fn().mockResolvedValue('ok');
    const { service, channel, warn } = buildHarness(send);

    await service.publish('session-1', 'STATE_CHANGE', { status: 'LOCK_IN_ROUND' });

    expect(channel).toHaveBeenCalledWith('quiz:session-1');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      { type: 'broadcast', event: 'STATE_CHANGE', payload: { status: 'LOCK_IN_ROUND' } },
      { timeout: expect.any(Number) },
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('retries exactly once and logs a warning when the send does not return "ok"', async () => {
    const send = jest.fn().mockResolvedValueOnce('timed out').mockResolvedValueOnce('ok');
    const { service, warn } = buildHarness(send);

    await service.publish('session-1', 'SCORE_UPDATE', { teamId: 't1' });

    expect(send).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('session-1'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('logs and gives up (without throwing) when the retry also fails', async () => {
    const send = jest.fn().mockResolvedValue('error');
    const { service, warn } = buildHarness(send);

    await expect(service.publish('session-1', 'SCORE_UPDATE', { teamId: 't1' })).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not let a thrown transport error escape to the caller', async () => {
    const send = jest.fn().mockRejectedValue(new Error('socket closed'));
    const { service } = buildHarness(send);

    await expect(service.publish('session-1', 'STATE_CHANGE', {})).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
  });
});
