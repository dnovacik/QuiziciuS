import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client';
import { I18nProvider } from '../lib/i18n';
import type { Player, RegisteredTeam } from './api';
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

const data = vi.hoisted(() => ({ teams: [] as RegisteredTeam[], players: [] as Player[], taken: [] as string[] }));

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
  vi.mocked(apiGet)
    .mockReset()
    .mockImplementation(async (path: string) => {
      if (path === '/registered-teams/mine') return data.teams;
      if (path.startsWith('/registered-teams/availability/')) {
        const name = decodeURIComponent(path.split('/').pop()!);
        return { available: !data.taken.includes(name), code: 'X' };
      }
      if (path === '/registered-teams/rt1/players') return data.players;
      if (path === '/pubs') return PUBS;
      if (path === '/sessions/by-code/A7F3') return { id: 's1' };
      throw new Error(`unexpected GET ${path}`);
    });
  vi.mocked(apiPost)
    .mockReset()
    .mockImplementation(async (path: string, body: unknown) => {
      if (path === '/registered-teams') return { ...TEAM, name: (body as { name: string }).name };
      if (path === '/registered-teams/rt1/players') return { id: 'p2', name: (body as { name: string }).name, created_at: 'now' };
      if (path === '/registered-teams/rt1/sessions/s1/join') return { teamId: 'session-team', token: 'team-token' };
      throw new Error(`unexpected POST ${path}`);
    });
  vi.mocked(apiPatch)
    .mockReset()
    .mockImplementation(async (_path: string, body: unknown) => ({
      ...TEAM,
      ...(body as object),
      name: (body as { name?: string }).name ?? TEAM.name,
    }));
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
