import { useState } from 'react';
import { apiPost } from '../lib/api-client';
import { useSessionState } from '../lib/use-session-state';

export function PaperModeGrid({ sessionId, token }: { sessionId: string; token: string }) {
  const { state } = useSessionState(sessionId);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');

  async function award(teamId: string): Promise<void> {
    const value = Number(points[teamId] ?? 0);
    if (!value) return;
    await apiPost(`/sessions/${sessionId}/teams/${teamId}/paper-score`, { points: value, reason: reason || undefined }, token);
    setPoints((prev) => ({ ...prev, [teamId]: '' }));
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-2 text-xl font-semibold">Paper-mode scoring</h2>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Round reason (optional)"
        className="mb-3 w-full rounded border px-3 py-2"
      />
      <ul className="space-y-2">
        {(state?.teams ?? []).map((team) => (
          <li key={team.id} className="flex items-center justify-between gap-2 rounded border p-3">
            <span>{team.name}</span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                value={points[team.id] ?? ''}
                onChange={(e) => setPoints((prev) => ({ ...prev, [team.id]: e.target.value }))}
                className="w-20 rounded border px-2 py-1"
              />
              <button onClick={() => award(team.id)} className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
                Award
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
