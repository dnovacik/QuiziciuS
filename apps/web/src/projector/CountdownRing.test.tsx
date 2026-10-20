import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownRing } from './CountdownRing';

describe('CountdownRing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the remaining seconds and updates as time passes', () => {
    const endsAt = new Date('2026-09-16T00:00:20.000Z').toISOString();
    render(<CountdownRing endsAt={endsAt} totalSeconds={20} />);

    expect(screen.getByRole('img', { name: '20 seconds remaining' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole('img', { name: '15 seconds remaining' })).toBeInTheDocument();
  });

  it('never shows a negative remaining time once the deadline passes', () => {
    const endsAt = new Date('2026-09-16T00:00:05.000Z').toISOString();
    render(<CountdownRing endsAt={endsAt} totalSeconds={5} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('img', { name: '0 seconds remaining' })).toBeInTheDocument();
  });
});
