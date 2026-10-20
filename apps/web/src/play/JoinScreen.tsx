import { FormEvent, useState } from 'react';
import { apiGet, apiPost } from '../lib/api-client';

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
  // With an initialSessionId we arrived via the QR code / direct URL and already know
  // the session. Without one, the player is typing the join code the host read out.
  const hasSessionFromUrl = Boolean(initialSessionId);
  const [sessionId, setSessionId] = useState(initialSessionId ?? '');
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const resolvedSessionId = hasSessionFromUrl
        ? sessionId
        : (await apiGet<{ id: string }>(`/sessions/by-code/${encodeURIComponent(joinCode.trim())}`)).id;

      const result = await apiPost<{ teamId: string; name: string; token: string }>(
        `/sessions/${resolvedSessionId}/teams/join`,
        { name },
      );
      onJoined({ sessionId: resolvedSessionId, teamId: result.teamId, token: result.token });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-24 flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Join the quiz</h1>
      {hasSessionFromUrl ? (
        <input
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="Session ID"
          className="rounded border px-3 py-2"
          required
        />
      ) : (
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Join code"
          autoCapitalize="characters"
          className="rounded border px-3 py-2 uppercase tracking-widest"
          required
        />
      )}
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
