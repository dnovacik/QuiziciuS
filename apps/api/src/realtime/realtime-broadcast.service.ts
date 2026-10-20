import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type BroadcastEvent = 'STATE_CHANGE' | 'SCORE_UPDATE';

@Injectable()
export class RealtimeBroadcastService {
  constructor(private readonly supabase: SupabaseService) {}

  async publish(sessionId: string, event: BroadcastEvent, payload: Record<string, unknown>): Promise<void> {
    const channel = this.supabase.getClient().channel(`quiz:${sessionId}`);
    await channel.send({ type: 'broadcast', event, payload });
  }
}
