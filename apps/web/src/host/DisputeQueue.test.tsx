import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { DisputeQueue } from './DisputeQueue';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

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

describe('DisputeQueue', () => {
  it('lists disputed answers and approves one', async () => {
    (apiGet as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([DISPUTE])
      .mockResolvedValueOnce([]);
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});

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
});
