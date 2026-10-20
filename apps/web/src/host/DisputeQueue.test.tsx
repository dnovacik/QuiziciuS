import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPatch, apiPost } from '../lib/api-client';
import { DisputeQueue } from './DisputeQueue';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPatch: vi.fn(), apiPost: vi.fn() }));

const DISPUTE = {
  id: 'a1',
  sessionId: 's1',
  questionId: 'q1',
  teamId: 't1',
  response: { text: 'Pahhris' },
  isCorrect: null,
  confidence: 0.71,
  needsReview: true,
  gradedBy: null,
  scoreAwarded: 0,
};

const INFRACTION = { id: 'inf1', team_id: 't1', type: 'VISIBILITY_HIDDEN' };

beforeEach(() => {
  (apiGet as ReturnType<typeof vi.fn>).mockReset();
  (apiPatch as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({});
  (apiPost as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({});
});

describe('DisputeQueue', () => {
  it('lists disputed answers and approves one', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce([DISPUTE]).mockResolvedValueOnce([]);

    render(<DisputeQueue sessionId="s1" token="host-token" />);

    expect(await screen.findByText(/Pahhris/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(apiPost).toHaveBeenCalledWith('/answers/a1/resolve-dispute', { decision: 'APPROVE' }, 'host-token');
  });

  it('shows an empty state with no disputes or infractions', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    render(<DisputeQueue sessionId="s1" token="host-token" />);

    expect(await screen.findByText('No free-text answers need review.')).toBeInTheDocument();
    expect(screen.getByText('No infractions reported.')).toBeInTheDocument();
  });

  it('dismisses an infraction and refetches the queue', async () => {
    (apiGet as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([INFRACTION])
      // refetch after the dismiss
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    render(<DisputeQueue sessionId="s1" token="host-token" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

    expect(apiPatch).toHaveBeenCalledWith('/sessions/s1/infractions/inf1/review', {}, 'host-token');
    expect(await screen.findByText('No infractions reported.')).toBeInTheDocument();
  });

  it('surfaces a failed load instead of swallowing it', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not your session'));

    render(<DisputeQueue sessionId="s1" token="host-token" />);

    expect(await screen.findByText('Not your session')).toBeInTheDocument();
  });

  it('surfaces a failed dispute resolution', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce([DISPUTE]).mockResolvedValueOnce([]);
    (apiPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Answer already graded'));

    render(<DisputeQueue sessionId="s1" token="host-token" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(screen.getByText('Answer already graded')).toBeInTheDocument());
  });
});
