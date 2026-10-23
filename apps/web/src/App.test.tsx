import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App, { AppRoutes } from './App';

// Every sibling suite mocks these two modules; without them this file's lazy-route
// tests reach the network from inside jsdom (supabase.auth.getSession(), a fetch to
// the API base URL, and a real WebSocket connection attempt), which is what made the
// waitFor assertions below flake intermittently.
vi.mock('./lib/api-client', () => ({ apiGet: vi.fn(() => new Promise(() => {})), apiPost: vi.fn() }));
vi.mock('./lib/supabase-client', () => ({
  subscribeToSession: vi.fn(() => vi.fn()),
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

describe('App', () => {
  it('renders the fallback route at an unmatched path', () => {
    render(<App />);
    expect(screen.getByTestId('logo')).toHaveAttribute('href', '/');
  });
});

describe('AppRoutes', () => {
  it('resolves / to the landing page with host/join links', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('focus-host-login')).toBeInTheDocument();
    expect(screen.getByTestId('open-team-entry')).toBeInTheDocument();
  });

  it('resolves an unknown path to the landing page too', () => {
    render(
      <MemoryRouter initialEntries={['/something-unexpected']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('focus-host-login')).toBeInTheDocument();
  });

  it('resolves /host/* to the host app', async () => {
    render(
      <MemoryRouter initialEntries={['/host']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('host-app')).toBeInTheDocument());
  });

  it('resolves /projector/:sessionId to the projector app', async () => {
    render(
      <MemoryRouter initialEntries={['/projector/session-123']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('projector-app')).toBeInTheDocument());
  });

  it('resolves /play/:sessionId to the play app', async () => {
    render(
      <MemoryRouter initialEntries={['/play/session-123']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('play-app')).toBeInTheDocument());
  });
});
