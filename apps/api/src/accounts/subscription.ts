import { SubscriptionDto, TRIAL_DAYS } from '@quizicius/shared-types';
import { ProfilePatch, ProfileRecord } from '../data/profiles.repository';

/** Subscription days are Slovak calendar days: "until 30. 11." means through the end of that evening. */
const TIME_ZONE = 'Europe/Bratislava';

/** Today as `YYYY-MM-DD` in Slovak time. */
export function today(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

function shift(day: string, change: (date: Date) => void): string {
  const date = new Date(`${day}T12:00:00Z`);
  change(date);
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return shift(day, (date) => date.setUTCDate(date.getUTCDate() + days));
}

/** Calendar months; 31 Jan + 1 month is 28/29 Feb, not 3 March. */
export function addMonths(day: string, months: number): string {
  return shift(day, (date) => {
    const dayOfMonth = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(dayOfMonth, lastDay));
  });
}

/** Null for team captains; super admins are always FOREVER. */
export function subscriptionOf(profile: ProfileRecord, now: Date = new Date()): SubscriptionDto | null {
  if (profile.role === 'TEAM_CAPTAIN') return null;
  const until = profile.subscribed_until;
  const forever = profile.subscription_forever;
  if (profile.role === 'SUPER_ADMIN' || forever) return { status: 'FOREVER', until, forever };
  if (!until || until < today(now)) return { status: 'EXPIRED', until, forever };
  return { status: profile.subscription_trial ? 'TRIAL' : 'ACTIVE', until, forever };
}

export function canLaunchNights(subscription: SubscriptionDto | null): boolean {
  return subscription !== null && subscription.status !== 'EXPIRED';
}

/** The trial a new host starts with; someone who already had a subscription keeps it. */
export function trialFor(profile: ProfileRecord | null, now: Date = new Date()): ProfilePatch {
  if (profile?.subscribed_until || profile?.subscription_forever) return {};
  return { subscribed_until: addDays(today(now), TRIAL_DAYS), subscription_trial: true };
}
