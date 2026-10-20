import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { PaperModeGrid } from './PaperModeGrid';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

describe('PaperModeGrid', () => {
  it('awards manual points to a team', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'PAUSE_BREAK',
      currentQuestion: null,
      questionEndsAt: null,
      teams: [{ id: 't1', name: 'The Quizzards', isActive: true, score: 0, infractionCount: 0 }],
    });
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<PaperModeGrid sessionId="s1" token="host-token" />);

    const pointsInput = await screen.findByRole('spinbutton');
    fireEvent.change(pointsInput, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Award' }));

    expect(apiPost).toHaveBeenCalledWith(
      '/sessions/s1/teams/t1/paper-score',
      { points: 3, reason: undefined },
      'host-token',
    );
  });
});
