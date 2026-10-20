import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QuizSessionStateDto } from '@quizicius/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from '../lib/api-client';
import PlayApp from './PlayApp';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

const sessionState = vi.hoisted(() => ({ current: null as QuizSessionStateDto | null }));
vi.mock('../lib/use-session-state', () => ({
  useSessionState: () => ({ state: sessionState.current, error: null, refetch: vi.fn() }),
}));

function stateWithQuestion(questionId: string, prompt: string, optionLabel: string): QuizSessionStateDto {
  return {
    id: 's1',
    joinCode: 'AB12',
    status: 'QUESTION_ACTIVE',
    currentQuestion: {
      id: questionId,
      type: 'MULTIPLE_CHOICE',
      prompt,
      options: [{ id: 'a', label: optionLabel }],
      points: 1,
      timeLimitSeconds: 20,
      orderIndex: 0,
      correctOptionId: null,
      correctNumeric: null,
      acceptedAnswers: null,
    },
    questionEndsAt: new Date(Date.now() + 20_000).toISOString(),
    teams: [],
  };
}

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/play/s1']}>
      <Routes>
        <Route path="/play/:sessionId" element={<PlayApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionState.current = null;
  localStorage.clear();
  (apiPost as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({});
});

afterEach(() => {
  localStorage.clear();
});

describe('PlayApp', () => {
  it('shows the join screen when no team is stored for this session', () => {
    renderPlay();

    expect(screen.getByRole('heading', { name: 'Join the quiz' })).toBeInTheDocument();
  });

  it('lets a team answer a second question after locking in an answer to the first', async () => {
    localStorage.setItem(
      'quizicius:team:s1',
      JSON.stringify({ sessionId: 's1', teamId: 't1', token: 'team-token' }),
    );
    sessionState.current = stateWithQuestion('q1', 'Capital of France?', 'Paris');

    const { rerender } = renderPlay();

    fireEvent.click(await screen.findByRole('button', { name: 'Paris' }));
    expect(await screen.findByText('Answer locked in!')).toBeInTheDocument();

    // The session advances to the next question; QuestionScreen must remount so its
    // local `submitted` flag resets and the team can answer again.
    sessionState.current = stateWithQuestion('q2', 'Capital of Italy?', 'Rome');
    rerender(
      <MemoryRouter initialEntries={['/play/s1']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayApp />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Answer locked in!')).not.toBeInTheDocument();
    const secondOption = await screen.findByRole('button', { name: 'Rome' });

    fireEvent.click(secondOption);
    expect(apiPost).toHaveBeenLastCalledWith(
      '/sessions/s1/answers',
      { questionId: 'q2', response: { optionId: 'a' } },
      'team-token',
    );
  });
});
