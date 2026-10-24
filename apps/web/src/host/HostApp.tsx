import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { hasRole } from '@quizicius/shared-types';
import { LandingPage } from '../landing/LandingPage';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { pendingPasswordLink } from '../lib/supabase-client';
import { useAccount } from '../lib/use-account';
import { SettingsPage } from './SettingsPage';
import { useHostSession } from '../lib/use-host-session';
import { NotHostPage, SetPasswordPage } from '../ui/AccountPages';
import { AdminPage } from './admin/AdminPage';
import { LeagueDetailPage } from './leagues/LeagueDetailPage';
import { LeaguesPage } from './leagues/LeaguesPage';
import { ControlRoomPage } from './control-room/ControlRoomPage';
import { DashboardPage } from './DashboardPage';
import { HostShell } from './HostShell';
import { QuizEditorPage } from './editor/QuizEditorPage';
import { QuizzesPage } from './QuizzesPage';
import { PubsPage } from './pubs';
import { SessionsPage } from './SessionsPage';
import { ToastProvider } from './ui';

export default function HostApp() {
  const { t } = useI18n();
  const { session, loading, token } = useHostSession();
  const { account, error: accountError, loading: accountLoading, reload: reloadAccount } = useAccount(token);
  const [passwordLink, setPasswordLink] = useState(pendingPasswordLink);

  if (loading || (token && accountLoading && !account)) {
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
  // Invited hosts and password resets arrive signed in, without a password they know.
  if (passwordLink) {
    return <SetPasswordPage kind={passwordLink} onDone={() => setPasswordLink(null)} />;
  }
  if (!account) {
    return (
      <div data-testid="host-app" className="min-h-screen bg-surface-container-lowest p-space-lg">
        <p role="alert" className="text-body-md text-error">
          {describeError(accountError, t, 'errors.generic')}
        </p>
      </div>
    );
  }
  if (!hasRole(account.role, 'HOST')) {
    return (
      <div data-testid="host-app">
        <NotHostPage email={email} />
      </div>
    );
  }

  return (
    <div data-testid="host-app">
      <ToastProvider>
        <Routes>
          {/* The control room is full-screen, like the Stitch design — no sidebar. */}
          <Route path="sessions/:sessionId" element={<ControlRoomPage token={token} />} />
          <Route
            path="*"
            element={
              <HostShell token={token} email={email} account={account}>
                <Routes>
                  <Route index element={<DashboardPage token={token} />} />
                  <Route path="quizzes" element={<QuizzesPage token={token} />} />
                  <Route path="quizzes/:quizId" element={<QuizEditorPage token={token} />} />
                  <Route path="sessions" element={<SessionsPage token={token} />} />
                  <Route path="pubs" element={<PubsPage token={token} />} />
                  <Route path="leagues" element={<LeaguesPage token={token} />} />
                  <Route path="leagues/:leagueId" element={<LeagueDetailPage token={token} />} />
                  <Route path="settings" element={<SettingsPage token={token} account={account} onSaved={reloadAccount} />} />
                  {account.role === 'SUPER_ADMIN' && <Route path="admin" element={<AdminPage token={token} />} />}
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
