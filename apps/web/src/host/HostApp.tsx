import { useState } from 'react';
import { useHostSession } from '../lib/use-host-session';
import LoginScreen from './LoginScreen';
import { QuizDashboard } from './QuizDashboard';
import { SessionView } from './SessionView';

export default function HostApp() {
  const { session, loading, token } = useHostSession();
  // The session-control flow needs the quiz id as well as the session id so it can
  // list that quiz's questions for the round picker.
  const [active, setActive] = useState<{ sessionId: string; quizId: string } | null>(null);

  if (loading) {
    return <div data-testid="host-app">Loading…</div>;
  }
  if (!session || !token) {
    return (
      <div data-testid="host-app">
        <LoginScreen />
      </div>
    );
  }

  return (
    <div data-testid="host-app">
      {active ? (
        <SessionView sessionId={active.sessionId} quizId={active.quizId} token={token} />
      ) : (
        <QuizDashboard
          token={token}
          onSessionCreated={(sessionId, quizId) => setActive({ sessionId, quizId })}
        />
      )}
    </div>
  );
}
