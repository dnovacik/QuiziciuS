import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HostLeagueDto, AnswerSummaryDto, QuizSessionStateDto, QuizState, ScheduledNightDto } from '@quizicius/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../lib/api-client';
import type { Pub } from '../lib/pubs';
import { I18nProvider } from '../lib/i18n';
import type { HostSession, Question, Quiz } from './api';
import { ControlRoomPage } from './control-room/ControlRoomPage';
import { DashboardPage } from './DashboardPage';
import { QuizEditorPage } from './editor/QuizEditorPage';
import { PubsPage } from './pubs';
import { SessionsPage } from './SessionsPage';
import { SettingsPage } from './SettingsPage';
import { RemotePage } from './control-room/RemotePage';
import { ToastProvider } from './ui';

vi.mock('../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  apiPut: vi.fn(),
}));
vi.mock('../lib/supabase-client', () => ({ supabase: { auth: { signOut: vi.fn() } }, subscribeToSession: vi.fn(() => vi.fn()) }));

const mediaStatus = vi.hoisted(() => ({ send: null as null | ((message: { questionId: string; slot: string; state: string }) => void) }));
vi.mock('../lib/media-channel', () => ({
  subscribeToMediaStatus: vi.fn((_sessionId: string, onStatus: typeof mediaStatus.send) => {
    mediaStatus.send = onStatus;
    return vi.fn();
  }),
}));

const pubs = vi.hoisted(() => ({ mine: [] as Pub[], all: [] as Pub[] }));
const live = vi.hoisted(() => ({ state: null as QuizSessionStateDto | null, refetch: vi.fn() }));
vi.mock('../lib/use-session-state', () => ({
  useSessionState: () => ({ state: live.state, error: null, refetch: live.refetch }),
}));

const LION: Pub = { id: 'pub1', name: 'U Zlatého leva', city: 'Žilina', address: null };
const DOG: Pub = { id: 'pub2', name: 'Black Dog', city: 'Bratislava', address: null };
const QUIZ: Quiz = {
  id: 'quiz1',
  title: 'Friday Movies',
  category_id: 'cat1',
  pub_id: 'pub1',
  default_time_limit_seconds: 30,
  created_at: '2026-10-01T18:00:00Z',
};
const EMPTY_QUIZ: Quiz = {
  id: 'quiz2',
  title: 'History draft',
  category_id: null,
  pub_id: null,
  default_time_limit_seconds: 30,
  created_at: '2026-09-01T18:00:00Z',
};

function question(id: string, order: number, overrides: Partial<Question> = {}): Question {
  return {
    id,
    quiz_id: 'quiz1',
    type: 'MULTIPLE_CHOICE',
    prompt: `Question ${id}`,
    media: null,
    reveal_media: null,
    options: [
      { id: 'a', label: 'Pulp Fiction', isCorrect: false },
      { id: 'b', label: 'Forrest Gump', isCorrect: true },
    ],
    accepted_answers: null,
    correct_numeric: null,
    unit: null,
    points: 10,
    time_limit_seconds: 30,
    order_index: order,
    ...overrides,
  };
}

const db = vi.hoisted(() => ({
  quizzes: [] as Quiz[],
  questions: {} as Record<string, Question[]>,
  sessions: [] as HostSession[],
  answers: [] as AnswerSummaryDto[],
  disputes: [] as AnswerSummaryDto[],
  leagues: [] as HostLeagueDto[],
  schedule: [] as ScheduledNightDto[],
  display: { title: 'Friday Movies', pub: null, league: null } as { title: string; pub: null; league: { id: string; name: string } | null },
}));

function session(id: string, status: QuizState, quizId = 'quiz1'): HostSession {
  return {
    id,
    quiz_id: quizId,
    join_code: 'A7F3',
    status,
    pub_id: null,
    created_at: '2026-10-20T18:00:00Z',
    started_at: null,
    finished_at: null,
  };
}

function liveState(status: QuizState, currentId: string | null = null): QuizSessionStateDto {
  const current = currentId ? db.questions.quiz1.find((row) => row.id === currentId)! : null;
  return {
    id: 's1',
    joinCode: 'A7F3',
    status,
    currentQuestion: current && {
      id: current.id,
      type: current.type,
      prompt: current.prompt,
      options: current.options?.map(({ id, label }) => ({ id, label })) ?? null,
      points: current.points,
      timeLimitSeconds: current.time_limit_seconds,
      orderIndex: current.order_index,
      correctOptionId: null,
      correctNumeric: null,
      acceptedAnswers: null,
      unit: null,
    },
    questionEndsAt: status === 'QUESTION_ACTIVE' ? new Date(Date.now() + 20_000).toISOString() : null,
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
        score: 20,
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
        score: 10,
        infractionCount: 1,
      },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
  db.quizzes = [QUIZ, EMPTY_QUIZ];
  db.questions = { quiz1: [question('q1', 0), question('q2', 1), question('q3', 2)], quiz2: [] };
  db.sessions = [session('s1', 'LOBBY'), session('s0', 'FINISHED')];
  db.answers = [];
  pubs.mine = [LION];
  pubs.all = [LION, DOG];
  db.disputes = [];
  db.leagues = [];
  db.schedule = [];
  db.display = { title: 'Friday Movies', pub: null, league: null };
  live.state = null;
  live.refetch = vi.fn();
  vi.mocked(apiGet)
    .mockReset()
    .mockImplementation(async (path: string) => {
      if (path === '/quizzes') return db.quizzes;
      if (path === '/categories') return [{ id: 'cat1', name: 'Movies' }];
      if (path === '/host/pubs') return pubs.mine;
      if (path.startsWith('/pubs')) return pubs.all;
      if (path === '/host/sessions') return db.sessions;
      if (path === '/host/sessions/s1') return db.sessions[0];
      if (path.startsWith('/host/sessions/s1/answers')) return db.answers;
      if (path === '/sessions/s1/disputes') return db.disputes;
      if (path === '/sessions/s1/infractions') return [];
      if (path === '/sessions/s1/state') return live.state;
      if (path === '/sessions/s1/display') return db.display;
      if (path === '/leagues') return db.leagues;
      if (path === '/host/schedule') return db.schedule;
      const questions = path.match(/^\/quizzes\/(\w+)\/questions$/);
      if (questions) return db.questions[questions[1]] ?? [];
      throw new Error(`unexpected GET ${path}`);
    });
  vi.mocked(apiPost)
    .mockReset()
    .mockImplementation(async (path: string, body: unknown) => {
      if (path === '/quizzes') return { ...QUIZ, id: 'copy1', title: (body as { title: string }).title };
      if (path.endsWith('/questions')) return { ...question('new1', 9), ...(body as object), id: 'new1' };
      if (path === '/quizzes/quiz1/sessions') return session('s9', 'LOBBY');
      return {};
    });
  vi.mocked(apiPatch)
    .mockReset()
    .mockImplementation(async (path: string, body: unknown) => {
      const match = path.match(/\/questions\/(\w+)$/);
      if (match) {
        const payload = body as { prompt: string; orderIndex: number; points: number };
        return {
          ...db.questions.quiz1.find((row) => row.id === match[1])!,
          prompt: payload.prompt,
          order_index: payload.orderIndex,
          points: payload.points,
        };
      }
      return { ...QUIZ, ...(body as object) };
    });
  vi.mocked(apiDelete).mockReset().mockResolvedValue(undefined);
  vi.mocked(apiPut)
    .mockReset()
    .mockImplementation(async (path: string) => pubs.all.find((pub) => path.endsWith(pub.id)));
});

function renderAt(path: string, element: React.ReactNode, routePath: string) {
  const tree = () => (
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
            <Route path="/host/sessions/:sessionId" element={<p>control room for session</p>} />
            <Route path="/host/quizzes/:quizId" element={<p>editor opened</p>} />
            <Route path="/host/sessions" element={<p>sessions list</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>
  );
  const view = render(tree());
  /** Renders again, e.g. after the live state changed. */
  return { ...view, refresh: () => view.rerender(tree()) };
}

describe('host dashboard', () => {
  it('plans a quiz night ahead and lists the planned ones', async () => {
    db.schedule = [
      {
        id: 'n1',
        startsAt: '2026-10-31T19:00:00Z',
        pub: { id: 'pub1', name: 'U Zlatého leva', city: 'Žilina' },
        quizId: 'quiz1',
        quizTitle: 'Friday Movies',
        note: 'Halloween',
      },
    ];
    vi.mocked(apiPost).mockResolvedValue({});
    renderAt('/host', <DashboardPage token="jwt" />, '/host');

    expect(await screen.findByTestId('schedule-n1')).toHaveTextContent('Friday Movies');
    expect(screen.getByTestId('schedule-n1')).toHaveTextContent('Halloween');
    fireEvent.click(screen.getByTestId('schedule-add'));
    fireEvent.change(screen.getByTestId('schedule-starts'), { target: { value: '2026-11-07T20:00' } });
    await waitFor(() => expect(screen.getByTestId('schedule-pub')).toHaveValue('pub1'));
    fireEvent.change(screen.getByTestId('schedule-note'), { target: { value: 'Music quiz' } });
    fireEvent.click(screen.getByTestId('schedule-save'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        '/host/schedule',
        { startsAt: new Date('2026-11-07T20:00').toISOString(), pubId: 'pub1', quizId: null, note: 'Music quiz' },
        'jwt',
      ),
    );
    fireEvent.click(screen.getByTestId('schedule-delete-n1'));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/host/schedule/n1', 'jwt'));
  });

  it('shows real stats, the live session and the quiz library', async () => {
    renderAt('/host', <DashboardPage token="jwt" />, '/host');

    await waitFor(() => expect(screen.getByTestId('stat-quizzes-value')).toHaveTextContent('2'));
    expect(screen.getByTestId('stat-live-value')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-hosted-value')).toHaveTextContent('1');
    expect(await screen.findByTestId('live-session-s1')).toHaveTextContent('Friday Movies');
    expect(await screen.findByTestId('quiz-question-count-quiz1')).toHaveTextContent('3');
    expect(screen.getByTestId('quiz-card-quiz2')).toHaveTextContent('Koncept');
  });

  it('filters the library by search text', async () => {
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    await screen.findByTestId('quiz-card-quiz1');
    fireEvent.change(screen.getByTestId('quiz-search'), { target: { value: 'history' } });
    expect(screen.queryByTestId('quiz-card-quiz1')).not.toBeInTheDocument();
    expect(screen.getByTestId('quiz-card-quiz2')).toBeInTheDocument();
  });

  it('starts a session and opens the control room', async () => {
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    fireEvent.click(await screen.findByTestId('quiz-start-quiz1'));
    fireEvent.click(screen.getByTestId('start-session-confirm'));

    await screen.findByText('control room for session');
    expect(apiPost).toHaveBeenCalledWith('/quizzes/quiz1/sessions', { pubId: 'pub1' }, 'jwt');
  });

  it("launches at the quiz's pub unless the host picks another", async () => {
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    fireEvent.click(await screen.findByTestId('quiz-start-quiz1'));
    const select = screen.getByTestId('start-session-pub');
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    expect(select).toHaveValue('pub1');
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('start-session-confirm'));

    await screen.findByText('control room for session');
    expect(apiPost).toHaveBeenCalledWith('/quizzes/quiz1/sessions', { pubId: null }, 'jwt');
  });

  it('ticks the night for a league running at the chosen pub', async () => {
    db.leagues = [
      {
        id: 'l1',
        name: 'Zimná liga',
        kind: 'LEAGUE',
        phase: 'RUNNING',
        startsOn: '2026-10-01',
        endsOn: null,
        message: null,
        ownerHostId: 'me',
        ownerName: 'Me',
        pubs: [{ id: 'pub1', name: 'Red Lion', city: 'Bratislava', hostId: 'me' }],
        nightsPlayed: 3,
        joinedTeams: 8,
        parentLeagueId: null,
        myStatus: 'ACCEPTED',
        isOwner: true,
      },
    ];
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    fireEvent.click(await screen.findByTestId('quiz-start-quiz1'));

    fireEvent.click(await screen.findByTestId('start-session-league-toggle'));
    expect(screen.getByTestId('start-session-league')).toHaveValue('l1');
    fireEvent.click(screen.getByTestId('start-session-confirm'));

    await screen.findByText('control room for session');
    expect(apiPost).toHaveBeenCalledWith('/quizzes/quiz1/sessions', { pubId: 'pub1', leagueId: 'l1' }, 'jwt');
  });

  it('offers no league when the night is at a pub outside every league', async () => {
    db.leagues = [];
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    fireEvent.click(await screen.findByTestId('quiz-start-quiz1'));
    await screen.findByTestId('start-session-pub');

    expect(screen.queryByTestId('start-session-league-toggle')).not.toBeInTheDocument();
  });

  it('deletes a quiz after confirmation', async () => {
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    fireEvent.click(await screen.findByTestId('quiz-delete-quiz2'));
    expect(screen.getByTestId('delete-quiz-dialog')).toHaveTextContent('History draft');
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/quizzes/quiz2', 'jwt'));
  });

  it('duplicates a quiz with its questions, keeping linked clips but not uploaded files', async () => {
    db.questions.quiz1[0].media = { kind: 'image', source: 'upload', path: 'host/quiz1/pic.jpg' };
    db.questions.quiz1[0].reveal_media = { kind: 'youtube', source: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    fireEvent.click(await screen.findByTestId('quiz-duplicate-quiz1'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(vi.mocked(apiPost).mock.calls.filter(([path]) => path === '/quizzes/copy1/questions')).toHaveLength(3));
    expect(apiPost).toHaveBeenCalledWith('/quizzes', { title: 'Friday Movies (kópia)', categoryId: 'cat1', pubId: 'pub1' }, 'jwt');
    const firstCopy = vi.mocked(apiPost).mock.calls.find(([path]) => path === '/quizzes/copy1/questions')![1];
    expect(firstCopy).toMatchObject({
      prompt: 'Question q1',
      media: null,
      revealMedia: { kind: 'youtube', source: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      orderIndex: 0,
    });
  });
});

describe('quiz editor', () => {
  const renderEditor = () => renderAt('/host/quizzes/quiz1', <QuizEditorPage token="jwt" />, '/host/quizzes/:quizId');

  it('saves a question without a time limit (0 s)', async () => {
    renderEditor();
    await screen.findByTestId('editor-prompt');
    fireEvent.change(screen.getByTestId('editor-timer'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/quizzes/quiz1/questions/q1', expect.objectContaining({ timeLimitSeconds: 0 }), 'jwt'),
    );
  });

  it('splits accepted answers written as a list into separate variants', async () => {
    db.questions.quiz1[0] = question('q1', 0, { type: 'FREE_TEXT', options: null, accepted_answers: ['Missouri, Misouri'] });
    renderEditor();

    fireEvent.click(await screen.findByTestId('editor-accepted-split-0'));
    expect(screen.getByTestId('editor-accepted-0')).toHaveValue('Missouri');
    expect(screen.getByTestId('editor-accepted-1')).toHaveValue('Misouri');
    expect(screen.queryByTestId('editor-accepted-listed-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith(
        '/quizzes/quiz1/questions/q1',
        expect.objectContaining({ acceptedAnswers: ['Missouri', 'Misouri'] }),
        'jwt',
      ),
    );
  });

  it('edits and saves the selected question with the full payload', async () => {
    renderEditor();
    const prompt = await screen.findByTestId('editor-prompt');
    expect(prompt).toHaveValue('Question q1');
    fireEvent.change(prompt, { target: { value: 'Which 1994 film won Best Picture?' } });
    expect(screen.getByTestId('editor-dirty')).toBeInTheDocument();
    expect(screen.getByTestId('preview-prompt')).toHaveTextContent('Which 1994 film won Best Picture?');
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith(
        '/quizzes/quiz1/questions/q1',
        expect.objectContaining({
          type: 'MULTIPLE_CHOICE',
          prompt: 'Which 1994 film won Best Picture?',
          orderIndex: 0,
          points: 10,
          timeLimitSeconds: 30,
        }),
        'jwt',
      ),
    );
    await waitFor(() => expect(screen.queryByTestId('editor-dirty')).not.toBeInTheDocument());
  });

  it('saves a reveal clip separately from the question media', async () => {
    db.questions.quiz1[0].media = { kind: 'audio', source: 'link', url: 'https://cdn.example/intro.mp3', startSeconds: 80 };
    renderEditor();
    await screen.findByTestId('editor-prompt');
    fireEvent.click(screen.getByTestId('media-slot-reveal-link'));
    fireEvent.change(screen.getByTestId('media-slot-reveal-link-input'), { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByTestId('media-slot-reveal-link-add'));
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith(
        '/quizzes/quiz1/questions/q1',
        expect.objectContaining({
          media: { kind: 'audio', source: 'link', url: 'https://cdn.example/intro.mp3', startSeconds: 80 },
          revealMedia: { kind: 'youtube', source: 'link', url: 'https://youtu.be/dQw4w9WgXcQ' },
        }),
        'jwt',
      ),
    );
  });

  it('blocks saving an invalid new question and lists what is missing', async () => {
    renderEditor();
    await screen.findByTestId('editor-prompt');
    fireEvent.click(screen.getByTestId('editor-add-question'));
    expect(screen.getByTestId('editor-prompt')).toHaveValue('');
    fireEvent.click(screen.getByTestId('editor-save'));

    expect(await screen.findByTestId('host-error')).toHaveTextContent('validáciu');
    expect(screen.getByTestId('editor-validation')).toHaveTextContent('Chýba znenie otázky');
    expect(apiPost).not.toHaveBeenCalledWith('/quizzes/quiz1/questions', expect.anything(), 'jwt');
  });

  it('asks before throwing away unsaved changes when switching questions', async () => {
    renderEditor();
    fireEvent.change(await screen.findByTestId('editor-prompt'), { target: { value: 'changed' } });
    fireEvent.click(screen.getByTestId('editor-question-q2'));
    expect(screen.getByTestId('editor-leave-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    expect(screen.getByTestId('editor-prompt')).toHaveValue('Question q2');
  });

  it('deletes a question and renumbers the rest', async () => {
    renderEditor();
    await screen.findByTestId('editor-prompt');
    fireEvent.click(screen.getByTestId('editor-delete'));
    fireEvent.click(within(screen.getByTestId('editor-delete-dialog')).getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/quizzes/quiz1/questions/q1', 'jwt'));
    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/quizzes/quiz1/questions/q2', expect.objectContaining({ orderIndex: 0 }), 'jwt'),
    );
    expect(apiPatch).toHaveBeenCalledWith('/quizzes/quiz1/questions/q3', expect.objectContaining({ orderIndex: 1 }), 'jwt');
  });

  it('renames the quiz from the settings dialog', async () => {
    renderEditor();
    await screen.findByTestId('editor-prompt');
    fireEvent.click(screen.getByTestId('editor-settings'));
    fireEvent.change(screen.getByTestId('settings-title'), { target: { value: 'Saturday Movies' } });
    fireEvent.change(screen.getByTestId('settings-category'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('settings-pub'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('settings-timer'), { target: { value: '45' } });
    fireEvent.click(screen.getByTestId('settings-save'));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith(
        '/quizzes/quiz1',
        { title: 'Saturday Movies', categoryId: null, pubId: null, defaultTimeLimitSeconds: 45 },
        'jwt',
      ),
    );
  });

  it("starts new questions with the quiz's default answer time", async () => {
    db.quizzes = [{ ...QUIZ, default_time_limit_seconds: 60 }, EMPTY_QUIZ];
    renderEditor();
    await screen.findByTestId('editor-prompt');
    fireEvent.click(screen.getByTestId('editor-add-question'));

    await waitFor(() => expect(screen.getByTestId('editor-timer')).toHaveValue('60'));
  });

  it('saves the unit of a numeric question', async () => {
    db.questions.quiz1[0] = question('q1', 0, { type: 'NUMERIC_NEAREST', options: null, correct_numeric: 384 });
    renderEditor();
    fireEvent.change(await screen.findByTestId('editor-unit'), { target: { value: ' km ' } });
    fireEvent.click(screen.getByTestId('editor-save'));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith(
        '/quizzes/quiz1/questions/q1',
        expect.objectContaining({ correctNumeric: 384, unit: 'km' }),
        'jwt',
      ),
    );
  });
});

describe('control room', () => {
  const renderRoom = () => renderAt('/host/sessions/s1', <ControlRoomPage token="jwt" />, '/host/sessions/:sessionId');

  it('marks unregistered teams in the lobby of a league night', async () => {
    db.display = { title: 'Friday Movies', pub: null, league: { id: 'l1', name: 'Zimná liga' } };
    const base = liveState('LOBBY');
    live.state = { ...base, teams: [...base.teams, { ...base.teams[0], id: 't3', name: 'Tim bez pala', registeredTeamId: 'rt1' }] };
    renderRoom();

    expect(await screen.findByTestId('lobby-unregistered-count')).toHaveTextContent('2 tímy');
    expect(screen.getByTestId('unregistered-t1')).toBeInTheDocument();
    expect(screen.queryByTestId('unregistered-t3')).not.toBeInTheDocument();
  });

  it('shows the table a team sits at', async () => {
    const base = liveState('LOBBY');
    live.state = { ...base, teams: [{ ...base.teams[0], tableNumber: '12' }, base.teams[1]] };
    renderRoom();

    expect(await screen.findByTestId('room-team-table-t1')).toHaveTextContent('12');
    expect(screen.queryByTestId('room-team-table-t2')).not.toBeInTheDocument();
  });

  it('shows no league markers on an ordinary night', async () => {
    live.state = liveState('LOBBY');
    renderRoom();

    await screen.findByTestId('room-lobby');
    expect(screen.queryByTestId('lobby-unregistered-count')).not.toBeInTheDocument();
    expect(screen.queryByTestId('unregistered-t1')).not.toBeInTheDocument();
  });

  describe('clips', () => {
    const SONG = {
      kind: 'audio' as const,
      source: 'link' as const,
      url: 'https://cdn.example/song.mp3',
      startSeconds: 80,
      durationSeconds: 15,
    };
    const FULL = { kind: 'youtube' as const, source: 'link' as const, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };

    it('shows the clip and its part, and plays it on the projector', async () => {
      db.questions.quiz1[0].media = SONG;
      live.state = liveState('QUESTION_ACTIVE', 'q1');
      renderRoom();

      const bar = await screen.findByTestId('room-media-question');
      expect(bar).toHaveTextContent('Zvuk');
      expect(bar).toHaveTextContent('1:20 – 1:35');
      fireEvent.click(within(bar).getByTestId('room-media-question-play'));

      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/media/control', { slot: 'question', action: 'play' }, 'jwt'));
    });

    it('offers the reveal clip only at the reveal', async () => {
      db.questions.quiz1[0].reveal_media = FULL;
      live.state = liveState('QUESTION_ACTIVE', 'q1');
      const view = renderRoom();
      await screen.findByTestId('room-question');
      expect(screen.queryByTestId('room-media-reveal')).not.toBeInTheDocument();

      live.state = liveState('QUESTION_REVEAL', 'q1');
      view.unmount();
      renderRoom();

      fireEvent.click(within(await screen.findByTestId('room-media-reveal')).getByTestId('room-media-reveal-replay'));
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/media/control', { slot: 'reveal', action: 'replay' }, 'jwt'));
    });

    it('does not carry a "projector not responding" warning over to the next question', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      db.questions.quiz1[0].media = SONG;
      db.questions.quiz1[1].media = SONG;
      live.state = liveState('QUESTION_ACTIVE', 'q1');
      const view = renderRoom();
      fireEvent.click(within(await screen.findByTestId('room-media-question')).getByTestId('room-media-question-play'));
      act(() => vi.advanceTimersByTime(4100));
      expect(screen.getByTestId('room-media-question-state')).toHaveTextContent('Projektor neodpovedá');

      live.state = liveState('QUESTION_ACTIVE', 'q2');
      view.refresh();
      await screen.findByText('Question q2');

      expect(screen.queryByTestId('room-media-question-state')).not.toBeInTheDocument();
      vi.useRealTimers();
    });

    it('says when the projector has no sound, and when it cannot play the clip', async () => {
      db.questions.quiz1[0].media = SONG;
      live.state = liveState('QUESTION_ACTIVE', 'q1');
      renderRoom();
      await screen.findByTestId('room-media-question');

      act(() => mediaStatus.send!({ questionId: 'q1', slot: 'question', state: 'blocked' }));
      expect(screen.getByTestId('room-media-question-state')).toHaveTextContent('Projektor nemá zapnutý zvuk');

      act(() => mediaStatus.send!({ questionId: 'q1', slot: 'question', state: 'error' }));
      expect(screen.getByTestId('room-media-question-state')).toHaveTextContent('Projektor klip neprehrá');
    });
  });

  it('closes answers for an untimed question', async () => {
    db.questions.quiz1[0].time_limit_seconds = 0;
    live.state = { ...liveState('QUESTION_ACTIVE', 'q1'), questionEndsAt: null };
    renderRoom();

    expect(await screen.findByTestId('room-untimed')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('room-action-close-answers'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/close-answers', {}, 'jwt'));
  });

  it('says answers are closed after an untimed question was closed, without a countdown', async () => {
    db.questions.quiz1[0].time_limit_seconds = 0;
    live.state = { ...liveState('QUESTION_ACTIVE', 'q1'), questionEndsAt: new Date(Date.now() - 1000).toISOString() };
    renderRoom();

    expect(await screen.findByTestId('room-untimed')).toHaveTextContent('Odpovede uzavreté');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByTestId('room-action-close-answers')).toBeDisabled();
  });

  it('shows which teams are ready during the lock-in round, warning when fullscreen is off', async () => {
    live.state = liveState('LOCK_IN_ROUND', 'q1');
    live.state.teams = [
      { ...live.state.teams[0], ready: true, readyFullscreen: false },
      { ...live.state.teams[1], ready: false },
    ];
    renderRoom();

    expect(await screen.findByTestId('room-ready-count')).toHaveTextContent('1 / 2');
    expect(screen.getByTestId('room-ready-t1')).toHaveAttribute('data-ready', 'true');
    expect(screen.getByTestId('room-no-fullscreen-t1')).toBeInTheDocument();
    expect(screen.getByTestId('room-ready-t2')).toHaveAttribute('data-ready', 'false');
  });

  it('starts the quiz with the first question after confirmation', async () => {
    live.state = liveState('LOBBY');
    renderRoom();
    expect(await screen.findByTestId('room-join-code')).toHaveTextContent('#A7F3');
    await waitFor(() => expect(screen.getByTestId('room-start')).toBeEnabled());
    fireEvent.click(screen.getByTestId('room-start'));
    fireEvent.click(within(screen.getByTestId('room-start-dialog')).getByTestId('confirm-dialog-confirm'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'LOCK_IN_ROUND', questionId: 'q1' }, 'jwt'),
    );
  });

  it('counts answers per option while the question is live', async () => {
    live.state = liveState('QUESTION_ACTIVE', 'q1');
    db.answers = [
      {
        id: 'x1',
        sessionId: 's1',
        questionId: 'q1',
        teamId: 't1',
        response: { optionId: 'b' },
        isCorrect: true,
        confidence: null,
        needsReview: false,
        gradedBy: 'AUTO',
        scoreAwarded: 10,
        disputed: false,
        disputeNote: null,
      },
    ];
    renderRoom();

    await waitFor(() => expect(screen.getByTestId('room-answered-count')).toHaveTextContent('1 / 2'));
    expect(
      within(screen.getByTestId('room-distribution'))
        .getByText(/Forrest Gump/)
        .closest('div')!.parentElement,
    ).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('room-action-reveal'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'QUESTION_REVEAL' }, 'jwt'));
  });

  it('moves on to the next unplayed question after a break, not the same one', async () => {
    localStorage.setItem('quizicius:played:s1', JSON.stringify(['q1']));
    live.state = liveState('PAUSE_BREAK', 'q1');
    renderRoom();

    await waitFor(() => expect(screen.getByTestId('room-question-q2')).toHaveAttribute('data-state', 'next'));
    expect(screen.getByTestId('room-question-q1')).toHaveAttribute('data-state', 'done');
    fireEvent.click(screen.getByTestId('room-action-next'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'LOCK_IN_ROUND', questionId: 'q2' }, 'jwt'),
    );
  });

  it('offers to finish once every question has been played', async () => {
    localStorage.setItem('quizicius:played:s1', JSON.stringify(['q1', 'q2', 'q3']));
    live.state = liveState('QUESTION_REVEAL', 'q3');
    renderRoom();

    fireEvent.click(await screen.findByTestId('room-action-finish'));
    fireEvent.click(within(screen.getByTestId('room-end-dialog')).getByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'FINISHED' }, 'jwt'));
  });

  describe('timer and break', () => {
    it('pauses, resumes and extends the timer', async () => {
      live.state = liveState('QUESTION_ACTIVE', 'q1');
      const view = renderRoom();

      fireEvent.click(await screen.findByTestId('room-timer-pause'));
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/timer', { action: 'pause' }, 'jwt'));
      fireEvent.click(screen.getByTestId('room-timer-extend'));
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/timer', { action: 'extend' }, 'jwt'));

      live.state = { ...liveState('QUESTION_ACTIVE', 'q1'), questionPausedAt: new Date().toISOString() };
      view.refresh();
      await waitFor(() => expect(screen.getByTestId('room-timer-pause')).toHaveTextContent('Pokračovať'));
      fireEvent.click(screen.getByTestId('room-host-pause'));
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/timer', { action: 'resume' }, 'jwt'));
    });

    it('starts a break with the length and message set up at the reveal', async () => {
      live.state = liveState('QUESTION_REVEAL', 'q1');
      renderRoom();

      fireEvent.click(await screen.findByTestId('room-break-minutes-10'));
      fireEvent.change(screen.getByTestId('room-break-message'), { target: { value: 'Bar is open' } });
      fireEvent.click(screen.getByTestId('room-action-pause'));

      await waitFor(() =>
        expect(apiPost).toHaveBeenCalledWith(
          '/sessions/s1/transition',
          { status: 'PAUSE_BREAK', breakMinutes: 10, breakMessage: 'Bar is open' },
          'jwt',
        ),
      );
    });
  });

  it("counts answers waiting for review on the tab, and shows a team's dispute note", async () => {
    db.disputes = [
      {
        id: 'd2',
        sessionId: 's1',
        questionId: 'q1',
        teamId: 't1',
        response: { optionId: 'a' },
        isCorrect: false,
        confidence: null,
        needsReview: true,
        gradedBy: 'AUTO',
        scoreAwarded: 0,
        disputed: true,
        disputeNote: 'Both films won that night',
      },
    ];
    live.state = liveState('QUESTION_REVEAL', 'q1');
    renderRoom();

    expect(await screen.findByTestId('room-review-badge')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('room-tab-review'));
    expect(await screen.findByTestId('dispute-note-d2')).toHaveTextContent('Both films won that night');
  });

  it('lets the host accept a disputed free-text answer', async () => {
    db.questions.quiz1[0] = question('q1', 0, { type: 'FREE_TEXT', options: null, accepted_answers: ['Forrest Gump'] });
    db.disputes = [
      {
        id: 'd1',
        sessionId: 's1',
        questionId: 'q1',
        teamId: 't2',
        response: { text: 'Forest Gamp' },
        isCorrect: null,
        confidence: 0.7,
        needsReview: true,
        gradedBy: null,
        scoreAwarded: 0,
        disputed: false,
        disputeNote: null,
      },
    ];
    live.state = liveState('QUESTION_REVEAL', 'q1');
    renderRoom();
    fireEvent.click(await screen.findByTestId('room-tab-review'));

    const dispute = await screen.findByTestId('dispute-d1');
    expect(dispute).toHaveTextContent('Pub Mozarts');
    expect(dispute).toHaveTextContent('Forest Gamp');
    await act(async () => fireEvent.click(screen.getByTestId('dispute-approve-d1')));
    expect(apiPost).toHaveBeenCalledWith('/answers/d1/resolve-dispute', { decision: 'APPROVE' }, 'jwt');
  });

  it('archives the finished night and goes back to the sessions list', async () => {
    live.state = liveState('FINISHED', 'q3');
    vi.mocked(apiPost).mockResolvedValue({});
    renderRoom();

    fireEvent.click(await screen.findByTestId('results-archive'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/archive', { archived: true }, 'jwt'));
    expect(await screen.findByText('sessions list')).toBeInTheDocument();
  });

  it('shows the final podium when the quiz is finished', async () => {
    live.state = liveState('FINISHED', 'q3');
    renderRoom();
    expect(await screen.findByTestId('results-podium-1')).toHaveTextContent('Wise Ducks');
    expect(screen.getByTestId('results-podium-2')).toHaveTextContent('Pub Mozarts');
    expect(screen.queryByTestId('room-end')).not.toBeInTheDocument();
  });

  describe('clicker', () => {
    const press = (key: string) => fireEvent.keyDown(document.body, { key });

    it('starts from the lobby on the second press, the first one asks', async () => {
      live.state = liveState('LOBBY');
      renderRoom();
      await waitFor(() => expect(screen.getByTestId('room-start')).toBeEnabled());

      press('PageDown');
      expect(await screen.findByTestId('room-start-dialog')).toBeInTheDocument();
      expect(apiPost).not.toHaveBeenCalled();
      press('PageDown');
      await waitFor(() =>
        expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'LOCK_IN_ROUND', questionId: 'q1' }, 'jwt'),
      );
    });

    it('shows the prepared question', async () => {
      live.state = liveState('LOCK_IN_ROUND', 'q1');
      renderRoom();
      await screen.findByTestId('room-action-show');

      press('ArrowRight');
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'QUESTION_ACTIVE' }, 'jwt'));
    });

    it('stops answers first and reveals only once they are closed', async () => {
      live.state = liveState('QUESTION_ACTIVE', 'q1');
      const view = renderRoom();
      await screen.findByTestId('room-action-reveal');

      press('PageDown');
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/close-answers', {}, 'jwt'));
      expect(apiPost).not.toHaveBeenCalledWith('/sessions/s1/transition', { status: 'QUESTION_REVEAL' }, 'jwt');

      live.state = { ...liveState('QUESTION_ACTIVE', 'q1'), questionEndsAt: new Date(Date.now() - 1000).toISOString() };
      view.refresh();
      await waitFor(() => expect(screen.getByTestId('room-action-close-answers')).toBeDisabled());
      press('PageDown');
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'QUESTION_REVEAL' }, 'jwt'));
    });

    it('calls a break with the blank button and moves on to the next question', async () => {
      live.state = liveState('QUESTION_REVEAL', 'q1');
      renderRoom();
      await waitFor(() => expect(screen.getByTestId('room-question-q2')).toHaveAttribute('data-state', 'next'));

      press('b');
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'PAUSE_BREAK' }, 'jwt'));
      press('PageDown');
      await waitFor(() =>
        expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'LOCK_IN_ROUND', questionId: 'q2' }, 'jwt'),
      );
    });

    it('does not end the quiz after the last question', async () => {
      localStorage.setItem('quizicius:played:s1', JSON.stringify(['q1', 'q2', 'q3']));
      live.state = liveState('QUESTION_REVEAL', 'q3');
      renderRoom();
      await screen.findByTestId('room-action-finish');

      press('PageDown');
      await act(async () => {});
      expect(apiPost).not.toHaveBeenCalled();
    });

    it('plays and pauses the clip with the back button', async () => {
      db.questions.quiz1[0].media = { kind: 'audio', source: 'link', url: 'https://cdn.example/song.mp3' };
      live.state = liveState('QUESTION_ACTIVE', 'q1');
      renderRoom();
      await screen.findByTestId('room-media-question');

      press('PageUp');
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/media/control', { slot: 'question', action: 'play' }, 'jwt'));
      act(() => mediaStatus.send!({ questionId: 'q1', slot: 'question', state: 'playing' }));
      press('PageUp');
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/media/control', { slot: 'question', action: 'pause' }, 'jwt'));
    });

    it('ignores keys typed into a field', async () => {
      live.state = liveState('LOCK_IN_ROUND', 'q1');
      renderRoom();
      await screen.findByTestId('room-action-show');
      const input = document.createElement('input');
      document.body.appendChild(input);

      fireEvent.keyDown(input, { key: 'ArrowRight' });
      await act(async () => {});
      expect(apiPost).not.toHaveBeenCalled();
      input.remove();
    });

    it('tells the projector when the last question is done instead of ending the quiz', async () => {
      localStorage.setItem('quizicius:played:s1', JSON.stringify(['q1', 'q2', 'q3']));
      live.state = liveState('QUESTION_REVEAL', 'q3');
      renderRoom();
      await screen.findByTestId('room-action-finish');

      const projector = new BroadcastChannel('quizicius:clicker:s1');
      const replies: unknown[] = [];
      projector.addEventListener('message', (event) => replies.push((event as MessageEvent).data));
      projector.postMessage('next');

      await waitFor(() => expect(replies).toContainEqual({ outcome: 'finish' }));
      expect(replies).toContainEqual({ received: true });
      expect(apiPost).not.toHaveBeenCalled();
      projector.close();
    });

    it('follows presses forwarded by the projector', async () => {
      live.state = liveState('LOCK_IN_ROUND', 'q1');
      renderRoom();
      await screen.findByTestId('room-action-show');

      const projector = new BroadcastChannel('quizicius:clicker:s1');
      projector.postMessage('next');
      await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'QUESTION_ACTIVE' }, 'jwt'));
      projector.close();
    });
  });
});

describe('phone remote', () => {
  const renderRemote = () => renderAt('/host/remote/s1', <RemotePage token="jwt" />, '/host/remote/:sessionId');

  it('starts the quiz after confirmation, like the control room', async () => {
    live.state = liveState('LOBBY');
    renderRemote();
    await waitFor(() => expect(screen.getByTestId('remote-next')).toBeEnabled());

    fireEvent.click(screen.getByTestId('remote-next'));
    fireEvent.click(within(screen.getByTestId('remote-start-dialog')).getByTestId('confirm-dialog-confirm'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'LOCK_IN_ROUND', questionId: 'q1' }, 'jwt'),
    );
  });

  it('steps an open question: stop answers first, with the timer controls and the answered count', async () => {
    live.state = { ...liveState('QUESTION_ACTIVE', 'q1'), answeredCount: 1 };
    renderRemote();

    expect(await screen.findByTestId('remote-answered')).toHaveTextContent('1 / 2');
    fireEvent.click(screen.getByTestId('remote-timer-extend'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/timer', { action: 'extend' }, 'jwt'));
    fireEvent.click(screen.getByTestId('remote-next'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/close-answers', {}, 'jwt'));
  });

  it('picks the next question from the night itself, not from what this phone has seen', async () => {
    live.state = { ...liveState('QUESTION_REVEAL', 'q2'), playedQuestionIds: ['q1', 'q2'] };
    renderRemote();
    expect(await screen.findByTestId('remote-up-next')).toHaveTextContent('Question q3');

    fireEvent.click(screen.getByTestId('remote-next'));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'LOCK_IN_ROUND', questionId: 'q3' }, 'jwt'),
    );
  });

  it('offers to end the quiz after the last question, with confirmation', async () => {
    live.state = { ...liveState('QUESTION_REVEAL', 'q3'), playedQuestionIds: ['q1', 'q2', 'q3'] };
    renderRemote();

    fireEvent.click(await screen.findByTestId('remote-finish'));
    fireEvent.click(within(screen.getByTestId('remote-finish-dialog')).getByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s1/transition', { status: 'FINISHED' }, 'jwt'));
  });

  it('is opened from the control room with a QR code', async () => {
    live.state = liveState('LOBBY');
    renderAt('/host/sessions/s1', <ControlRoomPage token="jwt" />, '/host/sessions/:sessionId');

    fireEvent.click(await screen.findByTestId('room-remote'));
    expect(screen.getByTestId('room-remote-url')).toHaveTextContent('/host/remote/s1');
  });
});

describe('sessions page', () => {
  it('hides archived nights until asked, and brings one back', async () => {
    db.sessions = [
      { ...session('s1', 'FINISHED'), finished_at: '2026-10-20T22:00:00Z' },
      { ...session('s2', 'FINISHED'), finished_at: '2026-10-13T22:00:00Z', archived_at: '2026-10-14T09:00:00Z' },
    ];
    vi.mocked(apiPost).mockResolvedValue({});
    renderAt('/host/sessions', <SessionsPage token="jwt" />, '/host/sessions');

    expect(await screen.findByTestId('history-s1')).toBeInTheDocument();
    expect(screen.queryByTestId('history-s2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sessions-show-archived'));
    fireEvent.click(await screen.findByTestId('history-archive-s2'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/sessions/s2/archive', { archived: false }, 'jwt'));
  });
});

describe('host settings', () => {
  const ACCOUNT = {
    id: 'h1',
    email: 'host@pub.sk',
    displayName: 'host@pub.sk',
    role: 'HOST' as const,
    deactivated: false,
    subscription: { status: 'ACTIVE' as const, until: '2026-12-31', forever: false },
  };

  it('saves the host name, shown instead of the e-mail', async () => {
    const onSaved = vi.fn();
    vi.mocked(apiPatch).mockResolvedValue({ ...ACCOUNT, displayName: 'Michal Kováč' });
    renderAt('/host/settings', <SettingsPage token="jwt" account={ACCOUNT} onSaved={onSaved} />, '/host/settings');

    expect(screen.getByTestId('settings-email')).toHaveTextContent('host@pub.sk');
    expect(screen.getByTestId('settings-name')).toHaveValue('');
    fireEvent.change(screen.getByTestId('settings-name'), { target: { value: ' Michal Kováč ' } });
    fireEvent.click(screen.getByTestId('settings-save'));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/me', { displayName: 'Michal Kováč' }, 'jwt'));
    expect(onSaved).toHaveBeenCalled();
  });
});

describe('pubs page', () => {
  const renderPubs = () => renderAt('/host/pubs', <PubsPage token="jwt" />, '/host/pubs');

  it("lists the host's pubs and removes one from the list", async () => {
    renderPubs();
    expect(await screen.findByText('U Zlatého leva')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pub-remove-pub1'));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/host/pubs/pub1', 'jwt'));
  });

  it('adds a new pub', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ id: 'pub3', name: 'Mlyn', city: 'Martin', address: null });
    renderPubs();
    await screen.findByText('U Zlatého leva');
    fireEvent.change(screen.getByTestId('pub-name'), { target: { value: 'Mlyn' } });
    fireEvent.change(screen.getByTestId('pub-city'), { target: { value: 'Martin' } });
    fireEvent.click(screen.getByTestId('pub-add-submit'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/host/pubs', { name: 'Mlyn', city: 'Martin', address: undefined }, 'jwt'));
  });

  it('offers a pub another host already added instead of creating a duplicate', async () => {
    renderPubs();
    await screen.findByText('U Zlatého leva');
    fireEvent.change(screen.getByTestId('pub-name'), { target: { value: 'Black' } });

    const suggestions = await screen.findByTestId('pub-suggestions');
    expect(within(suggestions).queryByText(/Zlatého/)).not.toBeInTheDocument();
    fireEvent.click(within(suggestions).getByTestId('pub-link-pub2'));

    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/host/pubs/pub2', {}, 'jwt'));
  });
});
