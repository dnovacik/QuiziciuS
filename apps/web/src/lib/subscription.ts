import { SUBSCRIPTION_WARNING_DAYS, type SubscriptionDto } from '@quizicius/shared-types';
import type { Locale } from './i18n';

/** Today as `YYYY-MM-DD` in Slovak time, the calendar subscriptions are counted in. */
export function slovakToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava' }).format(now);
}

/** Whole days from today until the last subscribed day (0 = ends today). */
export function daysLeft(until: string, now: Date = new Date()): number {
  return Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${slovakToday(now)}T00:00:00Z`)) / 86_400_000);
}

/** What the host should be told: nothing, that it ends soon, or that it has run out. */
export function subscriptionNotice(subscription: SubscriptionDto | null, now: Date = new Date()): 'ending' | 'expired' | null {
  if (!subscription || subscription.status === 'FOREVER') return null;
  if (subscription.status === 'EXPIRED') return 'expired';
  return subscription.until && daysLeft(subscription.until, now) < SUBSCRIPTION_WARNING_DAYS ? 'ending' : null;
}

/** `2026-11-30` → "30. 11. 2026" / "30 Nov 2026". */
export function formatDay(day: string, locale: Locale): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
}
