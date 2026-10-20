import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet } from '../lib/api-client';
import { SessionView } from './SessionView';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn().mockResolvedValue([]), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

describe('SessionView', () => {
  it('switches between the controls, disputes, and paper-mode tabs', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockImplementation((path: string) =>
      path.includes('/questions')
        ? Promise.resolve([])
        : Promise.resolve({
            id: 's1',
            joinCode: 'AB12',
            status: 'LOBBY',
            currentQuestion: null,
            questionEndsAt: null,
            teams: [],
          }),
    );

    render(<SessionView sessionId="s1" quizId="quiz-1" token="host-token" />);
    expect(await screen.findByText('Join code: AB12')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'paper' }));
    expect(await screen.findByText('Paper-mode scoring')).toBeInTheDocument();
  });
});
