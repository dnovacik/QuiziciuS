import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizSessionStateDto } from '@quizicius/shared-types';
import { apiPost } from '../lib/api-client';
import { QuestionScreen } from './QuestionScreen';

vi.mock('../lib/api-client', () => ({ apiPost: vi.fn() }));

const MC_STATE: QuizSessionStateDto = {
  id: 's1',
  joinCode: 'AB12',
  status: 'QUESTION_ACTIVE',
  currentQuestion: {
    id: 'q1',
    type: 'MULTIPLE_CHOICE',
    prompt: 'Capital of France?',
    options: [
      { id: 'a', label: 'Paris' },
      { id: 'b', label: 'Lyon' },
    ],
    points: 5,
    timeLimitSeconds: 20,
    orderIndex: 0,
    correctOptionId: null,
    correctNumeric: null,
    acceptedAnswers: null,
  },
  questionEndsAt: new Date(Date.now() + 20_000).toISOString(),
  teams: [],
};

describe('QuestionScreen', () => {
  it('submits the selected option for a multiple-choice question', async () => {
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<QuestionScreen state={MC_STATE} teamId="t1" token="team-token" onTapToLockIn={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Paris' }));

    expect(apiPost).toHaveBeenCalledWith(
      '/sessions/s1/answers',
      { questionId: 'q1', response: { optionId: 'a' } },
      'team-token',
    );
    expect(await screen.findByText('Answer locked in!')).toBeInTheDocument();
  });

  it('calls onTapToLockIn when the LOCK_IN_ROUND overlay is tapped', () => {
    const onTapToLockIn = vi.fn();
    render(
      <QuestionScreen state={{ ...MC_STATE, status: 'LOCK_IN_ROUND' }} teamId="t1" token="team-token" onTapToLockIn={onTapToLockIn} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tap to Lock In' }));
    expect(onTapToLockIn).toHaveBeenCalled();
  });

  it('shows the correct answer during QUESTION_REVEAL', () => {
    render(
      <QuestionScreen
        state={{ ...MC_STATE, status: 'QUESTION_REVEAL', currentQuestion: { ...MC_STATE.currentQuestion!, correctOptionId: 'a' } }}
        teamId="t1"
        token="team-token"
        onTapToLockIn={vi.fn()}
      />,
    );

    expect(screen.getByText(/Correct answer: Paris/)).toBeInTheDocument();
  });
});
