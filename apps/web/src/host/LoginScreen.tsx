import { FormEvent, useState } from 'react';
import { supabase } from '../lib/supabase-client';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) setError(signUpError.message);
      else setNotice('Account created. Check your email if confirmation is required, then sign in.');
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
    }
    setSubmitting(false);
  }

  function toggleMode(): void {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setNotice(null);
  }

  const submitLabel = mode === 'signup' ? 'Sign up' : 'Sign in';
  const pendingLabel = mode === 'signup' ? 'Signing up…' : 'Signing in…';

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-24 flex max-w-sm flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{mode === 'signup' ? 'Host sign up' : 'Host sign in'}</h1>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="rounded border px-3 py-2"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="rounded border px-3 py-2"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      <button type="submit" disabled={submitting} className="rounded bg-slate-900 px-4 py-2 text-white">
        {submitting ? pendingLabel : submitLabel}
      </button>
      <button type="button" onClick={toggleMode} className="text-sm text-slate-600 underline">
        {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
      </button>
    </form>
  );
}
