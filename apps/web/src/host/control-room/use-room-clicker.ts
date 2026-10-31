import type { MediaRefDto, MediaSlot } from '@quizicius/shared-types';
import { useClicker, type ClickerCommand, type ClickerOutcome } from '../../lib/clicker';
import type { TranslationKey } from '../../lib/i18n';
import { secondsLeft } from '../../lib/quiz';
import type { ControlRoom } from './use-control-room';

const isClip = (media: MediaRefDto | null | undefined) => !!media && media.kind !== 'image';

/** The clip "back" plays or pauses right now: the reveal clip at the reveal, otherwise the question's. */
export function clipSlot(room: ControlRoom): MediaSlot | null {
  const { state, currentQuestion } = room;
  if (!state || !currentQuestion) return null;
  if (state.status === 'QUESTION_REVEAL' && isClip(currentQuestion.reveal_media)) return 'reveal';
  if ((state.status === 'QUESTION_ACTIVE' || state.status === 'QUESTION_REVEAL') && isClip(currentQuestion.media)) return 'question';
  return null;
}

/** Whether answering for the open question has stopped (time up or closed by the host). */
function answersClosed(room: ControlRoom): boolean {
  const state = room.state!;
  return secondsLeft(state.questionEndsAt, Date.now(), state.questionPausedAt) === 0;
}

/** What "next" does now, as the label of the matching control-room button; null when nothing. */
export function nextStepLabel(room: ControlRoom): TranslationKey | null {
  const status = room.state?.status;
  if (status === 'LOBBY') return room.questions.length ? 'host.room.start' : null;
  if (status === 'LOCK_IN_ROUND') return 'host.room.showQuestion';
  if (status === 'QUESTION_ACTIVE') return answersClosed(room) ? 'host.room.reveal' : 'host.room.stopAnswers';
  if (status === 'QUESTION_REVEAL' && room.roundBreak) return 'host.room.roundBreak';
  if (status === 'QUESTION_REVEAL' || status === 'PAUSE_BREAK') return room.selectedId ? 'host.room.next' : null;
  return null;
}

/**
 * One step of the night per command, like slides: prepare the question, show it, stop answers,
 * reveal, then on to the next one. "blank" calls a break and "back" plays or pauses the clip.
 * Starting from the lobby is left to the caller, which asks for confirmation first (null).
 */
export async function runRoomCommand(room: ControlRoom, command: ClickerCommand): Promise<ClickerOutcome | null> {
  const { state, currentQuestion } = room;
  // Busy: the previous press is still on its way, this one is simply dropped.
  if (!state || room.busy) return null;
  const status = state.status;
  const outcome = (ok: boolean): ClickerOutcome => (ok ? 'done' : 'error');

  if (command === 'next') {
    if (status === 'LOBBY') return null;
    if (status === 'LOCK_IN_ROUND') return outcome(await room.transition('QUESTION_ACTIVE'));
    if (status === 'QUESTION_ACTIVE') {
      // Two presses: the first stops answering, only the second reveals.
      return outcome(answersClosed(room) ? await room.transition('QUESTION_REVEAL') : await room.closeAnswers());
    }
    // The end of a round: the coffee break comes before the next round's first question.
    if (status === 'QUESTION_REVEAL' && room.roundBreak) return outcome(await room.transition('PAUSE_BREAK'));
    if (status === 'QUESTION_REVEAL' || status === 'PAUSE_BREAK') {
      return room.selectedId ? outcome(await room.transition('LOCK_IN_ROUND')) : 'finish';
    }
    return 'nothing';
  }

  if (command === 'blank') {
    return status === 'QUESTION_REVEAL' ? outcome(await room.transition('PAUSE_BREAK')) : status === 'LOBBY' ? null : 'noBreak';
  }

  if (status === 'LOBBY') return null;
  const slot = clipSlot(room);
  if (!currentQuestion || !slot) return 'noClip';
  const playback = room.mediaStatus[`${currentQuestion.id}:${slot}`]?.state;
  return outcome(await room.mediaControl(slot, playback === 'playing' ? 'pause' : playback === 'ended' ? 'replay' : 'play'));
}

/** Drives the room from a presentation clicker; the lobby panel handles starting the quiz. */
export function useRoomClicker(room: ControlRoom, sessionId: string, enabled: boolean) {
  useClicker(sessionId, (command: ClickerCommand) => runRoomCommand(room, command), enabled);
}
