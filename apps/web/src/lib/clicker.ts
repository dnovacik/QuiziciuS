import { useEffect, useRef } from 'react';

/** What a presentation clicker asks for: the forward and back arrows and the "blank screen" button. */
export type ClickerCommand = 'next' | 'back' | 'blank';

/**
 * What came of a press, for the projector: done, refused or failed, or nothing to do and why.
 * `null` from a handler means "not mine" (another part of the control room answers).
 */
export type ClickerOutcome = 'done' | 'error' | 'finish' | 'noBreak' | 'noClip' | 'nothing';
/** The projector heard nothing back: no control room is open in this browser. */
export type ClickerFeedback = Exclude<ClickerOutcome, 'done'> | 'noResponse';

const isCommand = (value: unknown): value is ClickerCommand => value === 'next' || value === 'back' || value === 'blank';
/** How long the projector waits for the control room to confirm it heard a press. */
export const CLICKER_ACK_MS = 1500;

// Clickers are keyboards. Logitech R400/R500/R700/R800 and Kensington send Page Down/Up, others arrows
// (left/right or up/down) or media keys; the blank button is "." (Logitech) or B (Kensington, Keyspan).
const KEYS: Record<string, ClickerCommand> = {
  PageDown: 'next',
  ArrowRight: 'next',
  ArrowDown: 'next',
  MediaTrackNext: 'next',
  PageUp: 'back',
  ArrowLeft: 'back',
  ArrowUp: 'back',
  MediaTrackPrevious: 'back',
  MediaPlayPause: 'back',
  b: 'blank',
  B: 'blank',
  '.': 'blank',
};
// The blank button by its physical key, for keyboard layouts that put another character there.
const CODES: Record<string, ClickerCommand> = { Period: 'blank', KeyB: 'blank' };

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** The clicker command a key press stands for; typing in a field and shortcuts never count. */
export function clickerCommand(event: KeyboardEvent): ClickerCommand | null {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || typing(event.target)) return null;
  return KEYS[event.key] ?? CODES[event.code] ?? null;
}

/**
 * The slideshow button: F5 (Shift+F5 on some) to start, Escape to stop, sometimes alternating on
 * one button. In a browser F5 would reload the page, so the projector takes it as "go fullscreen".
 */
export function isSlideshowKey(event: KeyboardEvent): boolean {
  return event.key === 'F5' && !event.ctrlKey && !event.altKey && !event.metaKey && !typing(event.target);
}

// Local to this browser on purpose: only a window the host opened on this machine can drive the room.
const channelName = (sessionId: string) => `quizicius:clicker:${sessionId}`;

function openChannel(sessionId: string): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName(sessionId));
}

/**
 * Projector: hands clicker presses to the control room open in the same browser, and reports
 * presses that did nothing, failed, or reached no control room at all.
 */
export function forwardClickerCommands(sessionId: string, onFeedback: (feedback: ClickerFeedback) => void = () => {}): () => void {
  const channel = openChannel(sessionId);
  let waiting: number | null = null;
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { received?: boolean; outcome?: ClickerOutcome } | null;
    if (data?.received && waiting !== null) {
      window.clearTimeout(waiting);
      waiting = null;
    }
    if (data?.outcome && data.outcome !== 'done') onFeedback(data.outcome);
  };
  channel?.addEventListener('message', onMessage);
  const onKeyDown = (event: KeyboardEvent) => {
    if (isSlideshowKey(event)) {
      // Escape leaves fullscreen on its own; F5 toggles for clickers that never send Escape.
      event.preventDefault();
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
      return;
    }
    const command = clickerCommand(event);
    if (!command || !channel) return;
    event.preventDefault();
    channel.postMessage(command);
    if (waiting !== null) window.clearTimeout(waiting);
    waiting = window.setTimeout(() => {
      waiting = null;
      onFeedback('noResponse');
    }, CLICKER_ACK_MS);
  };
  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    if (waiting !== null) window.clearTimeout(waiting);
    channel?.close();
  };
}

type ClickerHandler = (command: ClickerCommand) => ClickerOutcome | null | void | Promise<ClickerOutcome | null | void>;

/** Control room: clicker presses on this page, and those the projector forwards. */
export function useClicker(sessionId: string, onCommand: ClickerHandler, enabled = true): void {
  const handler = useRef(onCommand);
  handler.current = onCommand;
  useEffect(() => {
    if (!enabled) return;
    const channel = openChannel(sessionId);
    const onKeyDown = (event: KeyboardEvent) => {
      const command = clickerCommand(event);
      if (!command) return;
      event.preventDefault();
      handler.current(command);
    };
    // The page may have closed the channel by the time a slow action finishes.
    const reply = (message: object) => {
      try {
        channel?.postMessage(message);
      } catch {
        // Nobody left to tell.
      }
    };
    // A press from the projector is confirmed at once, and its outcome follows when there is one.
    const onMessage = (event: MessageEvent) => {
      if (!isCommand(event.data)) return;
      reply({ received: true });
      void Promise.resolve(handler.current(event.data)).then((outcome) => {
        if (outcome) reply({ outcome });
      });
    };
    document.addEventListener('keydown', onKeyDown);
    channel?.addEventListener('message', onMessage);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      channel?.close();
    };
  }, [sessionId, enabled]);
}
