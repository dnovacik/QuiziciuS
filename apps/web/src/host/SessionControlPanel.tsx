import { QuizState } from '@quizicius/shared-types';
import { useEffect, useState } from 'react';
import { ApiError, apiGet, apiPost } from '../lib/api-client';
import { useSessionState } from '../lib/use-session-state';

const NEXT_STATES: Record<QuizState, QuizState[]> = {
  LOBBY: ['LOCK_IN_ROUND', 'FINISHED'],
  LOCK_IN_ROUND: ['QUESTION_ACTIVE', 'FINISHED'],
  QUESTION_ACTIVE: ['QUESTION_REVEAL', 'FINISHED'],
  QUESTION_REVEAL: ['LOCK_IN_ROUND', 'PAUSE_BREAK', 'FINISHED'],
  PAUSE_BREAK: ['LOCK_IN_ROUND', 'FINISHED'],
  FINISHED: [],
};

interface QuestionOption {
  id: string;
  prompt: string;
  order_index: number;
}

export function SessionControlPanel({
  sessionId,
  quizId,
  token,
}: {
  sessionId: string;
  quizId: string;
  token: string;
}) {
  const { state, refetch } = useSessionState(sessionId);
  const [questions, setQuestions] = useState<QuestionOption[]>([]);
  const [nextQuestionId, setNextQuestionId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // GET /quizzes/:quizId/questions already returns rows sorted by order_index.
    apiGet<QuestionOption[]>(`/quizzes/${quizId}/questions`, token)
      .then((rows) => {
        if (cancelled) return;
        setQuestions(rows);
        setNextQuestionId((prev) => prev || rows[0]?.id || '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load questions');
      });
    return () => {
      cancelled = true;
    };
  }, [quizId, token]);

  async function transition(status: QuizState): Promise<void> {
    setError(null);
    const body = status === 'LOCK_IN_ROUND' ? { status, questionId: nextQuestionId } : { status };
    try {
      await apiPost(`/sessions/${sessionId}/transition`, body, token);
      refetch();
    } catch (err) {
      // A 409 means the server's state moved on without us (another tab, a stale
      // render). Resync rather than leaving the panel showing a state that is gone.
      if (err instanceof ApiError && err.status === 409) {
        const currentState = err.body.currentState;
        setError(
          typeof currentState === 'string'
            ? `${err.message} (session is currently ${currentState})`
            : err.message,
        );
        refetch();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to change session state');
    }
  }

  if (!state) return <p className="p-6">Loading session…</p>;

  const canPickQuestion = state.status !== 'QUESTION_ACTIVE' && state.status !== 'QUESTION_REVEAL';

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="text-xl font-semibold">Join code: {state.joinCode}</h2>
      <p className="mb-4 text-sm text-slate-500">Status: {state.status}</p>

      {canPickQuestion &&
        (questions.length === 0 ? (
          <p className="mb-2 text-sm text-slate-500">No questions in this quiz yet.</p>
        ) : (
          <select
            aria-label="Next question"
            value={nextQuestionId}
            onChange={(e) => setNextQuestionId(e.target.value)}
            className="mb-2 w-full rounded border px-3 py-2"
          >
            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.prompt}
              </option>
            ))}
          </select>
        ))}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-2">
        {NEXT_STATES[state.status].map((next) => (
          <button
            key={next}
            onClick={() => transition(next)}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
          >
            {next}
          </button>
        ))}
      </div>

      <h3 className="mb-2 font-semibold">Teams</h3>
      <ul className="space-y-1">
        {state.teams.map((team) => (
          <li key={team.id} className="flex justify-between rounded border px-3 py-2 text-sm">
            <span>{team.name}</span>
            <span>
              {team.score} pts{team.infractionCount > 0 ? ` · ${team.infractionCount} flag(s)` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
