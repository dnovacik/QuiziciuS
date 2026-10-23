import { useCallback, useEffect, useState } from 'react';
import type { AccountDto } from '@quizicius/shared-types';
import { apiGet } from './api-client';

/** The signed-in account and its role (GET /me); null while loading or signed out. */
export function useAccount(token: string | null) {
  const [account, setAccount] = useState<AccountDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const reload = useCallback(() => {
    if (!token) {
      setAccount(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGet<AccountDto>('/me', token)
      .then((row) => {
        setAccount(row);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [token]);
  useEffect(reload, [reload]);

  return { account, error, loading, reload };
}
