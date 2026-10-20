import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { QuizDashboard } from './QuizDashboard';

vi.mock('../lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

function mockGetByPath(routes: Record<string, unknown>): void {
  (apiGet as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    for (const [prefix, value] of Object.entries(routes)) {
      if (path.startsWith(prefix)) return Promise.resolve(value);
    }
    return Promise.reject(new Error(`Unexpected apiGet path: ${path}`));
  });
}

describe('QuizDashboard', () => {
  it('lists existing quizzes and creates a new one', async () => {
    mockGetByPath({ '/quizzes': [{ id: 'q1', title: 'Existing Quiz', category_id: null }], '/categories': [] });
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'q2', title: 'New Quiz', category_id: null });

    render(<QuizDashboard token="host-token" onSessionCreated={vi.fn()} />);

    expect(await screen.findByText('Existing Quiz')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('New quiz title'), { target: { value: 'New Quiz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create quiz' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/quizzes', { title: 'New Quiz', categoryId: undefined }, 'host-token'),
    );
    expect(await screen.findByText('New Quiz')).toBeInTheDocument();
  });

  it('starts a session for a quiz and reports the new session id', async () => {
    mockGetByPath({ '/quizzes': [{ id: 'q1', title: 'Existing Quiz', category_id: null }], '/categories': [] });
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'session-1', join_code: 'AB12' });
    const onSessionCreated = vi.fn();

    render(<QuizDashboard token="host-token" onSessionCreated={onSessionCreated} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start session' }));

    await waitFor(() => expect(onSessionCreated).toHaveBeenCalledWith('session-1', 'q1'));
  });

  it('surfaces a failed session start instead of swallowing it', async () => {
    mockGetByPath({ '/quizzes': [{ id: 'q1', title: 'Existing Quiz', category_id: null }], '/categories': [] });
    (apiPost as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Quiz not found'));
    const onSessionCreated = vi.fn();

    render(<QuizDashboard token="host-token" onSessionCreated={onSessionCreated} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start session' }));

    expect(await screen.findByText('Quiz not found')).toBeInTheDocument();
    expect(onSessionCreated).not.toHaveBeenCalled();
  });

  it('surfaces a failed quiz list load', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockImplementation((path: string) =>
      path.startsWith('/quizzes') ? Promise.reject(new Error('Session expired')) : Promise.resolve([]),
    );

    render(<QuizDashboard token="host-token" onSessionCreated={vi.fn()} />);

    expect(await screen.findByText('Session expired')).toBeInTheDocument();
  });

  it('shows each quiz\'s category and lets the host pick one when creating a quiz', async () => {
    mockGetByPath({
      '/quizzes': [{ id: 'q1', title: 'Existing Quiz', category_id: 'cat1' }],
      '/categories': [
        { id: 'cat1', name: 'Sports' },
        { id: 'cat2', name: 'History' },
      ],
    });
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'q2', title: 'New Quiz', category_id: 'cat2' });

    render(<QuizDashboard token="host-token" onSessionCreated={vi.fn()} />);

    const quizItem = (await screen.findByText('Existing Quiz')).closest('li')!;
    expect(within(quizItem).getByText('Sports')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('New quiz title'), { target: { value: 'New Quiz' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'cat2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create quiz' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/quizzes', { title: 'New Quiz', categoryId: 'cat2' }, 'host-token'),
    );
  });
});
