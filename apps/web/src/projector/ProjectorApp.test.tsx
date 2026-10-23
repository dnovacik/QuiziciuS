import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { QuestionPublicDto, QuizSessionStateDto, QuizState } from '@quizicius/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../lib/api-client';
import { I18nProvider } from '../lib/i18n';
import ProjectorApp from './ProjectorApp';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn() }));

const session = vi.hoisted(() => ({ state: null as QuizSessionStateDto | null, error: null as string | null, refetch: vi.fn() }));
vi.mock('../lib/use-session-state', () => ({
  useSessionState: () => ({ state: session.state, error: session.error, refetch: session.refetch }),
}));

const QUESTION: QuestionPublicDto = {
  id: 'q1',
  type: 'MULTIPLE_CHOICE',
  prompt: 'Which film won in 1994?',
  options: [
    { id: 'a', label: 'Pulp Fiction' },
    { id: 'b', label: 'Forrest Gump' },
  ],
  points: 2,
  timeLimitSeconds: 30,
  orderIndex: 3,
  correctOptionId: null,
  correctNumeric: null,
  acceptedAnswers: null,
};

function setState(status: QuizState, overrides: Partial<QuizSessionStateDto> = {}) {
  session.state = {
    id: 's1',
    joinCode: 'A7F3',
    status,
    currentQuestion: null,
    questionEndsAt: null,
    teams: [
      { id: 't1', name: 'Wise Ducks', isActive: true, score: 6, infractionCount: 0 },
      { id: 't2', name: 'Pub Mozarts', isActive: true, score: 9, infractionCount: 0 },
      { id: 't3', name: 'Einsteins', isActive: false, score: 3, infractionCount: 0 },
      { id: 't4', name: 'Quiz Wolves', isActive: true, score: 1, infractionCount: 0 },
    ],
    ...overrides,
  };
}

function renderProjector() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/projector/s1']}>
        <Routes>
          <Route path="/projector/:sessionId" element={<ProjectorApp />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  session.state = null;
  session.error = null;
  session.refetch = vi.fn();
  vi.mocked(apiGet)
    .mockReset()
    .mockImplementation(async (path: string) => {
      if (path.endsWith('/display')) return { title: 'Friday Movie Quiz' };
      if (path.endsWith('/media')) return { mediaType: null, url: null };
      throw new Error(`unexpected GET ${path}`);
    });
});

describe('ProjectorApp', () => {
  it('shows how to join in the lobby: QR code, link, room code and teams', async () => {
    setState('LOBBY');
    renderProjector();

    expect(await screen.findByTestId('projector-title')).toHaveTextContent('Friday Movie Quiz');
    expect(screen.getByTestId('projector-qr').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('projector-join-url')).toHaveTextContent('/play/s1');
    expect(screen.getByTestId('projector-join-code')).toHaveTextContent('#A7F3');
    expect(screen.getByTestId('projector-team-count')).toHaveTextContent('3');
    expect(screen.getAllByTestId('projector-team')).toHaveLength(4);
  });

  it('builds up to the question without showing it during the lock-in round', () => {
    setState('LOCK_IN_ROUND', { currentQuestion: QUESTION });
    renderProjector();
    expect(screen.getByTestId('projector-lock-in')).toHaveTextContent('Otázka 4');
    expect(screen.queryByText('Which film won in 1994?')).not.toBeInTheDocument();
  });

  it('shows the active question with options and a countdown', () => {
    setState('QUESTION_ACTIVE', { currentQuestion: QUESTION, questionEndsAt: new Date(Date.now() + 20_000).toISOString() });
    renderProjector();
    expect(screen.getByTestId('projector-prompt')).toHaveTextContent('Which film won in 1994?');
    expect(within(screen.getByTestId('projector-options')).getByText('Forrest Gump')).toBeInTheDocument();
    expect(screen.getByTestId('projector-timer')).toHaveAccessibleName(/^(19|20) /);
  });

  it('highlights the correct option on reveal', () => {
    setState('QUESTION_REVEAL', { currentQuestion: { ...QUESTION, correctOptionId: 'b' } });
    renderProjector();
    expect(screen.getByTestId('projector-correct-option')).toHaveTextContent('Forrest Gump');
    expect(screen.queryByTestId('projector-timer')).not.toBeInTheDocument();
  });

  it('shows the accepted answer for a revealed free-text question', () => {
    setState('QUESTION_REVEAL', {
      currentQuestion: { ...QUESTION, type: 'FREE_TEXT', options: null, acceptedAnswers: ['Forrest Gump', 'Forest Gump'] },
    });
    renderProjector();
    expect(screen.getByTestId('projector-correct-answer')).toHaveTextContent('Forrest Gump, Forest Gump');
  });

  it('shows the pause card with the podium and the rest of the standings', () => {
    setState('PAUSE_BREAK');
    renderProjector();
    expect(screen.getByTestId('projector-pause')).toBeInTheDocument();
    expect(screen.getByTestId('projector-podium-1')).toHaveTextContent('Pub Mozarts');
    expect(screen.getByTestId('projector-podium-2')).toHaveTextContent('Wise Ducks');
    expect(screen.getAllByTestId('projector-rank-row')).toHaveLength(1);
  });

  it('crowns the champion when the quiz is finished', () => {
    setState('FINISHED');
    renderProjector();
    expect(screen.getByTestId('projector-champion')).toHaveTextContent('Pub Mozarts');
    expect(screen.getAllByTestId('projector-final-row')).toHaveLength(3);
  });

  it('covers the screen with a reconnect prompt when the connection drops', () => {
    setState('LOBBY');
    session.error = 'Failed to fetch';
    renderProjector();
    fireEvent.click(within(screen.getByTestId('projector-offline')).getByRole('button'));
    expect(session.refetch).toHaveBeenCalled();
  });
});
