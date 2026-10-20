import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiGet } from '../lib/api-client';
import ProjectorApp from './ProjectorApp';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

function renderAt(sessionId: string) {
  return render(
    <MemoryRouter initialEntries={[`/projector/${sessionId}`]}>
      <Routes>
        <Route path="/projector/:sessionId" element={<ProjectorApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectorApp', () => {
  it('shows a waiting message before the session loads', () => {
    (apiGet as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderAt('s1');
    expect(screen.getByTestId('projector-loading')).toBeInTheDocument();
  });

  it('shows the countdown ring and prompt during QUESTION_ACTIVE', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'QUESTION_ACTIVE',
      currentQuestion: {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'Capital of France?',
        options: [{ id: 'a', label: 'Paris' }, { id: 'b', label: 'Lyon' }],
        points: 5,
        timeLimitSeconds: 20,
        orderIndex: 0,
        correctOptionId: null,
        correctNumeric: null,
        acceptedAnswers: null,
      },
      questionEndsAt: new Date(Date.now() + 20_000).toISOString(),
      teams: [],
    });

    renderAt('s1');
    expect(await screen.findByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByTestId('projector-timer')).toBeInTheDocument();
  });

  it('reveals the correct option label during QUESTION_REVEAL', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'QUESTION_REVEAL',
      currentQuestion: {
        id: 'q1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'Capital of France?',
        options: [{ id: 'a', label: 'Paris' }, { id: 'b', label: 'Lyon' }],
        points: 5,
        timeLimitSeconds: 20,
        orderIndex: 0,
        correctOptionId: 'a',
        correctNumeric: null,
        acceptedAnswers: null,
      },
      questionEndsAt: null,
      teams: [],
    });

    renderAt('s1');
    expect(await screen.findByTestId('reveal-banner')).toHaveTextContent('Paris');
  });

  it('shows the scoreboard sorted by score while FINISHED', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      joinCode: 'AB12',
      status: 'FINISHED',
      currentQuestion: null,
      questionEndsAt: null,
      teams: [
        { id: 't1', name: 'Low Scorers', isActive: true, score: 2, infractionCount: 0 },
        { id: 't2', name: 'High Scorers', isActive: true, score: 9, infractionCount: 0 },
      ],
    });

    renderAt('s1');
    const scoreboard = await screen.findByTestId('scoreboard');
    const teamNames = scoreboard.querySelectorAll('li');
    expect(teamNames[0]).toHaveTextContent('High Scorers');
    expect(teamNames[1]).toHaveTextContent('Low Scorers');
  });
});
