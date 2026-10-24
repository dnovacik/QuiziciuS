import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { supabase } from '../lib/supabase-client';
import { GoogleButton } from './GoogleButton';

vi.mock('../lib/supabase-client', () => ({ supabase: { auth: { signInWithOAuth: vi.fn() } } }));

const renderButton = (onError = vi.fn()) =>
  render(
    <I18nProvider>
      <GoogleButton returnPath="/host/remote/s1" onError={onError} />
    </I18nProvider>,
  );

describe('GoogleButton', () => {
  it('goes to Google and comes back to the page it was opened on', async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com' },
      error: null,
    });
    renderButton();

    fireEvent.click(screen.getByTestId('google-sign-in'));

    await waitFor(() =>
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/host/remote/s1` },
      }),
    );
  });

  it('says so when Google sign-in is not set up', async () => {
    const onError = vi.fn();
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: 'google', url: null },
      error: new Error('Unsupported provider: provider is not enabled'),
    } as never);
    renderButton(onError);

    fireEvent.click(screen.getByTestId('google-sign-in'));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(screen.getByTestId('google-sign-in')).toBeEnabled();
  });
});
