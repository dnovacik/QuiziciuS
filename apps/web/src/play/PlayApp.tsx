import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useSessionState } from '../lib/use-session-state';
import { useQuizSecurity } from './use-quiz-security';
import { JoinScreen, JoinResult } from './JoinScreen';
import { QuestionScreen } from './QuestionScreen';

const STORAGE_PREFIX = 'quizicius:team:';

function loadStoredJoin(sessionId: string | undefined): JoinResult | null {
  if (!sessionId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    return raw ? (JSON.parse(raw) as JoinResult) : null;
  } catch {
    return null;
  }
}

export default function PlayApp() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [joined, setJoined] = useState<JoinResult | null>(() => loadStoredJoin(sessionId));

  const { state } = useSessionState(joined?.sessionId);
  const { requestFullscreenNow } = useQuizSecurity(state?.status ?? 'LOBBY', joined?.token ?? null);

  function handleJoined(result: JoinResult): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${result.sessionId}`, JSON.stringify(result));
    } catch {
      // Best-effort persistence — gameplay still works for this tab even if storage is blocked.
    }
    setJoined(result);
  }

  if (!joined) {
    return (
      <div data-testid="play-app">
        <JoinScreen initialSessionId={sessionId} onJoined={handleJoined} />
      </div>
    );
  }

  if (!state) {
    return <div data-testid="play-app">Loading…</div>;
  }

  return (
    <div data-testid="play-app">
      {/*
        Keyed on the current question so React remounts QuestionScreen whenever the
        session advances. QuestionScreen keeps `submitted`/`text`/`numericValue` in
        local state; without the key it is never remounted and `submitted` would stay
        true forever after the first answer, locking the team out of every later round.
      */}
      <QuestionScreen
        key={state.currentQuestion?.id}
        state={state}
        teamId={joined.teamId}
        token={joined.token}
        onTapToLockIn={requestFullscreenNow}
      />
    </div>
  );
}
