import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase-client';
import LoginScreen from './LoginScreen';

vi.mock('../lib/supabase-client', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const signIn = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>;
const signUp = supabase.auth.signUp as ReturnType<typeof vi.fn>;

beforeEach(() => {
  signIn.mockReset().mockResolvedValue({ error: null });
  signUp.mockReset().mockResolvedValue({ error: null });
});

describe('LoginScreen', () => {
  it('submits email and password to Supabase Auth', async () => {
    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'host@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(signIn).toHaveBeenCalledWith({
      email: 'host@example.com',
      password: 'hunter2',
    });
  });

  it('shows the error message on a failed sign-in', async () => {
    signIn.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } });
    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'host@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  it('creates an account through the sign-up mode toggle', async () => {
    render(<LoginScreen />);

    fireEvent.click(screen.getByRole('button', { name: /need an account/i }));
    expect(screen.getByRole('heading', { name: 'Host sign up' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'hunter2' });
    expect(signIn).not.toHaveBeenCalled();
    expect(await screen.findByText(/account created/i)).toBeInTheDocument();
  });

  it('shows the error message on a failed sign-up', async () => {
    signUp.mockResolvedValueOnce({ error: { message: 'Password too short' } });
    render(<LoginScreen />);

    fireEvent.click(screen.getByRole('button', { name: /need an account/i }));
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText('Password too short')).toBeInTheDocument();
  });
});
