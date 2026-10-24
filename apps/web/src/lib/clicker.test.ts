import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLICKER_ACK_MS, clickerCommand, forwardClickerCommands } from './clicker';

const key = (init: KeyboardEventInit, target: EventTarget = document.body) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
};

describe('clickerCommand', () => {
  it('reads the keys clickers send', () => {
    for (const next of ['PageDown', 'ArrowRight', 'ArrowDown', 'MediaTrackNext']) expect(clickerCommand(key({ key: next }))).toBe('next');
    for (const back of ['PageUp', 'ArrowLeft', 'ArrowUp', 'MediaTrackPrevious', 'MediaPlayPause'])
      expect(clickerCommand(key({ key: back }))).toBe('back');
    for (const blank of ['b', 'B', '.']) expect(clickerCommand(key({ key: blank }))).toBe('blank');
    expect(clickerCommand(key({ key: 'Enter' }))).toBeNull();
  });

  it('finds the blank button on layouts that put another character on it', () => {
    expect(clickerCommand(key({ key: ':', code: 'Period' }))).toBe('blank');
  });

  it('ignores held keys, shortcuts and typing', () => {
    expect(clickerCommand(key({ key: 'PageDown', repeat: true }))).toBeNull();
    expect(clickerCommand(key({ key: 'ArrowRight', altKey: true }))).toBeNull();
    expect(clickerCommand(key({ key: 'b' }, document.createElement('textarea')))).toBeNull();
  });
});

describe('forwardClickerCommands', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes clicker presses on to the control room channel', async () => {
    const room = new BroadcastChannel('quizicius:clicker:s1');
    const received: unknown[] = [];
    room.addEventListener('message', (event) => received.push((event as MessageEvent).data));
    const stop = forwardClickerCommands('s1');

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(received).toEqual(['next']);
    stop();
    room.close();
  });

  it('goes fullscreen on the slideshow button instead of reloading the page', () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = requestFullscreen;
    const stop = forwardClickerCommands('s1');

    const event = new KeyboardEvent('keydown', { key: 'F5', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(requestFullscreen).toHaveBeenCalled();
    stop();
  });
});

describe('clicker feedback', () => {
  const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('tells the projector when no control room answers', async () => {
    const feedback: string[] = [];
    const stop = forwardClickerCommands('s2', (value) => feedback.push(value));

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await tick(CLICKER_ACK_MS + 100);

    expect(feedback).toEqual(['noResponse']);
    stop();
  });

  it('passes on what came of a press, but stays quiet when it worked', async () => {
    const feedback: string[] = [];
    const room = new BroadcastChannel('quizicius:clicker:s3');
    room.addEventListener('message', (event) => {
      if (typeof (event as MessageEvent).data !== 'string') return;
      room.postMessage({ received: true });
      room.postMessage({ outcome: feedback.length ? 'done' : 'finish' });
    });
    const stop = forwardClickerCommands('s3', (value) => feedback.push(value));

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await tick(50);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await tick(CLICKER_ACK_MS + 100);

    expect(feedback).toEqual(['finish']);
    stop();
    room.close();
  });
});
