import { FormEvent, useState } from 'react';
import { apiPost } from '../lib/api-client';

export interface JoinResult {
  sessionId: string;
  teamId: string;
  token: string;
}

export function JoinScreen({
  initialSessionId,
  onJoined,
}: {
  initialSessionId?: string;
  onJoined: (result: JoinResult) => void;
}) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ teamId: string; name: string; token: string }>(
        `/sessions/${sessionId}/teams/join`,
        { name },
      );
      onJoined({ sessionId, teamId: result.teamId, token: result.token });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-24 flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Join the quiz</h1>
      <input
        value={sessionId}
        onChange={(e) => setSessionId(e.target.value)}
        placeholder="Session ID"
        className="rounded border px-3 py-2"
        required
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        className="rounded border px-3 py-2"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-slate-900 px-4 py-2 text-white">
        {submitting ? 'Joining…' : 'Join'}
      </button>
    </form>
  );
}
