import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { subscribeToSession } from '../lib/supabase-client';
import { SessionControlPanel } from './SessionControlPanel';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

const STATE = {
  id: 's1',
  joinCode: 'AB12',
  status: 'LOBBY',
  currentQuestion: null,
  questionEndsAt: null,
  teams: [{ id: 't1', name: 'The Quizzards', isActive: true, score: 4, infractionCount: 1 }],
};

describe('SessionControlPanel', () => {
  it('renders the join code, status, teams, and legal next-state buttons', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(STATE);

    render(<SessionControlPanel sessionId="s1" token="host-token" />);

    expect(await screen.findByText('Join code: AB12')).toBeInTheDocument();
    expect(screen.getByText(/The Quizzards/)).toBeInTheDocument();
    expect(screen.getByText(/4 pts/)).toBeInTheDocument();
    expect(screen.getByText(/1 flag/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOCK_IN_ROUND' })).toBeInTheDocument();
  });

  it('posts a transition when a next-state button is clicked', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(STATE);
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<SessionControlPanel sessionId="s1" token="host-token" />);
    fireEvent.click(await screen.findByRole('button', { name: 'LOCK_IN_ROUND' }));

    expect(apiPost).toHaveBeenCalledWith(
      '/sessions/s1/transition',
      { status: 'LOCK_IN_ROUND', questionId: '' },
      'host-token',
    );
  });

  it('subscribes to realtime broadcasts for this session', () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue(STATE);
    render(<SessionControlPanel sessionId="s1" token="host-token" />);
    expect(subscribeToSession).toHaveBeenCalledWith('s1', expect.any(Function));
  });
});
