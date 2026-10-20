import { QuizState } from '@quizicius/shared-types';
import { useState } from 'react';
import { apiPost } from '../lib/api-client';
import { useSessionState } from '../lib/use-session-state';

const NEXT_STATES: Record<QuizState, QuizState[]> = {
  LOBBY: ['LOCK_IN_ROUND', 'FINISHED'],
  LOCK_IN_ROUND: ['QUESTION_ACTIVE', 'FINISHED'],
  QUESTION_ACTIVE: ['QUESTION_REVEAL', 'FINISHED'],
  QUESTION_REVEAL: ['LOCK_IN_ROUND', 'PAUSE_BREAK', 'FINISHED'],
  PAUSE_BREAK: ['LOCK_IN_ROUND', 'FINISHED'],
  FINISHED: [],
};

export function SessionControlPanel({ sessionId, token }: { sessionId: string; token: string }) {
  const { state, refetch } = useSessionState(sessionId);
  const [nextQuestionId, setNextQuestionId] = useState('');

  async function transition(status: QuizState): Promise<void> {
    const body = status === 'LOCK_IN_ROUND' ? { status, questionId: nextQuestionId } : { status };
    await apiPost(`/sessions/${sessionId}/transition`, body, token);
    refetch();
  }

  if (!state) return <p className="p-6">Loading session…</p>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="text-xl font-semibold">Join code: {state.joinCode}</h2>
      <p className="mb-4 text-sm text-slate-500">Status: {state.status}</p>

      {state.status !== 'QUESTION_ACTIVE' && state.status !== 'QUESTION_REVEAL' && (
        <input
          value={nextQuestionId}
          onChange={(e) => setNextQuestionId(e.target.value)}
          placeholder="Next question id"
          className="mb-2 w-full rounded border px-3 py-2"
        />
      )}

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
