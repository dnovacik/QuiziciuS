import type { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';

/**
 * Stitch designs include features the backend cannot serve yet. Each one is registered here
 * and documented in docs/STITCH_GAPS.md; the UI renders it disabled with a "Soon" badge.
 * Set VITE_HIDE_PENDING_FEATURES=true to remove all of them from the UI at once.
 */
export const PENDING_FEATURES = {
  'social-login': 'Google / Microsoft sign-in — Supabase OAuth providers are not configured.',
  'remember-me': 'Opt-out of session persistence — Supabase always persists the session.',
  'table-number': 'Table number on quick join — teams have no table column.',
  'qr-scanner': 'In-app QR scanner on the join screen — phones can scan the projector QR with the camera app meanwhile.',
  'answer-dispute': 'Team-initiated dispute of a graded answer — only automatic free-text review exists.',
  'result-certificate': 'Downloadable result certificate for a finished quiz.',
  leagues: 'Leagues and venues section of the host app.',
  'host-settings': 'Host account / venue settings page.',
  notifications: 'Host notifications (new teams, disputes) in the top bar.',
  'team-ratings': 'Team satisfaction ratings after a quiz night.',
  'scheduled-sessions': 'Planning quiz nights ahead with a date, venue and table capacity.',
  venues: 'Venue selection when launching a session or editing a quiz.',
  'quiz-default-timer': 'Default answer time per quiz, applied to new questions.',
  'numeric-unit': 'Unit suffix for numeric questions (years, km, %).',
  'timer-controls': 'Pausing, extending or stopping the answer timer early, and a host pause for everyone.',
  'session-archive': 'Archiving a finished session into league tables.',
  'pub-leaderboard': 'Pub / league leaderboard for registered teams.',
  'team-invite-link': 'Invite link or e-mail for teammates to join a registered team.',
  'team-access-pin': 'Team access PIN so teammates can play as the registered team.',
} as const;

export type PendingFeature = keyof typeof PENDING_FEATURES;

const HIDDEN = import.meta.env.VITE_HIDE_PENDING_FEATURES === 'true';

/**
 * `badge="corner"` pins the badge to the top-right edge (blocks, buttons);
 * `badge="inline"` places it after the content (small controls like a checkbox row).
 */
export function Pending({
  feature,
  children,
  badge = 'corner',
  className = '',
}: {
  feature: PendingFeature;
  children: ReactNode;
  badge?: 'corner' | 'inline';
  className?: string;
}) {
  const { t } = useI18n();
  if (HIDDEN) return null;

  const layout = badge === 'inline' ? 'flex items-center gap-2' : 'relative';
  const position = badge === 'inline' ? '' : 'absolute -top-2 right-2';
  return (
    <fieldset
      disabled
      data-pending-feature={feature}
      title={t('common.notAvailableYet')}
      className={`m-0 min-w-0 border-0 p-0 ${layout} ${className}`}
    >
      <div className="opacity-50">{children}</div>
      <span
        className={`pointer-events-none rounded-full border border-amber-500/40 bg-amber-950/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 ${position}`}
      >
        {t('common.soon')}
      </span>
    </fieldset>
  );
}
