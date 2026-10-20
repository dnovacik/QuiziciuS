import { AnswerSummaryDto } from '@quizicius/shared-types';
import { useEffect, useState } from 'react';
import { apiGet, apiPatch, apiPost } from '../lib/api-client';

interface InfractionSummary {
  id: string;
  team_id: string;
  type: string;
}

export function DisputeQueue({ sessionId, token }: { sessionId: string; token: string }) {
  const [disputes, setDisputes] = useState<AnswerSummaryDto[]>([]);
  const [infractions, setInfractions] = useState<InfractionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const [disputeRows, infractionRows] = await Promise.all([
        apiGet<AnswerSummaryDto[]>(`/sessions/${sessionId}/disputes`, token),
        apiGet<InfractionSummary[]>(`/sessions/${sessionId}/infractions`, token),
      ]);
      setDisputes(disputeRows);
      setInfractions(infractionRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the review queue');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  async function resolve(answerId: string, decision: 'APPROVE' | 'REJECT'): Promise<void> {
    try {
      await apiPost(`/answers/${answerId}/resolve-dispute`, { decision }, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve the dispute');
      return;
    }
    load();
  }

  async function dismissInfraction(infractionId: string): Promise<void> {
    try {
      await apiPatch(`/sessions/${sessionId}/infractions/${infractionId}/review`, {}, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss the infraction');
      return;
    }
    load();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-2 text-xl font-semibold">Dispute queue</h2>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {disputes.length === 0 ? (
        <p className="text-sm text-slate-500">No free-text answers need review.</p>
      ) : (
        <ul className="mb-6 space-y-2">
          {disputes.map((answer) => (
            <li key={answer.id} className="flex items-center justify-between rounded border p-3">
              <span>
                Team {answer.teamId} answered &quot;{(answer.response as { text?: string }).text}&quot; (confidence{' '}
                {Math.round((answer.confidence ?? 0) * 100)}%)
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => resolve(answer.id, 'APPROVE')}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                >
                  Approve
                </button>
                <button
                  onClick={() => resolve(answer.id, 'REJECT')}
                  className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                >
                  Reject
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-xl font-semibold">Infractions</h2>
      {infractions.length === 0 ? (
        <p className="text-sm text-slate-500">No infractions reported.</p>
      ) : (
        <ul className="space-y-1">
          {infractions.map((infraction) => (
            <li
              key={infraction.id}
              className="flex items-center justify-between rounded border px-3 py-2 text-sm"
            >
              <span>
                Team {infraction.team_id} — {infraction.type}
              </span>
              <button
                onClick={() => dismissInfraction(infraction.id)}
                className="rounded bg-slate-700 px-3 py-1 text-sm text-white"
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
