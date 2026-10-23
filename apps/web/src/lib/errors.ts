import { ApiError } from './api-client';
import { isTranslationKey, type Translate, type TranslationKey } from './i18n';

/**
 * Turns anything thrown by the API client or Supabase into text for the user.
 * API errors that carry a `code` (e.g. NAME_TAKEN) are translated via `errors.<code>`.
 */
export function describeError(error: unknown, t: Translate, fallback: TranslationKey): string {
  if (error instanceof ApiError) {
    const key = `errors.${String(error.body.code)}`;
    if (isTranslationKey(key)) return t(key);
    return error.message && error.message !== 'Request failed' ? error.message : t(fallback);
  }
  if (error instanceof Error && error.message) return error.message;
  return t(fallback);
}
