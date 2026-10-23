import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AccountDto } from '@quizicius/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client';
import { I18nProvider } from '../lib/i18n';
import type { AdminHost, AdminTeam } from './admin/AdminPage';
import HostApp from './HostApp';

vi.mock('../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const auth = vi.hoisted(() => ({ passwordLink: null as 'invite' | 'recovery' | null, updateUser: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({
  supabase: { auth: { signOut: vi.fn(), updateUser: auth.updateUser } },
  subscribeToSession: vi.fn(() => vi.fn()),
  pendingPasswordLink: () => auth.passwordLink,
  clearPendingPasswordLink: vi.fn(() => {
    auth.passwordLink = null;
  }),
}));
vi.mock('../lib/use-host-session', () => ({
  useHostSession: () => ({ loading: false, token: 'jwt', session: { user: { email: 'me@example.com' } } }),
}));

const data = vi.hoisted(() => ({
  me: null as AccountDto | null,
  hosts: [] as AdminHost[],
  teams: [] as AdminTeam[],
}));

function account(role: AccountDto['role'], deactivated = false): AccountDto {
  return { id: 'me', email: 'me@example.com', displayName: 'Me', role, deactivated };
}

const HOST: AdminHost = {
  id: 'h1',
  email: 'pub@example.com',
  displayName: 'Pub Host',
  role: 'HOST',
  deactivated: false,
  createdAt: '2026-10-01T18:00:00Z',
  quizCount: 3,
  sessionCount: 1,
  lastSessionAt: '2026-10-20T18:00:00Z',
};

function renderHost(path = '/host/pubs') {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/host/*" element={<HostApp />} />
          <Route path="/team" element={<p>team page</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  auth.passwordLink = null;
  auth.updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  data.me = account('HOST');
  data.hosts = [{ ...HOST, id: 'me', displayName: 'Me', role: 'SUPER_ADMIN', email: 'me@example.com' }, HOST];
  data.teams = [
    {
      id: 't1',
      name: 'Wise Ducks',
      badge: 'brain',
      badgeColor: 'amber',
      createdAt: '2026-10-02T18:00:00Z',
      captainEmail: 'cap@example.com',
      pubs: [
        { id: 'p2', name: 'Zlatý Bažant', city: 'Žilina', primary: false },
        { id: 'p1', name: 'KC Hoffman', city: 'Žilina', primary: true },
      ],
      legacyHomePub: null,
    },
  ];
  vi.mocked(apiGet)
    .mockReset()
    .mockImplementation(async (path: string) => {
      if (path === '/me') return data.me;
      if (path === '/host/sessions') return [];
      if (path === '/host/pubs') return [];
      if (path === '/admin/hosts') return data.hosts;
      if (path === '/admin/teams') return data.teams;
      throw new Error(`unexpected GET ${path}`);
    });
  vi.mocked(apiPost)
    .mockReset()
    .mockResolvedValue({ invited: true, account: account('HOST') });
  vi.mocked(apiPatch).mockReset().mockResolvedValue({});
  vi.mocked(apiDelete).mockReset().mockResolvedValue(undefined);
});

describe('host area by account role', () => {
  it('turns a team captain away from the host area', async () => {
    data.me = account('TEAM_CAPTAIN');
    renderHost();
    expect(await screen.findByTestId('not-host')).toBeInTheDocument();
    expect(screen.queryByTestId('host-pubs')).not.toBeInTheDocument();
  });

  it('lets a host in, without the administration', async () => {
    renderHost();
    expect(await screen.findByTestId('host-pubs')).toBeInTheDocument();
    expect(screen.queryByTestId('host-nav-admin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('host-deactivated')).not.toBeInTheDocument();
  });

  it('tells a deactivated host they cannot launch quiz nights', async () => {
    data.me = account('HOST', true);
    renderHost();
    expect(await screen.findByTestId('host-deactivated')).toBeInTheDocument();
  });

  it('asks an invited host to set a password first', async () => {
    auth.passwordLink = 'invite';
    renderHost();
    expect(await screen.findByTestId('set-password')).toHaveTextContent('Vitajte');
    fireEvent.change(screen.getByTestId('set-password-new'), { target: { value: 'pub-quiz-2026' } });
    fireEvent.change(screen.getByTestId('set-password-confirm'), { target: { value: 'pub-quiz-2026' } });
    fireEvent.click(screen.getByTestId('set-password-submit'));

    expect(await screen.findByTestId('host-pubs')).toBeInTheDocument();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'pub-quiz-2026' });
  });

  it('will not save mismatching passwords', async () => {
    auth.passwordLink = 'recovery';
    renderHost();
    fireEvent.change(await screen.findByTestId('set-password-new'), { target: { value: 'pub-quiz-2026' } });
    fireEvent.change(screen.getByTestId('set-password-confirm'), { target: { value: 'pub-quiz-2025' } });
    expect(screen.getByTestId('set-password-submit')).toBeDisabled();
  });
});

describe('administration', () => {
  beforeEach(() => {
    data.me = account('SUPER_ADMIN');
  });

  it('is only routed for a super admin', async () => {
    data.me = account('HOST');
    renderHost('/host/admin');
    await screen.findByTestId('host-app');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/me', 'jwt'));
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
  });

  it('lists hosts and invites a new one', async () => {
    renderHost('/host/admin');
    expect(await screen.findByTestId('host-nav-admin')).toBeInTheDocument();
    expect(await screen.findByTestId('admin-host-h1')).toHaveTextContent('3 kvízy • 1 večer');

    fireEvent.change(screen.getByTestId('invite-email'), { target: { value: 'new@pub.sk' } });
    fireEvent.change(screen.getByTestId('invite-name'), { target: { value: 'Nový moderátor' } });
    fireEvent.click(screen.getByTestId('invite-submit'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/admin/hosts', { email: 'new@pub.sk', displayName: 'Nový moderátor' }, 'jwt'),
    );
  });

  it('deactivates a host after confirmation, but offers no switch for the super admin', async () => {
    renderHost('/host/admin');
    fireEvent.click(await screen.findByTestId('admin-host-toggle-h1'));
    expect(screen.queryByTestId('admin-host-toggle-me')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('admin-host-toggle-dialog')).getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/admin/hosts/h1', { active: false }, 'jwt'));
  });

  it('shows which pubs each registered team plays at', async () => {
    renderHost('/host/admin');
    const pubs = await screen.findByTestId('admin-team-pubs-t1');
    expect(pubs).toHaveTextContent('KC Hoffman, Žilina');
    expect(pubs).toHaveTextContent('Zlatý Bažant, Žilina');
  });

  it('renames and deletes a registered team', async () => {
    renderHost('/host/admin');
    fireEvent.click(await screen.findByTestId('admin-team-rename-t1'));
    fireEvent.change(screen.getByTestId('admin-team-rename-input'), { target: { value: 'Clean Name' } });
    fireEvent.submit(screen.getByTestId('admin-team-rename-input'));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith('/admin/teams/t1', { name: 'Clean Name' }, 'jwt'));

    fireEvent.click(await screen.findByTestId('admin-team-delete-t1'));
    fireEvent.click(within(screen.getByTestId('admin-team-delete-dialog')).getByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/admin/teams/t1', 'jwt'));
  });
});
