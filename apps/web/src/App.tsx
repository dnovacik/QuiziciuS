import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

const HostApp = lazy(() => import('./host/HostApp'));
const ProjectorApp = lazy(() => import('./projector/ProjectorApp'));
const PlayApp = lazy(() => import('./play/PlayApp'));

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading…</div>}>
      <Routes>
        <Route path="/host/*" element={<HostApp />} />
        <Route path="/projector/:sessionId" element={<ProjectorApp />} />
        <Route path="/play/:sessionId?" element={<PlayApp />} />
        <Route path="*" element={<div className="p-8 text-center">Quizicius</div>} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
