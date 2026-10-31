import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AnswerSummaryDto, QuestionPublicDto, QuizSessionStateDto, QuizState } from '@quizicius/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiPost } from '../lib/api-client';
import { downloadCertificate } from '../lib/certificate';
import { I18nProvider } from '../lib/i18n';
import { subscribeToSession } from '../lib/supabase-client';
import { clearQuestionMediaCache } from '../lib/use-current-question-media';
import PlayApp from './PlayApp';

vi.mock('../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));
vi.mock('../lib/certificate', () => ({ downloadCertificate: vi.fn().mockResolvedValue(undefined) }));

const session = vi.hoisted(() => ({
  state: null as QuizSessionStateDto | null,
  mine: [] as AnswerSummaryDto[],
  league: null as { id: string; name: string } | null,
  media: { media: null, revealMedia: null } as { media: unknown; revealMedia: unknown },
}));
vi.mock('../lib/use-session-state', () => ({
  useSessionState: (id: string | undefined) => ({ state: id ? session.state : null, error: null, refetch: vi.fn() }),
}));

const SEAT = { sessionId: 's1', teamId: 'team-1', token: 'team-token' };

function question(overrides: Partial<QuestionPublicDto> = {}): QuestionPublicDto {
  return {
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
    ...overrides,
  };
}

function setState(status: QuizState, overrides: Partial<QuizSessionStateDto> = {}) {
  session.state = {
    id: 's1',
    joinCode: 'A7F3',
    scoresVisible: true,
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
        id: 'team-1',
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
        id: 'team-2',
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
        id: 'team-3',
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
        id: 'team-4',
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

function activeQuestion(q = question()) {
  setState('QUESTION_ACTIVE', { currentQuestion: q, questionEndsAt: new Date(Date.now() + 20_000).toISOString() });
}

function graded(overrides: Partial<AnswerSummaryDto> = {}): AnswerSummaryDto {
  return {
    id: 'answer-1',
    sessionId: 's1',
    questionId: 'q1',
    teamId: 'team-1',
    response: {},
    isCorrect: true,
    confidence: null,
    needsReview: false,
    gradedBy: 'AUTO',
    scoreAwarded: 2,
    disputed: false,
    disputeNote: null,
    ...overrides,
  };
}

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderPlay(path = '/play/s1') {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <Location />
        <Routes>
          <Route path="/play/:sessionId?" element={<PlayApp />} />
          <Route path="/" element={<p>home page</p>} />
          <Route path="/team" element={<p>team page</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

function seated() {
  localStorage.setItem('quizicius:team:s1', JSON.stringify(SEAT));
}

beforeEach(() => {
  localStorage.clear();
  session.state = null;
  session.mine = [];
  session.league = null;
  session.media = { media: null, revealMedia: null };
  clearQuestionMediaCache();
  sessionStorage.clear();
  vi.mocked(apiGet)
    .mockReset()
    .mockImplementation(async (path: string) => {
      if (path.endsWith('/display')) return { title: 'Friday Movie Quiz', league: session.league };
      if (path.endsWith('/answers/mine')) return session.mine;
      if (path.endsWith('/media')) return session.media;
      throw new Error(`unexpected GET ${path}`);
    });
  vi.mocked(apiPost).mockReset();
});

describe('joining', () => {
  it('joins with the four-character code and lands in the lobby', async () => {
    vi.mocked(apiGet).mockImplementation(async (path: string) => {
      if (path === '/sessions/by-code/A7F3') return { id: 's1' };
      return { title: 'Friday Movie Quiz' };
    });
    vi.mocked(apiPost).mockResolvedValue({ teamId: 'team-1', token: 'team-token' });
    setState('LOBBY');
    renderPlay('/play');

    fireEvent.paste(screen.getByTestId('player-pin-0'), { clipboardData: { getData: () => 'a7-f3' } });
    expect(
      ['player-pin-0', 'player-pin-1', 'player-pin-2', 'player-pin-3'].map((id) => (screen.getByTestId(id) as HTMLInputElement).value),
    ).toEqual(['A', '7', 'F', '3']);
    fireEvent.change(screen.getByTestId('player-team-name'), { target: { value: 'Wise Ducks' } });
    fireEvent.submit(screen.getByTestId('player-join-form'));

    expect(await screen.findByTestId('player-lobby')).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith('/sessions/s1/teams/join', { name: 'Wise Ducks', attendanceMode: 'IN_PERSON' });
    expect(JSON.parse(localStorage.getItem('quizicius:team:s1') ?? '{}')).toEqual({ ...SEAT, attendanceMode: 'IN_PERSON' });
    expect(screen.getByTestId('player-team-name-display')).toHaveTextContent('Wise Ducks');
    expect(screen.getByTestId('player-team-count')).toHaveTextContent('4');
    // The session goes into the address, so a phone that reloads the tab finds its seat again.
    expect(screen.getByTestId('location')).toHaveTextContent('/play/s1');
  });

  it('sends the table number when the team gives one', async () => {
    vi.mocked(apiPost).mockResolvedValue({ teamId: 'team-1', token: 'team-token' });
    setState('LOBBY');
    renderPlay();

    fireEvent.change(screen.getByTestId('player-team-name'), { target: { value: 'Wise Ducks' } });
    fireEvent.change(screen.getByTestId('player-table'), { target: { value: ' 7 ' } });
    fireEvent.submit(screen.getByTestId('player-join-form'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/sessions/s1/teams/join', {
        name: 'Wise Ducks',
        attendanceMode: 'IN_PERSON',
        tableNumber: '7',
      }),
    );
  });

  it('joins as a registered team with the team PIN, offered when the name is taken', async () => {
    vi.mocked(apiPost).mockImplementation(async (path: string) => {
      if (path === '/sessions/s1/teams/join') throw new ApiError(409, 'reserved', { code: 'TEAM_NAME_RESERVED' });
      return { teamId: 'team-1', token: 'team-token' };
    });
    setState('LOBBY');
    renderPlay();

    fireEvent.change(screen.getByTestId('player-team-name'), { target: { value: 'Wise Ducks' } });
    fireEvent.submit(screen.getByTestId('player-join-form'));
    fireEvent.change(await screen.findByTestId('player-team-pin'), { target: { value: '48-29 15' } });
    fireEvent.submit(screen.getByTestId('player-join-form'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/team-access/sessions/s1/join', {
        name: 'Wise Ducks',
        attendanceMode: 'IN_PERSON',
        pin: '482915',
      }),
    );
  });

  it('scans the projector QR code with the camera and opens that quiz night', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const detected = ['https://example.com/menu', 'https://quiz.example.sk/play/s9'];
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      detect = async () => [{ rawValue: detected.shift() ?? '' }];
    };
    setState('LOBBY');
    renderPlay('/play');

    fireEvent.click(screen.getAllByRole('tab')[1]);
    fireEvent.click(await screen.findByTestId('player-scan'));

    await waitFor(() => expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument(), { timeout: 2000 });
    expect(screen.queryByTestId('player-pin-0')).not.toBeInTheDocument();
    expect(stop).toHaveBeenCalled();
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  });

  it('explains when the camera is not available for scanning', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    setState('LOBBY');
    renderPlay('/play');

    fireEvent.click(screen.getAllByRole('tab')[1]);
    fireEvent.click(await screen.findByTestId('player-scan'));
    expect(await screen.findByTestId('qr-scanner-failed')).toBeInTheDocument();
  });

  it('skips the code when arriving through a /play/:id link', async () => {
    vi.mocked(apiPost).mockResolvedValue({ teamId: 'team-1', token: 'team-token' });
    setState('LOBBY');
    renderPlay();

    expect(screen.getByTestId('player-direct-link')).toHaveTextContent('#A7F3');
    expect(screen.queryByTestId('player-pin-0')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('player-team-name'), { target: { value: 'Wise Ducks' } });
    fireEvent.submit(screen.getByTestId('player-join-form'));

    expect(await screen.findByTestId('player-lobby')).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining('by-code'));
  });

  it('explains an unknown code and does not try to join', async () => {
    vi.mocked(apiGet).mockRejectedValue(new ApiError(404, 'Session not found'));
    renderPlay('/play');

    fireEvent.paste(screen.getByTestId('player-pin-0'), { clipboardData: { getData: () => 'ZZZZ' } });
    fireEvent.change(screen.getByTestId('player-team-name'), { target: { value: 'Wise Ducks' } });
    fireEvent.submit(screen.getByTestId('player-join-form'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Kvíz s týmto kódom neexistuje');
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('offers team names used before on this device', () => {
    localStorage.setItem('quizicius:recent-teams', JSON.stringify(['Wise Ducks']));
    renderPlay('/play');
    fireEvent.click(screen.getByTestId('player-recent-team'));
    expect(screen.getByTestId('player-team-name')).toHaveValue('Wise Ducks');
  });
});

describe('answering', () => {
  beforeEach(seated);

  it('shows no countdown for an untimed question and stops answering once the host closes it', () => {
    setState('QUESTION_ACTIVE', { currentQuestion: question({ timeLimitSeconds: 0 }), questionEndsAt: null });
    const { unmount } = renderPlay();
    expect(screen.getByTestId('player-untimed')).toBeInTheDocument();
    expect(screen.getByTestId('player-answer-form')).toBeInTheDocument();

    setState('QUESTION_ACTIVE', {
      currentQuestion: question({ timeLimitSeconds: 0 }),
      questionEndsAt: new Date(Date.now() - 1000).toISOString(),
    });
    unmount();
    renderPlay();
    expect(screen.getByTestId('player-expired')).toBeInTheDocument();
    expect(screen.queryByTestId('player-untimed')).not.toBeInTheDocument();
  });

  it('locks in a multiple-choice answer and starts fresh on the next question', async () => {
    vi.mocked(apiPost).mockResolvedValue(graded());
    activeQuestion();
    const { rerender } = renderPlay();

    expect(screen.getByTestId('player-submit-answer')).toBeDisabled();
    fireEvent.click(screen.getByTestId('player-option-b'));
    fireEvent.submit(screen.getByTestId('player-answer-form'));

    expect(await screen.findByTestId('player-locked')).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith('/sessions/s1/answers', { questionId: 'q1', response: { optionId: 'b' } }, 'team-token');
    expect(screen.getByTestId('player-locked-answer')).toHaveTextContent('Forrest Gump');

    activeQuestion(question({ id: 'q2', prompt: 'Second question' }));
    rerender(
      <I18nProvider>
        <MemoryRouter initialEntries={['/play/s1']}>
          <Routes>
            <Route path="/play/:sessionId?" element={<PlayApp />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(screen.getByTestId('player-question')).toBeInTheDocument();
    expect(screen.getByTestId('player-prompt')).toHaveTextContent('Second question');
    expect(screen.getByTestId('player-submit-answer')).toBeDisabled();
  });

  it('keeps the question answerable when sending fails', async () => {
    vi.mocked(apiPost).mockRejectedValue(new Error('Network down'));
    activeQuestion();
    renderPlay();

    fireEvent.click(screen.getByTestId('player-option-a'));
    fireEvent.submit(screen.getByTestId('player-answer-form'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    expect(screen.getByTestId('player-submit-answer')).toBeEnabled();
  });

  it('sends free-text and numeric answers in the API shape', async () => {
    vi.mocked(apiPost).mockResolvedValue(graded());
    activeQuestion(question({ type: 'FREE_TEXT', options: null }));
    const { unmount } = renderPlay();
    fireEvent.change(screen.getByTestId('player-text-answer'), { target: { value: '  forrest gump ' } });
    fireEvent.submit(screen.getByTestId('player-answer-form'));
    await screen.findByTestId('player-locked');
    expect(apiPost).toHaveBeenLastCalledWith(
      '/sessions/s1/answers',
      { questionId: 'q1', response: { text: 'forrest gump' } },
      'team-token',
    );
    unmount();

    localStorage.removeItem('quizicius:answers:s1');
    activeQuestion(question({ id: 'q9', type: 'NUMERIC_NEAREST', options: null }));
    renderPlay();
    fireEvent.change(screen.getByTestId('player-numeric-answer'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: '+1' }));
    fireEvent.submit(screen.getByTestId('player-answer-form'));
    await screen.findByTestId('player-locked');
    expect(apiPost).toHaveBeenLastCalledWith('/sessions/s1/answers', { questionId: 'q9', response: { value: 6 } }, 'team-token');
  });

  it('shows how many teams answered, and that the host paused the timer', () => {
    setState('QUESTION_ACTIVE', {
      currentQuestion: question(),
      questionEndsAt: new Date(Date.now() - 5_000).toISOString(),
      questionPausedAt: new Date(Date.now() - 20_000).toISOString(),
      answeredCount: 1,
      playedQuestionIds: [],
    });
    renderPlay();
    expect(screen.getByTestId('player-paused')).toBeInTheDocument();
    expect(screen.getByTestId('player-answered')).toHaveTextContent(/^1 \/ \d+ /);
    // Paused with time left: still answerable although the deadline has passed.
    expect(screen.getByTestId('player-answer-form')).toBeInTheDocument();
  });

  it('shows the unit next to a numeric answer', () => {
    setState('QUESTION_ACTIVE', {
      currentQuestion: question({ type: 'NUMERIC_NEAREST', options: null, unit: 'km' }),
      questionEndsAt: new Date(Date.now() + 20_000).toISOString(),
    });
    renderPlay();
    expect(screen.getByTestId('player-numeric-unit')).toHaveTextContent('km');
  });

  it('stops accepting answers when the time is up', () => {
    setState('QUESTION_ACTIVE', { currentQuestion: question(), questionEndsAt: new Date(Date.now() - 1000).toISOString() });
    renderPlay();
    expect(screen.getByTestId('player-expired')).toBeInTheDocument();
    expect(screen.queryByTestId('player-answer-form')).not.toBeInTheDocument();
  });

  it('shows the team standing under the question', () => {
    activeQuestion();
    renderPlay();
    const standing = screen.getByTestId('player-standing');
    expect(standing).toHaveTextContent('#2');
    expect(standing).toHaveTextContent('Wise Ducks');
    expect(standing).toHaveTextContent('3 b');
  });

  it('keeps the answer form but hides unpublished standings', () => {
    activeQuestion();
    session.state = { ...session.state!, scoresVisible: false };
    renderPlay();
    expect(screen.getByTestId('player-answer-form')).toBeInTheDocument();
    expect(screen.queryByTestId('player-standing')).not.toBeInTheDocument();
  });

  it('asks for fullscreen and tells the host the team is ready', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreen;
    vi.mocked(apiPost).mockResolvedValue({ ready: true });
    setState('LOCK_IN_ROUND');
    renderPlay();
    requestFullscreen.mockClear();

    fireEvent.click(screen.getByTestId('player-ready'));
    expect(requestFullscreen).toHaveBeenCalled();
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/teams/me/ready', { fullscreen: true }, 'team-token'));
  });

  it('still reports ready when the browser has no fullscreen (iPhone)', async () => {
    // @ts-expect-error simulating a browser without the fullscreen API
    document.documentElement.requestFullscreen = undefined;
    vi.mocked(apiPost).mockResolvedValue({ ready: true });
    setState('LOCK_IN_ROUND');
    renderPlay();

    fireEvent.click(screen.getByTestId('player-ready'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/teams/me/ready', { fullscreen: false }, 'team-token'));
  });

  it('shows the team as ready from the server state', () => {
    setState('LOCK_IN_ROUND');
    session.state!.teams = session.state!.teams.map((team) => (team.id === 'team-1' ? { ...team, ready: true } : team));
    renderPlay();
    expect(screen.getByTestId('player-ready')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('question media on phones', () => {
  beforeEach(seated);
  const resolved = (kind: string, url: string) => ({ kind, url, startSeconds: null, durationSeconds: null });

  it('shows a question image', async () => {
    session.media = { media: resolved('image', 'https://cdn.test/q1.png'), revealMedia: null };
    activeQuestion();
    renderPlay();

    expect(await screen.findByTestId('player-question-image')).toHaveAttribute('src', 'https://cdn.test/q1.png');
  });

  it.each([
    ['audio', 'Počúvajte projektor'],
    ['video', 'Sledujte projektor'],
    ['youtube', 'Sledujte projektor'],
  ])('points to the projector for a %s clip and plays nothing on the phone', async (kind, text) => {
    session.media = { media: resolved(kind, 'https://cdn.test/clip'), revealMedia: null };
    activeQuestion();
    const { container } = renderPlay();

    expect(await screen.findByTestId('projector-media-card')).toHaveTextContent(text);
    expect(container.querySelector('audio, video, iframe')).toBeNull();
  });

  it('shows the reveal image at the reveal', async () => {
    session.media = { media: null, revealMedia: resolved('image', 'https://cdn.test/answer.png') };
    setState('QUESTION_REVEAL', { currentQuestion: question({ correctOptionId: 'b' }) });
    renderPlay();

    expect(await screen.findByTestId('player-reveal-image')).toHaveAttribute('src', 'https://cdn.test/answer.png');
  });
});

describe('reveal and results', () => {
  beforeEach(seated);

  it('celebrates a correct answer with the points the server awarded', async () => {
    localStorage.setItem('quizicius:answers:s1', JSON.stringify({ q1: { display: 'Forrest Gump', letter: 'B', submittedAt: Date.now() } }));
    session.mine = [graded()];
    setState('QUESTION_REVEAL', { currentQuestion: question({ correctOptionId: 'b' }) });
    renderPlay();

    expect(await screen.findByTestId('player-awarded')).toHaveTextContent('+2');
    expect(screen.getByTestId('player-verdict')).toHaveAttribute('data-verdict', 'correct');
    expect(screen.getByTestId('player-correct-answer')).toHaveTextContent('Forrest Gump');
    expect(apiGet).toHaveBeenCalledWith('/sessions/s1/answers/mine', 'team-token');
  });

  it('shows the verdict but not the points while the host keeps scores hidden', async () => {
    localStorage.setItem('quizicius:answers:s1', JSON.stringify({ q1: { display: 'Forrest Gump', letter: 'B', submittedAt: Date.now() } }));
    session.mine = [graded()];
    setState('QUESTION_REVEAL', { currentQuestion: question({ correctOptionId: 'b' }), scoresVisible: false });
    renderPlay();

    await waitFor(() => expect(screen.getByTestId('player-verdict')).toHaveAttribute('data-verdict', 'correct'));
    expect(screen.queryByTestId('player-awarded')).not.toBeInTheDocument();
    expect(screen.queryByTestId('player-total-score')).not.toBeInTheDocument();
  });

  it("updates the verdict when the host corrects the team's grade", async () => {
    localStorage.setItem('quizicius:answers:s1', JSON.stringify({ q1: { display: 'Forrest Gump', letter: 'B', submittedAt: Date.now() } }));
    session.mine = [graded({ isCorrect: false, scoreAwarded: 0 })];
    setState('QUESTION_REVEAL', { currentQuestion: question({ correctOptionId: 'a' }) });
    renderPlay();
    await waitFor(() => expect(screen.getByTestId('player-verdict')).toHaveAttribute('data-verdict', 'wrong'));

    session.mine = [graded({ isCorrect: true, scoreAwarded: 2, gradedBy: 'HOST' })];
    const scoreListeners = vi
      .mocked(subscribeToSession)
      .mock.calls.filter(([, , events]) => events?.includes('SCORE_UPDATE') && !events.includes('STATE_CHANGE'));
    act(() => scoreListeners.forEach(([, onEvent]) => onEvent('SCORE_UPDATE', {})));

    await waitFor(() => expect(screen.getByTestId('player-verdict')).toHaveAttribute('data-verdict', 'correct'));
    expect(screen.getByTestId('player-awarded')).toHaveTextContent('+2');
  });

  it('shows a numeric answer graded at reveal as correct', async () => {
    localStorage.setItem('quizicius:answers:s1', JSON.stringify({ q1: { display: '1994', letter: null, submittedAt: Date.now() } }));
    session.mine = [graded({ response: { value: 1994 }, isCorrect: true, scoreAwarded: 2 })];
    setState('QUESTION_REVEAL', { currentQuestion: question({ type: 'NUMERIC_NEAREST', options: null, correctNumeric: 1994 }) });
    renderPlay();

    expect(await screen.findByTestId('player-awarded')).toHaveTextContent('+2');
    expect(screen.getByTestId('player-verdict')).toHaveAttribute('data-verdict', 'correct');
  });

  it('says "grading" rather than "wrong" while the grade is not available', () => {
    localStorage.setItem('quizicius:answers:s1', JSON.stringify({ q1: { display: '1994', letter: null, submittedAt: Date.now() } }));
    vi.mocked(apiGet).mockImplementation(() => new Promise(() => {}));
    setState('QUESTION_REVEAL', { currentQuestion: question({ correctOptionId: 'b' }) });
    renderPlay();
    expect(screen.getByTestId('player-verdict')).toHaveAttribute('data-verdict', 'grading');
  });

  it('does not claim success for a team that did not answer', async () => {
    setState('QUESTION_REVEAL', { currentQuestion: question({ correctOptionId: 'b' }) });
    renderPlay();
    await act(async () => {});
    expect(screen.getByTestId('player-verdict')).toHaveAttribute('data-verdict', 'none');
    expect(screen.queryByTestId('player-awarded')).not.toBeInTheDocument();
  });

  it('lets a team dispute a wrong answer once, with a note for the host', async () => {
    session.mine = [graded({ isCorrect: false, scoreAwarded: 0 })];
    vi.mocked(apiPost).mockResolvedValue({});
    setState('QUESTION_REVEAL', { currentQuestion: question({ correctOptionId: 'b' }) });
    renderPlay();

    fireEvent.click(await screen.findByTestId('player-dispute-button'));
    fireEvent.change(screen.getByTestId('player-dispute-note'), { target: { value: 'Both won' } });
    fireEvent.click(screen.getByTestId('player-dispute-button'));

    expect(await screen.findByTestId('player-dispute-sent')).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith('/sessions/s1/answers/answer-1/dispute', { note: 'Both won' }, 'team-token');
  });

  it('offers no dispute for a correct answer, and says when one is already sent', async () => {
    session.mine = [graded()];
    setState('QUESTION_REVEAL', { currentQuestion: question({ correctOptionId: 'b' }) });
    const { unmount } = renderPlay();
    await screen.findByTestId('player-awarded');
    expect(screen.queryByTestId('player-dispute')).not.toBeInTheDocument();
    unmount();

    session.mine = [graded({ isCorrect: false, scoreAwarded: 0, needsReview: true, disputed: true })];
    renderPlay();
    expect(await screen.findByTestId('player-dispute-sent')).toBeInTheDocument();
  });

  it('flags free-text answers waiting for host review', async () => {
    session.mine = [graded({ response: { text: 'forest gamp' }, isCorrect: null, needsReview: true, scoreAwarded: 0 })];
    setState('QUESTION_REVEAL', { currentQuestion: question({ type: 'FREE_TEXT', options: null, acceptedAnswers: ['Forrest Gump'] }) });
    renderPlay();
    await act(async () => {});
    expect(screen.getByTestId('player-verdict')).toHaveAttribute('data-verdict', 'review');
    expect(screen.getByText('forest gamp')).toBeInTheDocument();
  });

  it('shows the final rank, the full table on demand and leads back home', async () => {
    setState('FINISHED');
    renderPlay();

    expect(screen.getByTestId('player-final-rank')).toHaveTextContent('2.');
    expect(screen.getByTestId('player-final-score')).toHaveTextContent('6');
    const standings = screen.getByText('Poradie všetkých tímov').closest('section') as HTMLElement;
    expect(within(standings).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(within(standings).getByRole('button', { name: /Zobraziť celú tabuľku/ }));
    expect(within(standings).getAllByRole('listitem')).toHaveLength(4);

    await act(async () => fireEvent.click(screen.getByTestId('player-exit')));
    expect(screen.getByText('home page')).toBeInTheDocument();
  });

  it("downloads the team's certificate with its place, score and the night", async () => {
    setState('FINISHED');
    renderPlay();

    await act(async () => fireEvent.click(screen.getByTestId('player-certificate')));

    expect(downloadCertificate).toHaveBeenCalledWith(
      expect.objectContaining({
        teamName: 'Wise Ducks',
        placeLine: '2. miesto z 4',
        scoreLine: '6 bodov',
        fileName: 'quizicius-wise-ducks.pdf',
      }),
    );
  });
});

describe('league nights', () => {
  it('offers an unregistered team to register while the quiz has not started', async () => {
    seated();
    session.league = { id: 'l1', name: 'Zimná liga' };
    setState('LOBBY');
    renderPlay();

    const banner = await screen.findByTestId('play-league-banner');
    expect(banner).toHaveTextContent('Zimná liga');
    fireEvent.click(within(banner).getByTestId('play-league-register'));

    expect(await screen.findByText('team page')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('quizicius:pending-claim')!)).toEqual({ ...SEAT, teamName: 'Wise Ducks' });
  });

  it('lets the team play without registering', async () => {
    seated();
    session.league = { id: 'l1', name: 'Zimná liga' };
    setState('LOBBY');
    renderPlay();

    fireEvent.click(await screen.findByTestId('play-league-skip'));

    expect(screen.queryByTestId('play-league-banner')).not.toBeInTheDocument();
  });

  it('says nothing about the league to a registered team or on an ordinary night', async () => {
    seated();
    setState('LOBBY');
    renderPlay();
    await screen.findByTestId('player-lobby');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/sessions/s1/display'));
    expect(screen.queryByTestId('play-league-banner')).not.toBeInTheDocument();
  });

  it('stops offering registration once the first question has started', async () => {
    seated();
    session.league = { id: 'l1', name: 'Zimná liga' };
    setState('LOCK_IN_ROUND', { currentQuestion: question() });
    renderPlay();

    await screen.findByTestId('player-lock-in');
    expect(screen.queryByTestId('play-league-banner')).not.toBeInTheDocument();
  });
});
