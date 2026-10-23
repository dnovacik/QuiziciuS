import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPost } from '../lib/api-client';
import { I18nProvider } from '../lib/i18n';
import { supabase } from '../lib/supabase-client';
import { LandingPage } from './LandingPage';

vi.mock('../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api-client')>()),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));
vi.mock('../lib/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

const auth = vi.mocked(supabase.auth);

function renderLanding() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/host" element={<p>host area</p>} />
          <Route path="/team" element={<p>team hub</p>} />
          <Route path="/play/:sessionId" element={<p>play area</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

function type(testId: string, value: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('LandingPage host card', () => {
  it('shows the shared logo linking home', () => {
    renderLanding();
    expect(screen.getByTestId('logo')).toHaveAttribute('href', '/');
  });

  it('signs a host in and opens the host area', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);
    renderLanding();
    type('host-email', 'host@example.com');
    type('host-password', 'secret1');
    fireEvent.submit(screen.getByTestId('host-auth-form'));

    await screen.findByText('host area');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'host@example.com', password: 'secret1' });
  });

  it('shows the Supabase error when sign in fails', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error('Invalid login credentials') } as never);
    renderLanding();
    type('host-email', 'host@example.com');
    type('host-password', 'wrong-1');
    fireEvent.submit(screen.getByTestId('host-auth-form'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
  });

  it('asks for email confirmation when registration returns no session', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null } as never);
    renderLanding();
    fireEvent.click(screen.getByTestId('host-tab-register'));
    type('host-email', 'new@example.com');
    type('host-password', 'secret1');
    fireEvent.submit(screen.getByTestId('host-auth-form'));

    expect(await screen.findByRole('status')).toHaveTextContent('Potvrďte e-mail');
  });

  it('sends a password reset link from the recovery mode', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);
    renderLanding();
    fireEvent.click(screen.getByTestId('host-forgot-password'));
    expect(screen.queryByTestId('host-password')).not.toBeInTheDocument();
    type('host-email', 'host@example.com');
    fireEvent.submit(screen.getByTestId('host-auth-form'));

    await screen.findByRole('status');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('host@example.com');
  });

  it('renders unsupported Stitch features disabled and flagged', () => {
    renderLanding();
    const social = document.querySelector('[data-pending-feature="social-login"]');
    expect(social).toBeDisabled();
    expect(within(social as HTMLElement).getByText('Čoskoro')).toBeInTheDocument();
  });

  it('switches the interface to English', () => {
    renderLanding();
    fireEvent.click(screen.getByTestId('language-switcher'));
    fireEvent.click(screen.getByTestId('language-en'));
    expect(screen.getByRole('heading', { name: 'Host sign in' })).toBeInTheDocument();
  });
});

describe('LandingPage team entrance', () => {
  function openTeamEntry() {
    renderLanding();
    fireEvent.click(screen.getByTestId('open-team-entry'));
    return screen.getByTestId('team-entry-modal');
  }

  it('joins a live quiz by code and remembers the team seat', async () => {
    vi.mocked(apiGet).mockResolvedValue({ id: 'session-1' });
    vi.mocked(apiPost).mockResolvedValue({ teamId: 'team-1', token: 'team-token' });
    openTeamEntry();
    type('team-code', 'a7-f3');
    expect(screen.getByTestId('team-code')).toHaveValue('A7F3');
    type('team-name', ' Quiz Wolves ');
    fireEvent.submit(screen.getByTestId('team-quick-form'));

    await screen.findByText('play area');
    expect(apiGet).toHaveBeenCalledWith('/sessions/by-code/A7F3');
    expect(apiPost).toHaveBeenCalledWith('/sessions/session-1/teams/join', { name: 'Quiz Wolves' });
    expect(JSON.parse(localStorage.getItem('quizicius:team:session-1') ?? '{}')).toEqual({
      sessionId: 'session-1',
      teamId: 'team-1',
      token: 'team-token',
    });
  });

  it('registers a captain, creates the team and opens the team hub', async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: 'captain-jwt' } }, error: null } as never);
    vi.mocked(apiPost).mockResolvedValue({ id: 'registered-1' });
    openTeamEntry();
    fireEvent.click(screen.getByTestId('team-tab-register'));
    type('team-register-name', 'Pub Geniuses');
    type('team-register-email', 'captain@example.com');
    type('team-register-password', 'secret1');
    fireEvent.change(screen.getByTestId('team-register-members'), { target: { value: '5' } });
    fireEvent.submit(screen.getByTestId('team-register-form'));

    await screen.findByText('team hub');
    expect(apiPost).toHaveBeenCalledWith('/registered-teams', { name: 'Pub Geniuses', expectedMembers: 5 }, 'captain-jwt');
  });

  it('signs a captain in to the team hub', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);
    openTeamEntry();
    fireEvent.click(screen.getByTestId('team-tab-login'));
    type('team-login-email', 'captain@example.com');
    type('team-login-password', 'secret1');
    fireEvent.submit(screen.getByTestId('team-login-form'));

    await screen.findByText('team hub');
  });

  it('closes on Escape and hands over to the host card', async () => {
    openTeamEntry();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('team-entry-modal')).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId('host-card-team-entry'));
    fireEvent.click(screen.getByTestId('team-switch-host'));
    expect(screen.queryByTestId('team-entry-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('host-auth-card')).toHaveClass('ring-2');
  });
});
