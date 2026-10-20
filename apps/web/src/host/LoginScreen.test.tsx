import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase-client';
import LoginScreen from './LoginScreen';

vi.mock('../lib/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

const signIn = vi.mocked(supabase.auth.signInWithPassword);
const signUp = vi.mocked(supabase.auth.signUp);
const resetPassword = vi.mocked(supabase.auth.resetPasswordForEmail);

function renderLogin() {
  return render(<MemoryRouter><LoginScreen /></MemoryRouter>);
}

function fillCredentials(email = 'host@example.com', password = 'hunter2') {
  fireEvent.change(screen.getByTestId('host-email'), { target: { value: email } });
  fireEvent.change(screen.getByTestId('host-password'), { target: { value: password } });
}

beforeEach(() => {
  vi.clearAllMocks();
  signIn.mockResolvedValue({ error: null } as never);
  signUp.mockResolvedValue({ data: { session: null }, error: null } as never);
  resetPassword.mockResolvedValue({ data: {}, error: null } as never);
  localStorage.clear();
});

describe('LoginScreen', () => {
  it('submits host credentials to Supabase', async () => {
    renderLogin();
    fillCredentials();
    fireEvent.submit(screen.getByTestId('host-auth-form'));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith({ email: 'host@example.com', password: 'hunter2' }));
  });

  it('shows sign-in errors', async () => {
    signIn.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } } as never);
    renderLogin();
    fillCredentials();
    fireEvent.submit(screen.getByTestId('host-auth-form'));
    expect(await screen.findByTestId('host-auth-feedback')).toHaveTextContent('Invalid credentials');
  });

  it('registers hosts via signup mode', async () => {
    renderLogin();
    fireEvent.click(screen.getByTestId('host-register-tab'));
    fillCredentials('new@example.com');
    fireEvent.submit(screen.getByTestId('host-auth-form'));
    await waitFor(() => expect(signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'hunter2' }));
    expect(signIn).not.toHaveBeenCalled();
    expect(await screen.findByTestId('host-auth-feedback')).toBeInTheDocument();
  });

  it('shows signup errors', async () => {
    signUp.mockResolvedValueOnce({ error: { message: 'Email already registered' } } as never);
    renderLogin();
    fireEvent.click(screen.getByTestId('host-register-tab'));
    fillCredentials();
    fireEvent.submit(screen.getByTestId('host-auth-form'));
    expect(await screen.findByTestId('host-auth-feedback')).toHaveTextContent('Email already registered');
  });

  it('sends password reset email', async () => {
    renderLogin();
    fireEvent.click(screen.getByTestId('host-forgot-password'));
    fireEvent.change(screen.getByTestId('host-email'), { target: { value: 'host@example.com' } });
    fireEvent.submit(screen.getByTestId('host-auth-form'));
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('host@example.com'));
  });
});
