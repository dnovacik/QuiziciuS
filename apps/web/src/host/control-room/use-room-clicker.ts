import type { MediaRefDto, MediaSlot } from '@quizicius/shared-types';
import { useClicker, type ClickerCommand } from '../../lib/clicker';
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
    (command: ClickerCommand) => {
      const { state, currentQuestion } = room;
      if (!state || room.busy) return;
      const status = state.status;

      if (command === 'next') {
        if (status === 'LOCK_IN_ROUND') void room.transition('QUESTION_ACTIVE');
        else if (status === 'QUESTION_ACTIVE') {
          // Two presses: the first stops answering, only the second reveals.
          if (secondsLeft(state.questionEndsAt, Date.now()) === 0) void room.transition('QUESTION_REVEAL');
          else void room.closeAnswers();
        } else if ((status === 'QUESTION_REVEAL' || status === 'PAUSE_BREAK') && room.selectedId) void room.transition('LOCK_IN_ROUND');
        return;
      }

      if (command === 'blank') {
        if (status === 'QUESTION_REVEAL') void room.transition('PAUSE_BREAK');
        return;
      }

      if (!currentQuestion) return;
      let slot: MediaSlot | null = null;
      if (status === 'QUESTION_REVEAL' && isClip(currentQuestion.reveal_media)) slot = 'reveal';
      else if ((status === 'QUESTION_ACTIVE' || status === 'QUESTION_REVEAL') && isClip(currentQuestion.media)) slot = 'question';
      if (!slot) return;
      const playback = room.mediaStatus[`${currentQuestion.id}:${slot}`]?.state;
      void room.mediaControl(slot, playback === 'playing' ? 'pause' : playback === 'ended' ? 'replay' : 'play');
    },
    enabled,
  );
}
