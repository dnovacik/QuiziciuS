import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { QuizDashboard } from './QuizDashboard';

vi.mock('../lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

describe('QuizDashboard', () => {
  it('lists existing quizzes and creates a new one', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'q1', title: 'Existing Quiz' }]);
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'q2', title: 'New Quiz' });

    render(<QuizDashboard token="host-token" onSessionCreated={vi.fn()} />);

    expect(await screen.findByText('Existing Quiz')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('New quiz title'), { target: { value: 'New Quiz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create quiz' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/quizzes', { title: 'New Quiz' }, 'host-token'),
    );
    expect(await screen.findByText('New Quiz')).toBeInTheDocument();
  });

  it('starts a session for a quiz and reports the new session id', async () => {
    (apiGet as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'q1', title: 'Existing Quiz' }]);
    (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'session-1', join_code: 'AB12' });
    const onSessionCreated = vi.fn();

    render(<QuizDashboard token="host-token" onSessionCreated={onSessionCreated} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start session' }));

    await waitFor(() => expect(onSessionCreated).toHaveBeenCalledWith('session-1'));
  });
});
