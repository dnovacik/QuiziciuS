import type { MediaAction, MediaPlaybackState, MediaSlot } from '@quizicius/shared-types';
import { broadcastToSession, subscribeToSession } from './supabase-client';

/** Host → projector, sent by the API: play, pause or replay a media slot of the current question. */
export interface MediaControlMessage {
  questionId: string;
  slot: MediaSlot;
  action: MediaAction;
  at: number;
}

/** Projector → control room: what the projector is actually doing with a slot. */
export interface MediaStatusMessage {
  questionId: string;
  slot: MediaSlot;
  state: MediaPlaybackState;
}

export function subscribeToMediaControl(sessionId: string, onControl: (message: MediaControlMessage) => void): () => void {
  return subscribeToSession(sessionId, (_event, payload) => onControl(payload as unknown as MediaControlMessage), ['MEDIA_CONTROL']);
}

export function subscribeToMediaStatus(sessionId: string, onStatus: (message: MediaStatusMessage) => void): () => void {
  return subscribeToSession(sessionId, (_event, payload) => onStatus(payload as unknown as MediaStatusMessage), ['MEDIA_STATUS']);
}

export function sendMediaStatus(sessionId: string, status: MediaStatusMessage): void {
  broadcastToSession(sessionId, 'MEDIA_STATUS', { ...status });
}
