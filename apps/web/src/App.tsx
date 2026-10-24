import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LandingPage } from './landing/LandingPage';
import { I18nProvider } from './lib/i18n';

const HostApp = lazy(() => import('./host/HostApp'));
const ProjectorApp = lazy(() => import('./projector/ProjectorApp'));
const PlayApp = lazy(() => import('./play/PlayApp'));
const TeamApp = lazy(() => import('./team/TeamApp'));
const InvitePage = lazy(() => import('./team/InvitePage'));

function RouteFallback() {
  return <div className="min-h-screen bg-surface-container-lowest" aria-busy="true" />;
}

export function AppRoutes() {
  return (
    <I18nProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/team" element={<TeamApp />} />
          <Route path="/join-team/:inviteToken" element={<InvitePage />} />
          <Route path="/host/*" element={<HostApp />} />
          <Route path="/projector/:sessionId" element={<ProjectorApp />} />
          <Route path="/play/:sessionId?" element={<PlayApp />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Suspense>
    </I18nProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
