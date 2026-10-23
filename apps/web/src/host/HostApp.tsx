import { Route, Routes } from 'react-router-dom';
import { LandingPage } from '../landing/LandingPage';
import { useHostSession } from '../lib/use-host-session';
import { ControlRoomPage } from './control-room/ControlRoomPage';
import { DashboardPage } from './DashboardPage';
import { HostShell } from './HostShell';
import { QuizEditorPage } from './editor/QuizEditorPage';
import { QuizzesPage } from './QuizzesPage';
import { SessionsPage } from './SessionsPage';
import { ToastProvider } from './ui';

export default function HostApp() {
  const { session, loading, token } = useHostSession();

  if (loading) {
    return <div data-testid="host-app" className="min-h-screen bg-surface-container-lowest" aria-busy="true" />;
  }
  if (!session || !token) {
    return (
      <div data-testid="host-app">
        <LandingPage />
      </div>
    );
  }

  const email = session.user.email ?? '';
  return (
    <div data-testid="host-app">
      <ToastProvider>
        <Routes>
          {/* The control room is full-screen, like the Stitch design — no sidebar. */}
          <Route path="sessions/:sessionId" element={<ControlRoomPage token={token} />} />
          <Route
            path="*"
            element={
              <HostShell token={token} email={email}>
                <Routes>
                  <Route index element={<DashboardPage token={token} />} />
                  <Route path="quizzes" element={<QuizzesPage token={token} />} />
                  <Route path="quizzes/:quizId" element={<QuizEditorPage token={token} />} />
                  <Route path="sessions" element={<SessionsPage token={token} />} />
                  <Route path="*" element={<DashboardPage token={token} />} />
                </Routes>
              </HostShell>
            }
          />
        </Routes>
      </ToastProvider>
    </div>
  );
}
