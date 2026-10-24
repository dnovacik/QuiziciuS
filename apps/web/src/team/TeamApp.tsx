import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Hash, LogIn, LogOut, UserRound } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase-client';
import { clearPendingClaim, pendingClaim } from '../lib/team-seat';
import { useAccount } from '../lib/use-account';
import { useHostSession } from '../lib/use-host-session';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Logo } from '../ui/Logo';
import { teamApi, type RegisteredTeam } from './api';
import { OnboardingPage } from './OnboardingPage';
import { PubLeaderboard } from './PubLeaderboard';
import { TeamSchedule } from './TeamSchedule';
import { TeamDashboard } from './TeamDashboard';

/** /team — the captain's area: onboarding until a team exists, then the team dashboard. */
export default function TeamApp() {
  const { t } = useI18n();
  const { session, loading, token } = useHostSession();
  const { account, reload: reloadAccount } = useAccount(token);
  const [teams, setTeams] = useState<RegisteredTeam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  // A one-off team that chose to register on a league night: link its seat once a team exists.
  const [claim] = useState(pendingClaim);
  const [view, setView] = useState<TeamView>('team');
  const [claimError, setClaimError] = useState<{ message: string; sessionId: string } | null>(null);
  const team0 = teams?.[0] ?? null;
  useEffect(() => {
    if (!claim || !token || !team0) return;
    clearPendingClaim();
    teamApi
      .claimSeat(token, team0.id, claim)
      .then(() => navigate(`/play/${claim.sessionId}`))
      .catch((err) => setClaimError({ message: describeError(err, t, 'errors.generic'), sessionId: claim.sessionId }));
  }, [claim, token, team0, navigate, t]);

  const load = useCallback(() => {
    if (!token) return;
    teamApi
      .mine(token)
      .then(setTeams)
      .catch((err) => setError(describeError(err, t, 'errors.generic')));
  }, [token, t]);
  useEffect(load, [load]);

  if (loading || (token && teams === null && !error)) {
    return <div className="min-h-screen bg-surface-container-lowest" aria-busy="true" data-testid="team-loading" />;
  }

  if (!session || !token) {
    return (
      <TeamShell captain={null} teamName={null}>
        <div
          className="mx-auto flex max-w-lg flex-col items-center gap-space-md rounded-3xl bg-surface-container-low/90 p-space-xl text-center shadow-2xl"
          data-testid="team-signed-out"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container/20 text-primary">
            <LogIn className="h-8 w-8" />
          </div>
          <h1 className="text-headline-lg text-on-surface">{t('team.auth.title')}</h1>
          <p className="text-body-md text-on-surface-variant">{t('team.auth.text')}</p>
          <Link to="/" className="rounded-xl bg-primary px-space-lg py-3 text-label-lg text-on-primary">
            {t('team.auth.button')}
          </Link>
        </div>
      </TeamShell>
    );
  }

  const email = session.user.email ?? '';
  // Accounts start with the e-mail as their name; only a name the captain set counts as one.
  const ownName = account && account.displayName !== account.email ? account.displayName : null;
  const team = teams?.[0] ?? null;
  const metadata = session.user.user_metadata as { team_name?: string; expected_members?: number };

  return (
    <TeamShell captain={ownName ?? email} teamName={team?.name ?? null} view={team ? view : null} onView={setView}>
      {error && (
        <p role="alert" className="mx-auto mb-space-md max-w-7xl rounded-xl bg-error-container/30 p-space-md text-on-error-container">
          {error}
        </p>
      )}
      {claimError && (
        <p
          role="alert"
          data-testid="team-claim-error"
          className="mx-auto mb-space-md flex max-w-7xl flex-wrap items-center justify-between gap-space-sm rounded-xl bg-error-container/30 p-space-md text-on-error-container"
        >
          {claimError.message}
          <Link to={`/play/${claimError.sessionId}`} className="text-label-lg underline">
            {t('team.claim.backToGame')}
          </Link>
        </p>
      )}
      {team && view === 'leaderboard' ? (
        <PubLeaderboard token={token} team={team} />
      ) : team && view === 'schedule' ? (
        <TeamSchedule token={token} teamId={team.id} />
      ) : team ? (
        <TeamDashboard
          token={token}
          team={team}
          email={email}
          captainName={ownName}
          onCaptainRenamed={reloadAccount}
          onUpdated={(updated) => setTeams((list) => (list ?? []).map((row) => (row.id === updated.id ? updated : row)))}
        />
      ) : (
        <OnboardingPage
          token={token}
          email={email}
          captainName={ownName}
          onCaptainRenamed={reloadAccount}
          suggestedName={claim?.teamName ?? metadata.team_name ?? ''}
          suggestedMembers={metadata.expected_members ?? 4}
          onCreated={(created) => setTeams([created])}
        />
      )}
    </TeamShell>
  );
}

/** Header from the Stitch captain screens: logo, team-area navigation, language and the captain chip. */
type TeamView = 'team' | 'leaderboard' | 'schedule';

function TeamShell({
  captain,
  teamName,
  view = null,
  onView = () => {},
  children,
}: {
  captain: string | null;
  teamName: string | null;
  /** The page shown; null hides the team navigation (signed out, or no team yet). */
  view?: TeamView | null;
  onView?: (view: TeamView) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const tab = (value: TeamView, label: string, testId: string) => (
    <button
      type="button"
      aria-current={view === value ? 'page' : undefined}
      onClick={() => onView(value)}
      data-testid={testId}
      className={`rounded-xl px-space-md py-space-sm text-label-lg transition-colors ${
        view === value ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-surface-container-lowest text-on-surface" data-testid="team-app">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[400px] w-[600px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute -right-20 top-1/3 h-[350px] w-[450px] rounded-full bg-secondary-container/10 blur-[120px]" />
        <div className="absolute bottom-0 left-10 h-[300px] w-[500px] rounded-full bg-tertiary-container/10 blur-[130px]" />
      </div>
      <header className="fixed left-0 right-0 top-0 z-50 bg-surface-container-lowest/80 shadow-[0_1px_8px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="flex h-20 w-full items-center justify-between gap-space-md px-space-md sm:px-space-lg">
          <Logo to="/" />
          <nav
            className="hidden items-center gap-space-xs rounded-2xl bg-surface-container-low/70 p-1.5 lg:flex"
            aria-label={t('team.nav.label')}
          >
            {view && tab('leaderboard', t('team.nav.leaderboard'), 'team-nav-leaderboard')}
            {view ? (
              tab('team', t('team.nav.myTeam'), 'team-nav-team')
            ) : (
              <span
                aria-current="page"
                className="rounded-xl bg-primary-container px-space-md py-space-sm text-label-lg text-on-primary-container"
              >
                {t('team.nav.myTeam')}
              </span>
            )}
            {view && tab('schedule', t('team.nav.schedule'), 'team-nav-schedule')}
          </nav>
          <div className="flex items-center gap-space-sm sm:gap-space-md">
            {teamName && (
              <a
                href="#join-quiz"
                className="hidden h-11 items-center gap-space-sm rounded-xl bg-secondary-container px-space-md text-label-lg text-on-secondary-container shadow-[0_0_20px_-2px_rgba(245,158,11,0.35)] transition-all hover:bg-secondary active:scale-95 sm:flex"
              >
                <Hash className="h-5 w-5" />
                {t('team.nav.join')}
              </a>
            )}
            <LanguageSwitcher />
            {captain && (
              <div className="flex items-center gap-space-sm rounded-full bg-surface-container-low py-1 pl-space-xs pr-space-md shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <UserRound className="h-[18px] w-[18px] text-on-primary" />
                </div>
                <div className="hidden flex-col text-left lg:flex">
                  <span className="max-w-[180px] truncate text-label-md leading-tight text-on-surface" data-testid="team-captain-chip">
                    {captain}
                  </span>
                  {teamName && (
                    <span className="flex items-center gap-1 text-label-sm text-secondary">
                      <Award className="h-3 w-3" />
                      {teamName}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="ml-1 text-on-surface-variant hover:text-error"
                  aria-label={t('host.nav.signOut')}
                  onClick={() => void supabase.auth.signOut()}
                  data-testid="team-logout"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="relative z-10 w-full px-space-md pb-space-xl pt-28 sm:px-space-lg">
        {view && (
          // Phones have no room for the header navigation: the same tabs sit above the page.
          <nav
            className="mx-auto mb-space-md flex w-fit gap-space-xs rounded-2xl bg-surface-container-low/70 p-1.5 lg:hidden"
            aria-label={t('team.nav.label')}
          >
            {tab('team', t('team.nav.myTeam'), 'team-tab-team')}
            {tab('leaderboard', t('team.nav.leaderboard'), 'team-tab-leaderboard')}
            {tab('schedule', t('team.nav.schedule'), 'team-tab-schedule')}
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}
