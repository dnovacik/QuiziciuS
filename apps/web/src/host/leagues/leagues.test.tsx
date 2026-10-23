import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AccountDto, HostLeagueDto, InvitableHostDto, LeagueDetailDto, LeagueStandingDto } from '@quizicius/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../../lib/api-client';
import { I18nProvider } from '../../lib/i18n';
import HostApp from '../HostApp';

vi.mock('../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));
vi.mock('../../lib/supabase-client', () => ({
  supabase: { auth: { signOut: vi.fn(), updateUser: vi.fn() } },
  subscribeToSession: vi.fn(() => vi.fn()),
  pendingPasswordLink: () => null,
  clearPendingPasswordLink: vi.fn(),
}));
vi.mock('../../lib/use-host-session', () => ({
  useHostSession: () => ({ loading: false, token: 'jwt', session: { user: { email: 'me@example.com' } } }),
}));

const ME: AccountDto = {
  id: 'me',
  email: 'me@example.com',
  displayName: 'Me',
  role: 'HOST',
  deactivated: false,
  subscription: { status: 'ACTIVE', until: '2099-12-31', forever: false },
};
const HOFFMAN = { id: 'pub-h', name: 'KC Hoffman', city: 'Žilina' };
const MAMUT = { id: 'pub-m', name: 'Pub U Mamuta', city: 'Žilina' };

function league(overrides: Partial<HostLeagueDto> = {}): HostLeagueDto {
  return {
    id: 'l1',
    name: 'Zimná liga Žilina',
    kind: 'LEAGUE',
    phase: 'RUNNING',
    startsOn: '2027-01-12',
    endsOn: '2027-03-30',
    message: 'Finále v Hoffmane',
    ownerHostId: 'me',
    ownerName: 'Me',
    pubs: [{ ...HOFFMAN, hostId: 'me' }],
    nightsPlayed: 4,
    joinedTeams: 12,
    parentLeagueId: null,
    myStatus: 'ACCEPTED',
    isOwner: true,
    ...overrides,
  };
}

function standing(rank: number, teamName: string, points: number, pubId = HOFFMAN.id): LeagueStandingDto {
  return { rank, registeredTeamId: `t-${teamName}`, teamName, pubId, points, nights: 4, placements: [1, 2, 1, 3] };
}

function detail(overrides: Partial<LeagueDetailDto> = {}): LeagueDetailDto {
  return {
    ...league(),
    hosts: [{ id: 'me', name: 'Me', status: 'ACCEPTED' }],
    teams: [],
    standings: [standing(1, 'Tim bez pala', 34), standing(2, 'Wise Ducks', 33)],
    qualified: [],
    superLeagueId: null,
    endedAwaitingClose: false,
    ...overrides,
  };
}

const data = vi.hoisted(() => ({
  leagues: [] as HostLeagueDto[],
  detail: null as LeagueDetailDto | null,
  hosts: [] as InvitableHostDto[],
}));

function renderAt(path: string) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/host/*" element={<HostApp />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  data.leagues = [league()];
  data.detail = detail();
  data.hosts = [{ id: 'co', name: 'Peter K.', pubs: [MAMUT] }];
  vi.mocked(apiGet)
    .mockReset()
    .mockImplementation(async (path: string) => {
      if (path === '/me') return ME;
      if (path === '/host/sessions') return [];
      if (path === '/host/pubs') return [HOFFMAN];
      if (path === '/leagues') return data.leagues;
      if (path === '/leagues/hosts') return data.hosts;
      if (path.startsWith('/leagues/')) return data.detail;
      throw new Error(`unexpected GET ${path}`);
    });
  vi.mocked(apiPost)
    .mockReset()
    .mockImplementation(async () => detail({ id: 'new' }));
});

describe('host leagues page', () => {
  it('lists my leagues with their phase and nights played', async () => {
    renderAt('/host/leagues');

    const card = await screen.findByTestId('league-card-l1');
    expect(card).toHaveTextContent('Zimná liga Žilina');
    expect(card).toHaveTextContent('Prebieha');
    expect(card).toHaveTextContent('4');
    expect(screen.getByTestId('host-nav-leagues')).toBeInTheDocument();
  });

  it("accepts another host's invitation with my pubs", async () => {
    data.leagues = [league({ id: 'inv', isOwner: false, myStatus: 'INVITED', ownerName: 'Peter K.' })];
    renderAt('/host/leagues');

    const invite = await screen.findByTestId('league-invite-inv');
    expect(invite).toHaveTextContent('Peter K.');
    expect(invite).toHaveTextContent('Finále v Hoffmane');
    // Accepting needs at least one of my pubs, which load separately.
    expect(await within(invite).findByLabelText('KC Hoffman, Žilina')).toBeChecked();
    fireEvent.click(within(invite).getByTestId('league-accept-inv'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/leagues/inv/hosts/me/accept', { pubIds: [HOFFMAN.id] }, 'jwt'));
  });

  it('proposes a new league with co-hosts and a message', async () => {
    renderAt('/host/leagues');

    fireEvent.click(await screen.findByTestId('league-new'));
    const dialog = await screen.findByTestId('new-league-dialog');
    fireEvent.change(within(dialog).getByTestId('new-league-name'), { target: { value: 'Jarná liga' } });
    fireEvent.change(within(dialog).getByTestId('new-league-starts'), { target: { value: '2027-04-01' } });
    fireEvent.change(within(dialog).getByTestId('new-league-ends'), { target: { value: '2027-06-30' } });
    fireEvent.click(await within(dialog).findByTestId('new-league-host-co'));
    fireEvent.change(within(dialog).getByTestId('new-league-message'), { target: { value: 'Desať večerov' } });
    fireEvent.click(within(dialog).getByTestId('new-league-submit'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        '/leagues',
        {
          name: 'Jarná liga',
          pubIds: [HOFFMAN.id],
          startsOn: '2027-04-01',
          endsOn: '2027-06-30',
          message: 'Desať večerov',
          inviteHostIds: ['co'],
        },
        'jwt',
      ),
    );
  });
});

describe('league detail', () => {
  it('shows the standings in rank order with points', async () => {
    renderAt('/host/leagues/l1');

    const table = await screen.findByTestId('standings-table');
    const rows = within(table).getAllByTestId(/^standing-/);
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining('Tim bez pala'), expect.stringContaining('Wise Ducks')]);
    expect(rows[0]).toHaveTextContent('34');
  });

  it('asks the owner to close a league whose end date has passed', async () => {
    data.detail = detail({ endedAwaitingClose: true });
    renderAt('/host/leagues/l1');

    fireEvent.click(within(await screen.findByTestId('league-close-prompt')).getByTestId('league-close'));
    fireEvent.click(within(screen.getByTestId('league-close-dialog')).getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/leagues/l1/close', {}, 'jwt'));
  });

  it('shows the qualified teams of a closed league and creates its Super League', async () => {
    data.detail = detail({ phase: 'CLOSED', qualified: [standing(1, 'Tim bez pala', 34)] });
    renderAt('/host/leagues/l1');

    expect(await screen.findByTestId('league-qualified')).toHaveTextContent('Tim bez pala');
    fireEvent.click(screen.getByTestId('league-create-super'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/leagues/l1/super-league', {}, 'jwt'));
  });
});

describe('opening the Super League', () => {
  it('does not keep showing the closed league while the new one loads', async () => {
    data.detail = detail({ phase: 'CLOSED', qualified: [standing(1, 'Tim bez pala', 34)] });
    renderAt('/host/leagues/l1');
    fireEvent.click(await screen.findByTestId('league-create-super'));
    // The Super League's own page never finishes loading in this test.
    vi.mocked(apiGet).mockImplementation(async (path: string) => (path === '/leagues/new' ? new Promise(() => {}) : ME));

    await waitFor(() => expect(screen.queryByTestId('league-qualified')).not.toBeInTheDocument());
    expect(screen.queryByTestId('league-create-super')).not.toBeInTheDocument();
  });
});
