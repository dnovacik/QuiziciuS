import {useNavigate,useLocation} from 'react-router-dom';
import { useHostSession } from '../lib/use-host-session';
import { LandingPage } from '../landing/LandingPage';
import { StitchHostDashboard } from './StitchHostDashboard';
import { I18nProvider } from '../lib/i18n';
import {LiveControlRoom} from './LiveControlRoom';

export default function HostApp() {
  const { session, loading, token } = useHostSession();
  const navigate=useNavigate();
  const location=useLocation();
  const sessionId=location.pathname.match(/^\/host\/sessions\/([^/]+)$/)?.[1]??null;

  if (loading) {
    return <div data-testid="host-app">Loading…</div>;
  }
  if (!session || !token) {
    return (
      <div data-testid="host-app">
        <LandingPage />
      </div>
    );
  }

  return (
    <div data-testid="host-app">
      <I18nProvider>{sessionId?<LiveControlRoom sessionId={sessionId} token={token} onLeave={()=>navigate('/host/sessions')}/>:<StitchHostDashboard token={token} onSessionCreated={(id)=>navigate(`/host/sessions/${id}`)}/>}</I18nProvider>
    </div>
  );
}
