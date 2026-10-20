import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from './lib/i18n';
import { LandingPage } from './LandingPage';

vi.mock('./lib/supabase-client', () => ({
  supabase: { auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
  } },
}));

describe('StitchLanding', () => {
  beforeEach(() => localStorage.clear());
  function setup() {
    render(<I18nProvider><MemoryRouter><LandingPage /></MemoryRouter></I18nProvider>);
  }
  it('renders host auth and a team entry without depending on translation', () => {
    setup();
    expect(screen.getByTestId('stitch-landing')).toBeInTheDocument();
    expect(screen.getByTestId('host-auth-form')).toBeInTheDocument();
    expect(screen.getByTestId('landing-logo')).toHaveAttribute('href', '/');
    fireEvent.click(screen.getByTestId('landing-team-entry'));
    expect(screen.getByTestId('stitch-team-modal')).toBeInTheDocument();
    expect(screen.getByTestId('team-code')).toHaveAttribute('maxLength', '4');
    expect(screen.getByTestId('team-name')).toBeInTheDocument();
    expect(screen.getByTestId('team-table')).toBeInTheDocument();
    expect(screen.getByTestId('team-load-qr')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-tab-register'));
    expect(screen.getByTestId('team-register-email')).toBeInTheDocument();
    expect(screen.getByTestId('team-register-password')).toBeInTheDocument();
    expect(screen.getByTestId('team-register-members')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('stitch-team-close'));
    expect(screen.queryByTestId('stitch-team-modal')).not.toBeInTheDocument();
  });
  it('switches registration and sign in and persists locale', () => {
    setup();
    fireEvent.click(screen.getByTestId('host-register-tab'));
    expect(screen.getByTestId('host-auth-submit')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('stitch-language-toggle'));
    fireEvent.click(screen.getByTestId('locale-en'));
    expect(localStorage.getItem('quizicius:locale')).toBe('en');
    fireEvent.click(screen.getByTestId('host-login-tab'));
    fireEvent.click(screen.getByTestId('host-forgot-password'));
    expect(screen.queryByTestId('host-password')).not.toBeInTheDocument();
  });
  it('submits host signup to Supabase and displays confirmation', async () => {
    const { supabase } = await import('./lib/supabase-client');
    setup();
    fireEvent.click(screen.getByTestId('host-register-tab'));
    fireEvent.change(screen.getByTestId('host-email'), { target: { value: 'captain@example.com' } });
    fireEvent.change(screen.getByTestId('host-password'), { target: { value: 'long-password' } });
    fireEvent.submit(screen.getByTestId('host-auth-form'));
    await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalledWith({ email: 'captain@example.com', password: 'long-password' }));
    expect(await screen.findByTestId('host-auth-feedback')).toBeInTheDocument();
  });
});
