import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { QuestionPublicDto, QuizSessionStateDto, QuizState } from '@quizicius/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../lib/api-client';
import { I18nProvider } from '../lib/i18n';
import ProjectorApp from './ProjectorApp';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn() }));
vi.mock('../lib/media-channel', () => ({ subscribeToMediaControl: vi.fn(() => vi.fn()), sendMediaStatus: vi.fn() }));

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
  unit: null,
};

function setState(status: QuizState, overrides: Partial<QuizSessionStateDto> = {}) {
  session.state = {
    id: 's1',
    joinCode: 'A7F3',
    status,
    currentQuestion: null,
    questionEndsAt: null,
    questionPausedAt: null,
    answeredCount: null,
    playedQuestionIds: [],
    breakEndsAt: null,
    breakMessage: null,
    teams: [
      {
        id: 't1',
        name: 'Wise Ducks',
        isActive: true,
        registeredTeamId: null,
        tableNumber: null,
        ready: false,
        readyFullscreen: false,
        score: 6,
        infractionCount: 0,
      },
      {
        id: 't2',
        name: 'Pub Mozarts',
        isActive: true,
        registeredTeamId: null,
        tableNumber: null,
        ready: false,
        readyFullscreen: false,
        score: 9,
        infractionCount: 0,
      },
      {
        id: 't3',
        name: 'Einsteins',
        isActive: false,
        registeredTeamId: null,
        tableNumber: null,
        ready: false,
        readyFullscreen: false,
        score: 3,
        infractionCount: 0,
      },
      {
        id: 't4',
        name: 'Quiz Wolves',
        isActive: true,
        registeredTeamId: null,
        tableNumber: null,
        ready: false,
        readyFullscreen: false,
        score: 1,
        infractionCount: 0,
      },
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
      if (path.endsWith('/media')) return { media: null, revealMedia: null };
      throw new Error(`unexpected GET ${path}`);
    });
});

describe('ProjectorApp', () => {
  it('shows "no time limit" instead of a countdown, then "answers closed"', () => {
    setState('QUESTION_ACTIVE', { currentQuestion: { ...QUESTION, timeLimitSeconds: 0 }, questionEndsAt: null });
    const { unmount } = renderProjector();
    expect(screen.getByTestId('projector-untimed')).toHaveTextContent('Bez časového limitu');
    expect(screen.queryByTestId('projector-timer')).not.toBeInTheDocument();
    unmount();

    setState('QUESTION_ACTIVE', { currentQuestion: { ...QUESTION, timeLimitSeconds: 0 }, questionEndsAt: new Date().toISOString() });
    renderProjector();
    expect(screen.getByTestId('projector-untimed')).toHaveTextContent('Odpovede uzavreté');
  });

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

  it('shows how many connected teams are ready during the lock-in round', () => {
    setState('LOCK_IN_ROUND', { currentQuestion: QUESTION });
    session.state!.teams = session.state!.teams.map((team) => (team.id === 't1' ? { ...team, ready: true } : team));
    renderProjector();
    const active = session.state!.teams.filter((team) => team.isActive).length;
    expect(screen.getByTestId('projector-ready-count')).toHaveTextContent(`1 / ${active}`);
    expect(screen.getByTestId('projector-ready-t1')).toHaveAttribute('data-ready', 'true');
  });

  it('shows the active question with options and a countdown', () => {
    setState('QUESTION_ACTIVE', { currentQuestion: QUESTION, questionEndsAt: new Date(Date.now() + 20_000).toISOString() });
    renderProjector();
    expect(screen.getByTestId('projector-prompt')).toHaveTextContent('Which film won in 1994?');
    expect(within(screen.getByTestId('projector-options')).getByText('Forrest Gump')).toBeInTheDocument();
    expect(screen.getByTestId('projector-timer')).toHaveAccessibleName(/^(19|20) /);
  });

  it('shows how many teams have answered, and a paused timer standing still', () => {
    const now = Date.now();
    setState('QUESTION_ACTIVE', {
      currentQuestion: QUESTION,
      questionEndsAt: new Date(now + 20_000).toISOString(),
      questionPausedAt: new Date(now - 60_000).toISOString(),
      answeredCount: 2,
      playedQuestionIds: [],
    });
    renderProjector();
    expect(screen.getByTestId('projector-answered')).toHaveTextContent(/^2 \/ \d+ /);
    expect(screen.getByTestId('projector-paused')).toBeInTheDocument();
    expect(screen.getByTestId('projector-timer')).toHaveAccessibleName(/^80 /);
  });

  it('shows the break countdown and the host message', () => {
    setState('PAUSE_BREAK', { breakEndsAt: new Date(Date.now() + 5 * 60_000).toISOString(), breakMessage: 'Bar is open' });
    renderProjector();
    expect(screen.getByTestId('projector-break-clock')).toHaveTextContent(/^(5:00|4:59)$/);
    expect(screen.getByTestId('projector-break-message')).toHaveTextContent('Bar is open');
  });

  it('names the unit of a numeric question, and shows it with the revealed answer', () => {
    const numeric = { ...QUESTION, type: 'NUMERIC_NEAREST' as const, options: null, unit: 'km' };
    setState('QUESTION_ACTIVE', { currentQuestion: numeric, questionEndsAt: new Date(Date.now() + 20_000).toISOString() });
    const view = renderProjector();
    expect(screen.getByTestId('projector-unit')).toHaveTextContent('km');
    view.unmount();

    setState('QUESTION_REVEAL', { currentQuestion: { ...numeric, correctNumeric: 384 } });
    renderProjector();
    expect(screen.getByTestId('projector-correct-answer')).toHaveTextContent('384 km');
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

  it('asks once for a click to turn on sound, and any click does it', () => {
    setState('LOBBY');
    renderProjector();
    expect(screen.getByTestId('projector-sound-overlay')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByTestId('projector-sound-overlay')).not.toBeInTheDocument();
  });

  it('keeps asking for a click after a key the browser does not count, such as Esc', () => {
    setState('LOBBY');
    Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { hasBeenActive: false } });
    renderProjector();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.getByTestId('projector-sound-overlay')).toBeInTheDocument();
    delete (navigator as { userActivation?: unknown }).userActivation;
  });
});
