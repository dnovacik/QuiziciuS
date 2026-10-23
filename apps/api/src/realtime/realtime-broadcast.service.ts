import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type BroadcastEvent = 'STATE_CHANGE' | 'SCORE_UPDATE' | 'MEDIA_CONTROL';

type SendResult = 'ok' | 'error' | 'timed out';

interface BroadcastChannel {
  send(args: { type: 'broadcast'; event: string; payload: Record<string, unknown> }, opts?: { timeout?: number }): Promise<string>;
}

// `channel.send()` is never called on a subscribed channel here, so it takes the
// REST fallback path, whose default timeout is the client's (10s). Every state
// transition and answer submission awaits this on the critical path, so cap it
// short: a failed publish plus its single retry can cost at most ~2 x this.
const SEND_TIMEOUT_MS = 1000;

@Injectable()
export class RealtimeBroadcastService {
  private readonly logger = new Logger(RealtimeBroadcastService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async publish(sessionId: string, event: BroadcastEvent, payload: Record<string, unknown>): Promise<void> {
    const channel = this.supabase.getClient().channel(`quiz:${sessionId}`) as unknown as BroadcastChannel;

    const first = await this.trySend(channel, event, payload);
    if (first === 'ok') return;

    this.logger.warn(`Realtime publish of ${event} for session ${sessionId} returned "${first}" — retrying once`);

    const second = await this.trySend(channel, event, payload);
    if (second !== 'ok') {
      this.logger.warn(`Realtime publish retry of ${event} for session ${sessionId} also failed ("${second}") — giving up`);
    }
  }

  private async trySend(channel: BroadcastChannel, event: BroadcastEvent, payload: Record<string, unknown>): Promise<SendResult> {
    try {
      // send() resolves to 'ok' | 'error' | 'timed out' rather than throwing, but a
      // transport-level throw must not take down the caller's state transition either.
      const result = await channel.send({ type: 'broadcast', event, payload }, { timeout: SEND_TIMEOUT_MS });
      return result === 'ok' ? 'ok' : ((result as SendResult) ?? 'error');
    } catch (err) {
      this.logger.warn(`Realtime publish of ${event} threw: ${err instanceof Error ? err.message : String(err)}`);
      return 'error';
    }
  }
}
