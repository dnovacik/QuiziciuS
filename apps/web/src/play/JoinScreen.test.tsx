import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiPost } from '../lib/api-client';
import { JoinScreen } from './JoinScreen';

vi.mock('../lib/api-client', () => ({ apiPost: vi.fn() }));

describe('JoinScreen', () => {
  it('joins a session and reports the team credentials', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ teamId: 't1', name: 'The Quizzards', token: 'team-token' });
    const onJoined = vi.fn();

    render(<JoinScreen initialSessionId="s1" onJoined={onJoined} />);
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'The Quizzards' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await screen.findByRole('button', { name: 'Join' }); // let the submit handler settle
    expect(apiPost).toHaveBeenCalledWith('/sessions/s1/teams/join', { name: 'The Quizzards' });
    expect(onJoined).toHaveBeenCalledWith({ sessionId: 's1', teamId: 't1', token: 'team-token' });
  });

  it('shows an error message when joining fails', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('This quiz has finished'));

    render(<JoinScreen initialSessionId="s1" onJoined={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'The Quizzards' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText('This quiz has finished')).toBeInTheDocument();
  });
});
