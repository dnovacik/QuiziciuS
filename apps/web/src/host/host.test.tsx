import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AnswerSummaryDto, QuizSessionStateDto, QuizState } from '@quizicius/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../lib/api-client';
import type { Pub } from '../lib/pubs';
import { I18nProvider } from '../lib/i18n';
import type { HostSession, Question, Quiz } from './api';
import { ControlRoomPage } from './control-room/ControlRoomPage';
import { DashboardPage } from './DashboardPage';
import { QuizEditorPage } from './editor/QuizEditorPage';
import { PubsPage } from './pubs';
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

const pubs = vi.hoisted(() => ({ mine: [] as Pub[], all: [] as Pub[] }));
const live = vi.hoisted(() => ({ state: null as QuizSessionStateDto | null, refetch: vi.fn() }));
vi.mock('../lib/use-session-state', () => ({
  useSessionState: () => ({ state: live.state, error: null, refetch: live.refetch }),
}));

const LION: Pub = { id: 'pub1', name: 'U Zlatého leva', city: 'Žilina', address: null };
const DOG: Pub = { id: 'pub2', name: 'Black Dog', city: 'Bratislava', address: null };
const QUIZ: Quiz = { id: 'quiz1', title: 'Friday Movies', category_id: 'cat1', pub_id: 'pub1', created_at: '2026-10-01T18:00:00Z' };
const EMPTY_QUIZ: Quiz = { id: 'quiz2', title: 'History draft', category_id: null, pub_id: null, created_at: '2026-09-01T18:00:00Z' };

function question(id: string, order: number, overrides: Partial<Question> = {}): Question {
  return {
    id,
    quiz_id: 'quiz1',
    type: 'MULTIPLE_CHOICE',
    prompt: `Question ${id}`,
    media_type: null,
    media_path: null,
    options: [
      { id: 'a', label: 'Pulp Fiction', isCorrect: false },
      { id: 'b', label: 'Forrest Gump', isCorrect: true },
    ],
    accepted_answers: null,
    correct_numeric: null,
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
    },
    questionEndsAt: status === 'QUESTION_ACTIVE' ? new Date(Date.now() + 20_000).toISOString() : null,
    teams: [
      {
        id: 't1',
        name: 'Wise Ducks',
        isActive: true,
        registeredTeamId: null,
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
  return render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
            <Route path="/host/sessions/:sessionId" element={<p>control room for session</p>} />
            <Route path="/host/quizzes/:quizId" element={<p>editor opened</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );
}

describe('host dashboard', () => {
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

  it('deletes a quiz after confirmation', async () => {
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    fireEvent.click(await screen.findByTestId('quiz-delete-quiz2'));
    expect(screen.getByTestId('delete-quiz-dialog')).toHaveTextContent('History draft');
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/quizzes/quiz2', 'jwt'));
  });

  it('duplicates a quiz with its questions but without media', async () => {
    db.questions.quiz1[0].media_type = 'image';
    db.questions.quiz1[0].media_path = 'host/quiz1/pic.jpg';
    renderAt('/host', <DashboardPage token="jwt" />, '/host');
    fireEvent.click(await screen.findByTestId('quiz-duplicate-quiz1'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(vi.mocked(apiPost).mock.calls.filter(([path]) => path === '/quizzes/copy1/questions')).toHaveLength(3));
    expect(apiPost).toHaveBeenCalledWith('/quizzes', { title: 'Friday Movies (kópia)', categoryId: 'cat1', pubId: 'pub1' }, 'jwt');
    const firstCopy = vi.mocked(apiPost).mock.calls.find(([path]) => path === '/quizzes/copy1/questions')![1];
    expect(firstCopy).toMatchObject({ prompt: 'Question q1', mediaPath: null, orderIndex: 0 });
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
    fireEvent.click(screen.getByTestId('settings-save'));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith('/quizzes/quiz1', { title: 'Saturday Movies', categoryId: null, pubId: null }, 'jwt'),
    );
  });
});

describe('control room', () => {
  const renderRoom = () => renderAt('/host/sessions/s1', <ControlRoomPage token="jwt" />, '/host/sessions/:sessionId');

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

  it('shows the final podium when the quiz is finished', async () => {
    live.state = liveState('FINISHED', 'q3');
    renderRoom();
    expect(await screen.findByTestId('results-podium-1')).toHaveTextContent('Wise Ducks');
    expect(screen.getByTestId('results-podium-2')).toHaveTextContent('Pub Mozarts');
    expect(screen.queryByTestId('room-end')).not.toBeInTheDocument();
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
