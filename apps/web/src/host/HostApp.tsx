import { useState } from 'react';
import { useHostSession } from '../lib/use-host-session';
import LoginScreen from './LoginScreen';
import { QuizDashboard } from './QuizDashboard';
import { SessionView } from './SessionView';

export default function HostApp() {
  const { session, loading, token } = useHostSession();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

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
      {activeSessionId ? (
        <SessionView sessionId={activeSessionId} token={token} />
      ) : (
        <QuizDashboard token={token} onSessionCreated={setActiveSessionId} />
      )}
    </div>
  );
}
