import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase-client';
import LoginScreen from './LoginScreen';

vi.mock('../lib/supabase-client', () => ({
  supabase: { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) } },
}));

describe('LoginScreen', () => {
  it('submits email and password to Supabase Auth', async () => {
    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'host@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'host@example.com',
      password: 'hunter2',
    });
  });

  it('shows the error message on a failed sign-in', async () => {
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: { message: 'Invalid credentials' },
    });
    render(<LoginScreen />);

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'host@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
