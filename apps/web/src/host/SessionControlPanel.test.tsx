import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiPost } from '../lib/api-client';
import { subscribeToSession } from '../lib/supabase-client';
import { SessionControlPanel } from './SessionControlPanel';

vi.mock('../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

const STATE = {
  id: 's1',
  joinCode: 'AB12',
  status: 'LOBBY',
  currentQuestion: null,
  questionEndsAt: null,
  teams: [{ id: 't1', name: 'The Quizzards', isActive: true, score: 4, infractionCount: 1 }],
};

const QUESTIONS = [
  { id: 'q1', prompt: 'Capital of France?', order_index: 0 },
  { id: 'q2', prompt: 'Capital of Italy?', order_index: 1 },
];

/** Routes the shared apiGet mock by path: session state vs. the quiz question list. */
function mockApiGet(questions: unknown = QUESTIONS, state: unknown = STATE) {
  (apiGet as ReturnType<typeof vi.fn>).mockImplementation((path: string) =>
    path.includes('/questions') ? Promise.resolve(questions) : Promise.resolve(state),
  );
}

function renderPanel() {
  return render(<SessionControlPanel sessionId="s1" quizId="quiz-1" token="host-token" />);
}

beforeEach(() => {
  (apiGet as ReturnType<typeof vi.fn>).mockReset();
  (apiPost as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({});
});

describe('SessionControlPanel', () => {
  it('renders the join code, status, teams, and legal next-state buttons', async () => {
    mockApiGet();

    renderPanel();

    expect(await screen.findByText('Join code: AB12')).toBeInTheDocument();
    expect(screen.getByText(/The Quizzards/)).toBeInTheDocument();
    expect(screen.getByText(/4 pts/)).toBeInTheDocument();
    expect(screen.getByText(/1 flag/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOCK_IN_ROUND' })).toBeInTheDocument();
  });

  it('offers a FINISHED button to end the session early from a non-terminal state', async () => {
    mockApiGet();

    renderPanel();

    expect(await screen.findByRole('button', { name: 'LOCK_IN_ROUND' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FINISHED' })).toBeInTheDocument();
  });

  it('lists the quiz questions by prompt in a picker instead of a raw id field', async () => {
    mockApiGet();

    renderPanel();

    const select = await screen.findByLabelText('Next question');
    expect(apiGet).toHaveBeenCalledWith('/quizzes/quiz-1/questions', 'host-token');
    expect(screen.getByRole('option', { name: 'Capital of France?' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Capital of Italy?' })).toBeInTheDocument();
    expect(select).toHaveValue('q1');
    expect(screen.queryByPlaceholderText('Next question id')).not.toBeInTheDocument();
  });

  it('posts a transition with the question chosen in the picker', async () => {
    mockApiGet();

    renderPanel();
    fireEvent.change(await screen.findByLabelText('Next question'), { target: { value: 'q2' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOCK_IN_ROUND' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        '/sessions/s1/transition',
        { status: 'LOCK_IN_ROUND', questionId: 'q2' },
        'host-token',
      ),
    );
  });

  it('tells the host when the quiz has no questions yet', async () => {
    mockApiGet([]);

    renderPanel();

    expect(await screen.findByText('No questions in this quiz yet.')).toBeInTheDocument();
  });

  it('surfaces a failed transition instead of swallowing it', async () => {
    mockApiGet();
    (apiPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network down'));

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'FINISHED' }));

    expect(await screen.findByText('Network down')).toBeInTheDocument();
  });

  it('resyncs and reports the current state when the server rejects the transition with 409', async () => {
    mockApiGet();
    (apiPost as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(409, 'Cannot transition from QUESTION_ACTIVE to LOCK_IN_ROUND', {
        statusCode: 409,
        message: 'Cannot transition from QUESTION_ACTIVE to LOCK_IN_ROUND',
        currentState: 'QUESTION_ACTIVE',
      }),
    );

    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'LOCK_IN_ROUND' }));

    expect(await screen.findByText(/session is currently QUESTION_ACTIVE/)).toBeInTheDocument();
    // One initial state fetch plus the post-409 refetch (the question list is separate).
    const stateFetches = (apiGet as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([path]) => path === '/sessions/s1/state',
    );
    expect(stateFetches.length).toBeGreaterThanOrEqual(2);
  });

  it('subscribes to realtime broadcasts for this session', () => {
    mockApiGet();
    renderPanel();
    expect(subscribeToSession).toHaveBeenCalledWith('s1', expect.any(Function));
  });
});
