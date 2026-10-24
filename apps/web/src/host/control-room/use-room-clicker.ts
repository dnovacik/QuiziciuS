import type { MediaRefDto, MediaSlot } from '@quizicius/shared-types';
import { useClicker, type ClickerCommand, type ClickerOutcome } from '../../lib/clicker';
import { secondsLeft } from '../../lib/quiz';
import type { ControlRoom } from './use-control-room';

const isClip = (media: MediaRefDto | null | undefined) => !!media && media.kind !== 'image';

/**
 * Drives the room from a presentation clicker, one step per press like slides:
 * prepare the question, show it, stop answers, reveal, then on to the next one.
 * The blank button calls a break and back plays or pauses the clip on screen.
 * Starting from the lobby is left to the lobby panel, which asks for confirmation first.
 */
export function useRoomClicker(room: ControlRoom, sessionId: string, enabled: boolean) {
  useClicker(
    sessionId,
    async (command: ClickerCommand): Promise<ClickerOutcome | null> => {
      const { state, currentQuestion } = room;
      // Busy: the previous press is still on its way, this one is simply dropped.
      if (!state || room.busy) return null;
      const status = state.status;
      const outcome = (ok: boolean): ClickerOutcome => (ok ? 'done' : 'error');

      if (command === 'next') {
        if (status === 'LOBBY') return null; // the lobby panel asks for confirmation
        if (status === 'LOCK_IN_ROUND') return outcome(await room.transition('QUESTION_ACTIVE'));
        if (status === 'QUESTION_ACTIVE') {
          // Two presses: the first stops answering, only the second reveals.
          if (secondsLeft(state.questionEndsAt, Date.now(), state.questionPausedAt) === 0)
            return outcome(await room.transition('QUESTION_REVEAL'));
          return outcome(await room.closeAnswers());
        }
        if (status === 'QUESTION_REVEAL' || status === 'PAUSE_BREAK') {
          return room.selectedId ? outcome(await room.transition('LOCK_IN_ROUND')) : 'finish';
        }
        return 'nothing';
      }

      if (command === 'blank') {
        return status === 'QUESTION_REVEAL' ? outcome(await room.transition('PAUSE_BREAK')) : status === 'LOBBY' ? null : 'noBreak';
      }

      if (status === 'LOBBY') return null;
      let slot: MediaSlot | null = null;
      if (currentQuestion && status === 'QUESTION_REVEAL' && isClip(currentQuestion.reveal_media)) slot = 'reveal';
      else if (currentQuestion && (status === 'QUESTION_ACTIVE' || status === 'QUESTION_REVEAL') && isClip(currentQuestion.media))
        slot = 'question';
      if (!currentQuestion || !slot) return 'noClip';
      const playback = room.mediaStatus[`${currentQuestion.id}:${slot}`]?.state;
      return outcome(await room.mediaControl(slot, playback === 'playing' ? 'pause' : playback === 'ended' ? 'replay' : 'play'));
    },
    enabled,
  );
}
