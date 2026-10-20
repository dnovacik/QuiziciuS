import { RealtimeBroadcastService } from './realtime-broadcast.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('RealtimeBroadcastService', () => {
  it('sends a broadcast event on the session channel', async () => {
    const send = jest.fn().mockResolvedValue({ status: 'ok' });
    const channel = jest.fn().mockReturnValue({ send });
    const supabase = { getClient: () => ({ channel }) } as unknown as SupabaseService;

    const service = new RealtimeBroadcastService(supabase);
    await service.publish('session-1', 'STATE_CHANGE', { status: 'LOCK_IN_ROUND' });

    expect(channel).toHaveBeenCalledWith('quiz:session-1');
    expect(send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'STATE_CHANGE',
      payload: { status: 'LOCK_IN_ROUND' },
    });
  });
});
