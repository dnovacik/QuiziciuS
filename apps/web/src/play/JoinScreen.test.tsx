import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { JoinScreen } from './JoinScreen';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

beforeEach(() => {
  (apiGet as ReturnType<typeof vi.fn>).mockReset();
  (apiPost as ReturnType<typeof vi.fn>).mockReset();
});

describe('JoinScreen with a session id from the URL', () => {
  it('joins a session and reports the team credentials', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ teamId: 't1', name: 'The Quizzards', token: 'team-token' });
    const onJoined = vi.fn();

    render(<JoinScreen initialSessionId="s1" onJoined={onJoined} />);
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'The Quizzards' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await screen.findByRole('button', { name: 'Join' }); // let the submit handler settle
    expect(apiGet).not.toHaveBeenCalled();
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

describe('JoinScreen without a session id from the URL', () => {
  it('resolves the spoken join code to a session before joining', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 's1' });
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ teamId: 't1', name: 'The Quizzards', token: 'team-token' });
    const onJoined = vi.fn();

    render(<JoinScreen onJoined={onJoined} />);
    expect(screen.queryByPlaceholderText('Session ID')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Join code'), { target: { value: 'ab12' } });
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'The Quizzards' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    await waitFor(() => expect(onJoined).toHaveBeenCalled());
    expect(apiGet).toHaveBeenCalledWith('/sessions/by-code/AB12');
    expect(apiPost).toHaveBeenCalledWith('/sessions/s1/teams/join', { name: 'The Quizzards' });
    expect(onJoined).toHaveBeenCalledWith({ sessionId: 's1', teamId: 't1', token: 'team-token' });
  });

  it('shows an error and never attempts to join when the code does not resolve', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('No open session with that join code'));

    render(<JoinScreen onJoined={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Join code'), { target: { value: 'ZZZZ' } });
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'The Quizzards' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText('No open session with that join code')).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });
});
