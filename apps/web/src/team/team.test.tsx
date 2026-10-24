import type { TeamLeagueDto } from '@quizicius/shared-types';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client';
import { I18nProvider } from '../lib/i18n';
import type { Player, RegisteredTeam } from './api';
import InvitePage from './InvitePage';
import TeamApp from './TeamApp';

vi.mock('../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));
vi.mock('../lib/supabase-client', () => ({ supabase: { auth: { signOut: vi.fn() } } }));

const auth = vi.hoisted(() => ({ signedIn: true, metadata: {} as Record<string, unknown> }));
vi.mock('../lib/use-host-session', () => ({
  useHostSession: () =>
    auth.signedIn
      ? { loading: false, token: 'captain-jwt', session: { user: { email: 'captain@example.com', user_metadata: auth.metadata } } }
      : { loading: false, token: null, session: null },
}));

const TEAM: RegisteredTeam = {
  id: 'rt1',
  name: 'Wise Ducks',
  description: 'We come, we win',
  badge: 'brain',
  badge_color: 'amber',
  expected_members: 4,
  home_pub: null,
  pubs: [{ id: 'pub1', name: 'The Golden Lion', city: 'Žilina', isPrimary: true }],
  created_at: '2026-10-01T18:00:00Z',
};

const PUBS = [
  { id: 'pub1', name: 'The Golden Lion', city: 'Žilina', address: null },
  { id: 'pub2', name: 'Black Dog', city: 'Bratislava', address: null },
];

const data = vi.hoisted(() => ({
  teams: [] as RegisteredTeam[],
  players: [] as Player[],
  taken: [] as string[],
  leagues: [] as TeamLeagueDto[],
  claimError: null as Error | null,
  captainName: 'captain@example.com',
}));

function renderTeam() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/team']}>
        <Routes>
          <Route path="/team" element={<TeamApp />} />
          <Route path="/play/:sessionId" element={<p>play screen</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  auth.signedIn = true;
  auth.metadata = {};
  data.teams = [];
  data.players = [{ id: 'p1', name: 'Jana', created_at: '2026-10-02T18:00:00Z' }];
  data.taken = ['pub mozarts'];
  data.leagues = [];
  data.claimError = null;
  data.captainName = 'captain@example.com';
  sessionStorage.clear();
  vi.mocked(apiGet)
    .mockReset()
    .mockImplementation(async (path: string) => {
      if (path === '/me')
        return {
          id: 'c1',
          email: 'captain@example.com',
          displayName: data.captainName,
          role: 'TEAM_CAPTAIN',
          deactivated: false,
          subscription: null,
        };
      if (path === '/registered-teams/mine') return data.teams;
      if (path.startsWith('/registered-teams/availability/')) {
        const name = decodeURIComponent(path.split('/').pop()!);
        return { available: !data.taken.includes(name), code: 'X' };
      }
      if (path === '/registered-teams/rt1/players') return data.players;
      if (path === '/registered-teams/rt1/access') return { pin: '482915', inviteToken: 'invite-token-1234567' };
      if (path === '/team-access/invite/invite-token-1234567')
        return { name: 'Wise Ducks', badge: 'brain', badgeColor: 'amber', rosterSize: 2 };
      if (path === '/registered-teams/rt1/leagues') return data.leagues;
      if (path === '/pubs') return PUBS;
      if (path === '/sessions/by-code/A7F3') return { id: 's1' };
      throw new Error(`unexpected GET ${path}`);
    });
  vi.mocked(apiPost)
    .mockReset()
    .mockImplementation(async (path: string, body: unknown) => {
      if (path === '/registered-teams') return { ...TEAM, name: (body as { name: string }).name };
      if (path === '/registered-teams/rt1/players') return { id: 'p2', name: (body as { name: string }).name, created_at: 'now' };
      if (path === '/registered-teams/rt1/access/rotate') return { pin: '000111', inviteToken: 'invite-token-new-7654321' };
      if (path === '/team-access/invite/invite-token-1234567/players')
        return { id: 'p3', name: (body as { name: string }).name, created_at: 'now' };
      if (path === '/registered-teams/rt1/sessions/s1/join') return { teamId: 'session-team', token: 'team-token' };
      if (path === '/registered-teams/rt1/leagues/l1/join') return { ...data.leagues[0], status: 'JOINED' };
      if (path === '/registered-teams/rt1/sessions/s1/claim') {
        if (data.claimError) throw data.claimError;
        return { teamId: 'team-1', name: 'Wise Ducks', token: 'team-token' };
      }
      throw new Error(`unexpected POST ${path}`);
    });
  vi.mocked(apiPatch)
    .mockReset()
    .mockImplementation(async (path: string, body: unknown) => {
      if (path === '/me') {
        data.captainName = (body as { displayName: string }).displayName || 'captain@example.com';
        return {
          id: 'c1',
          email: 'captain@example.com',
          displayName: data.captainName,
          role: 'TEAM_CAPTAIN',
          deactivated: false,
          subscription: null,
        };
      }
      return {
        ...TEAM,
        ...(body as object),
        name: (body as { name?: string }).name ?? TEAM.name,
      };
    });
  vi.mocked(apiDelete).mockReset().mockResolvedValue(undefined);
});

describe('team area', () => {
  it('asks a signed-out visitor to sign in as captain', () => {
    auth.signedIn = false;
    renderTeam();
    expect(screen.getByTestId('team-signed-out')).toBeInTheDocument();
  });

  it('onboards a captain: checks the name, previews the team and creates it', async () => {
    auth.metadata = { team_name: 'Quiz Wolves', expected_members: 5 };
    renderTeam();

    const input = await screen.findByTestId('team-name-input');
    expect(input).toHaveValue('Quiz Wolves');
    expect(screen.getByTestId('capacity-5')).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(screen.getByTestId('team-name-status')).toHaveAttribute('data-status', 'available'));

    fireEvent.click(screen.getByTestId('badge-crown'));
    fireEvent.click(screen.getByTestId('color-green'));
    fireEvent.change(screen.getByTestId('team-motto'), { target: { value: 'Howl louder' } });
    const pubSelect = screen.getByTestId('team-pub-select');
    await waitFor(() => expect(pubSelect).toBeEnabled());
    fireEvent.change(pubSelect, { target: { value: 'pub2' } });
    fireEvent.change(pubSelect, { target: { value: 'pub1' } });
    fireEvent.click(screen.getByTestId('team-pub-primary-pub1'));
    expect(screen.getByTestId('team-preview-pub')).toHaveTextContent('The Golden Lion, Žilina');
    expect(screen.getByTestId('team-preview-name')).toHaveTextContent('Quiz Wolves');
    expect(within(screen.getByTestId('team-preview')).getByTestId('team-emblem')).toHaveAttribute('data-badge', 'crown');

    fireEvent.click(screen.getByTestId('team-create-submit'));
    await screen.findByTestId('team-created-dialog');
    expect(apiPost).toHaveBeenCalledWith(
      '/registered-teams',
      {
        name: 'Quiz Wolves',
        description: 'Howl louder',
        badge: 'crown',
        color: 'green',
        expectedMembers: 5,
        pubIds: ['pub2', 'pub1'],
        primaryPubId: 'pub1',
      },
      'captain-jwt',
    );
    fireEvent.click(screen.getByTestId('team-created-continue'));
    expect(await screen.findByTestId('team-dashboard')).toBeInTheDocument();
  });

  it('saves the captain name given while creating the team', async () => {
    renderTeam();
    fireEvent.change(await screen.findByTestId('team-name-input'), { target: { value: 'Quiz Wolves' } });
    fireEvent.change(screen.getByTestId('onboarding-captain-name'), { target: { value: 'Peter Kováč' } });
    await waitFor(() => expect(screen.getByTestId('team-name-status')).toHaveAttribute('data-status', 'available'));
    fireEvent.click(screen.getByTestId('team-create-submit'));

    await screen.findByTestId('team-created-dialog');
    expect(apiPatch).toHaveBeenCalledWith('/me', { displayName: 'Peter Kováč' }, 'captain-jwt');
  });

  it('will not create a team whose name is taken', async () => {
    renderTeam();
    fireEvent.change(await screen.findByTestId('team-name-input'), { target: { value: 'Pub Mozarts' } });
    await waitFor(() => expect(screen.getByTestId('team-name-status')).toHaveAttribute('data-status', 'taken'));
    expect(screen.getByTestId('team-create-submit')).toBeDisabled();
  });
});

describe('team dashboard', () => {
  beforeEach(() => {
    data.teams = [TEAM];
  });

  it('shows the team profile and roster', async () => {
    renderTeam();
    expect(await screen.findByTestId('team-name')).toHaveTextContent('Wise Ducks');
    expect(screen.getByTestId('team-pub')).toHaveTextContent('The Golden Lion, Žilina');
    expect(await screen.findByText('Jana')).toBeInTheDocument();
    expect(screen.getByTestId('roster-count')).toHaveTextContent('1 / 6');
  });

  it('lets the captain set a name, shown instead of the e-mail', async () => {
    renderTeam();
    expect(await screen.findByTestId('captain-name')).toHaveTextContent('captain@example.com');

    fireEvent.click(screen.getByTestId('captain-rename'));
    fireEvent.change(screen.getByTestId('captain-name-input'), { target: { value: 'Peter Kováč' } });
    fireEvent.click(screen.getByTestId('captain-name-save'));

    await waitFor(() => expect(screen.getByTestId('captain-name')).toHaveTextContent('Peter Kováč'));
    expect(apiPatch).toHaveBeenCalledWith('/me', { displayName: 'Peter Kováč' }, 'captain-jwt');
    expect(screen.getByTestId('roster-captain')).toHaveTextContent('captain@example.com');
    expect(screen.getByTestId('team-captain-chip')).toHaveTextContent('Peter Kováč');
  });

  it('keeps the team PIN hidden until asked, and replaces it on request', async () => {
    renderTeam();
    const pin = await screen.findByTestId('team-pin-value');
    await waitFor(() => expect(pin).toHaveTextContent('••••••'));

    fireEvent.click(pin);
    expect(pin).toHaveTextContent('482915');
    fireEvent.click(screen.getByTestId('team-pin-rotate'));
    await waitFor(() => expect(pin).toHaveTextContent('000111'));
    expect(apiPost).toHaveBeenCalledWith('/registered-teams/rt1/access/rotate', { what: 'pin' }, 'captain-jwt');
  });

  it('shares the invite link, and a new link replaces it', async () => {
    renderTeam();
    fireEvent.click(await screen.findByTestId('team-share-open'));

    await waitFor(() => expect(screen.getByTestId('share-team-url')).toHaveTextContent('/join-team/invite-token-1234567'));
    fireEvent.click(screen.getByTestId('share-team-rotate'));
    await waitFor(() => expect(screen.getByTestId('share-team-url')).toHaveTextContent('/join-team/invite-token-new-7654321'));
    expect(apiPost).toHaveBeenCalledWith('/registered-teams/rt1/access/rotate', { what: 'invite' }, 'captain-jwt');
  });

  it('adds, renames and removes players', async () => {
    renderTeam();
    await screen.findByText('Jana');

    fireEvent.click(screen.getByTestId('roster-add-open'));
    fireEvent.change(screen.getByTestId('roster-new-name'), { target: { value: 'Peter' } });
    fireEvent.click(screen.getByTestId('roster-add-submit'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/registered-teams/rt1/players', { name: 'Peter' }, 'captain-jwt'));

    fireEvent.click(screen.getByTestId('roster-rename-p1'));
    fireEvent.change(screen.getByTestId('roster-rename-input'), { target: { value: 'Jana K.' } });
    fireEvent.submit(screen.getByTestId('roster-rename-input'));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/registered-teams/rt1/players/p1', { name: 'Jana K.' }, 'captain-jwt'));

    fireEvent.click(await screen.findByTestId('roster-remove-p1'));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/registered-teams/rt1/players/p1', 'captain-jwt'));
  });

  it('joins a live quiz under the team name', async () => {
    renderTeam();
    fireEvent.change(await screen.findByTestId('team-join-code'), { target: { value: 'a7f3' } });
    fireEvent.submit(screen.getByTestId('team-join-form'));

    await screen.findByText('play screen');
    expect(apiPost).toHaveBeenCalledWith('/registered-teams/rt1/sessions/s1/join', {}, 'captain-jwt');
    expect(JSON.parse(localStorage.getItem('quizicius:team:s1')!)).toMatchObject({ teamId: 'session-team', token: 'team-token' });
  });

  it('edits the team profile, keeping its own name allowed', async () => {
    renderTeam();
    fireEvent.click(await screen.findByTestId('team-edit-open'));
    const dialog = screen.getByTestId('edit-team-dialog');
    await waitFor(() => expect(within(dialog).getByTestId('team-name-status')).toHaveAttribute('data-status', 'available'));
    await waitFor(() => expect(within(dialog).getByTestId('team-pub-select')).toBeEnabled());
    fireEvent.change(within(dialog).getByTestId('team-pub-select'), { target: { value: 'pub2' } });
    fireEvent.click(within(dialog).getByTestId('edit-save'));

    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith(
        '/registered-teams/rt1',
        {
          name: 'Wise Ducks',
          description: 'We come, we win',
          badge: 'brain',
          color: 'amber',
          expectedMembers: 4,
          pubIds: ['pub1', 'pub2'],
          primaryPubId: 'pub1',
        },
        'captain-jwt',
      ),
    );
  });
});

describe('team pubs picker', () => {
  beforeEach(() => {
    data.teams = [TEAM];
  });

  it('moves the home pub to the next pub when the home pub is removed', async () => {
    renderTeam();
    fireEvent.click(await screen.findByTestId('team-edit-open'));
    const dialog = screen.getByTestId('edit-team-dialog');
    await waitFor(() => expect(within(dialog).getByTestId('team-pub-select')).toBeEnabled());
    fireEvent.change(within(dialog).getByTestId('team-pub-select'), { target: { value: 'pub2' } });
    fireEvent.click(within(dialog).getByTestId('team-pub-remove-pub1'));

    const chips = within(dialog).getAllByTestId('team-pub-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveAttribute('data-primary', 'true');
    expect(chips[0]).toHaveTextContent('Black Dog, Bratislava');
  });
});

describe('team leagues', () => {
  function teamLeague(status: TeamLeagueDto['status']): TeamLeagueDto {
    return {
      status,
      league: {
        id: 'l1',
        name: 'Zimná liga Žilina',
        kind: 'LEAGUE',
        phase: 'RUNNING',
        startsOn: '2027-01-12',
        endsOn: '2027-03-30',
        message: 'Finále v Hoffmane',
        ownerHostId: 'h1',
        ownerName: 'Daniel N.',
        pubs: [{ id: 'pub1', name: 'The Golden Lion', city: 'Žilina', hostId: 'h1' }],
        nightsPlayed: 2,
        joinedTeams: 6,
        parentLeagueId: null,
      },
      standings: [{ rank: 1, registeredTeamId: 'rt1', teamName: 'Wise Ducks', pubId: 'pub1', points: 18, nights: 2, placements: [1, 2] }],
    };
  }

  it('shows an invitation and joins the league from it', async () => {
    data.teams = [TEAM];
    data.leagues = [teamLeague('INVITED')];
    renderTeam();

    const invite = await screen.findByTestId('team-league-invite-l1');
    expect(invite).toHaveTextContent('Zimná liga Žilina');
    expect(invite).toHaveTextContent('The Golden Lion');
    expect(invite).toHaveTextContent('12. 1. 2027');
    expect(invite).toHaveTextContent('Finále v Hoffmane');
    fireEvent.click(screen.getByTestId('team-league-join-l1'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/registered-teams/rt1/leagues/l1/join', {}, 'captain-jwt'));
    expect(await screen.findByTestId('team-league-l1')).toHaveTextContent('18');
    expect(screen.queryByTestId('team-league-invite-l1')).not.toBeInTheDocument();
  });

  it('shows the standings of a joined league with the own team highlighted', async () => {
    data.teams = [TEAM];
    data.leagues = [teamLeague('JOINED')];
    renderTeam();

    const block = await screen.findByTestId('team-league-l1');
    expect(within(block).getByTestId('standing-rt1')).toHaveClass('bg-primary-container/20');
  });

  it('hides a declined league', async () => {
    data.teams = [TEAM];
    data.leagues = [teamLeague('DECLINED')];
    renderTeam();

    await screen.findByTestId('team-dashboard');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/registered-teams/rt1/leagues', 'captain-jwt'));
    expect(screen.queryByTestId('team-league-l1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-league-invite-l1')).not.toBeInTheDocument();
  });
});

describe('registering from a league night', () => {
  const CLAIM = { sessionId: 's1', teamId: 'team-1', token: 'team-token', teamName: 'Wise Ducks' };

  it("links the phone's seat to the captain's team and goes back to the game", async () => {
    data.teams = [TEAM];
    sessionStorage.setItem('quizicius:pending-claim', JSON.stringify(CLAIM));
    renderTeam();

    expect(await screen.findByText('play screen')).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith('/registered-teams/rt1/sessions/s1/claim', { teamToken: 'team-token' }, 'captain-jwt');
    expect(sessionStorage.getItem('quizicius:pending-claim')).toBeNull();
  });

  it('suggests the name the team played under when it creates its team first', async () => {
    sessionStorage.setItem('quizicius:pending-claim', JSON.stringify(CLAIM));
    renderTeam();

    expect(await screen.findByTestId('team-name-input')).toHaveValue('Wise Ducks');
  });

  it('explains when the quiz has already started, with a way back to the game', async () => {
    data.teams = [TEAM];
    data.claimError = new ApiError(409, 'Conflict', { code: 'REGISTRATION_CLOSED' });
    sessionStorage.setItem('quizicius:pending-claim', JSON.stringify(CLAIM));
    renderTeam();

    const notice = await screen.findByTestId('team-claim-error');
    expect(notice).toHaveTextContent('registrácia do ligy je uzavretá');
    expect(within(notice).getByRole('link')).toHaveAttribute('href', '/play/s1');
  });
});

describe('team invite link', () => {
  const renderInvite = (token = 'invite-token-1234567') =>
    render(
      <I18nProvider>
        <MemoryRouter initialEntries={[`/join-team/${token}`]}>
          <Routes>
            <Route path="/join-team/:inviteToken" element={<InvitePage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

  it('puts a teammate on the roster without an account', async () => {
    renderInvite();
    expect(await screen.findByTestId('team-invite-name')).toHaveTextContent('Wise Ducks');

    fireEvent.change(screen.getByTestId('team-invite-player'), { target: { value: ' Peter ' } });
    fireEvent.click(screen.getByTestId('team-invite-submit'));

    expect(await screen.findByTestId('team-invite-joined')).toHaveTextContent('Wise Ducks');
    expect(apiPost).toHaveBeenCalledWith('/team-access/invite/invite-token-1234567/players', { name: 'Peter' });
  });

  it('says when the link no longer works', async () => {
    renderInvite('old-token');
    expect(await screen.findByTestId('team-invite-error')).toBeInTheDocument();
  });
});
