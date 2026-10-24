import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ClipboardCheck, Hourglass, Trophy, type LucideIcon } from 'lucide-react';
import type { AccountDto } from '@quizicius/shared-types';
import { useI18n } from '../lib/i18n';
import { formatDay, subscriptionNotice } from '../lib/subscription';
import { hostApi } from './api';
import { leaguesApi } from './leagues/api';

interface Notice {
  key: string;
  icon: LucideIcon;
  text: string;
  to: string;
  tone: 'secondary' | 'error' | 'tertiary';
}

/** How often the bell looks again while the host app is open. */
const REFRESH_MS = 60_000;

/**
 * What needs the host's attention right now, computed from live data rather than stored:
 * answers waiting for review in running nights, league invitations, and the subscription.
 * An item disappears once it is dealt with, so there is nothing to mark as read.
 */
export function useHostNotices(token: string, account: AccountDto) {
  const { t, locale } = useI18n();
  const [notices, setNotices] = useState<Notice[]>([]);

  const refresh = useCallback(async () => {
    const [leagues, sessions] = await Promise.all([leaguesApi.list(token).catch(() => []), hostApi.listSessions(token).catch(() => [])]);
    const running = sessions.filter((session) => session.status !== 'FINISHED' && session.status !== 'LOBBY');
    const reviews = await Promise.all(
      running.map(async (session) => ({
        session,
        count: (await hostApi.listDisputes(token, session.id).catch(() => [])).length,
      })),
    );

    const next: Notice[] = [];
    for (const { session, count } of reviews) {
      if (!count) continue;
      next.push({
        key: `review:${session.id}`,
        icon: ClipboardCheck,
        text: `${t('host.notifications.review')} (${count}) · #${session.join_code}`,
        to: `/host/sessions/${session.id}`,
        tone: 'secondary',
      });
    }
    for (const league of leagues.filter((row) => row.myStatus === 'INVITED')) {
      next.push({
        key: `league:${league.id}`,
        icon: Trophy,
        text: `${t('host.notifications.leagueInvite')}: ${league.name}`,
        to: `/host/leagues/${league.id}`,
        tone: 'tertiary',
      });
    }
    const subscription = subscriptionNotice(account.subscription);
    if (subscription) {
      next.push({
        key: 'subscription',
        icon: Hourglass,
        text:
          subscription === 'expired'
            ? t('host.notifications.subscriptionExpired')
            : `${t('host.notifications.subscriptionEnding')} ${account.subscription?.until ? formatDay(account.subscription.until, locale) : ''}`,
        to: '/host/settings',
        tone: subscription === 'expired' ? 'error' : 'secondary',
      });
    }
    setNotices(next);
  }, [token, account.subscription, t, locale]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { notices, refresh };
}

const TONE: Record<Notice['tone'], string> = {
  secondary: 'text-secondary',
  error: 'text-error',
  tertiary: 'text-tertiary',
};

/** The top bar bell: a count of what needs attention, and the list on click. */
export function NotificationsBell({ token, account }: { token: string; account: AccountDto }) {
  const { t } = useI18n();
  const { notices, refresh } = useHostNotices(token, account);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className="relative flex rounded-xl p-space-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        aria-label={t('host.notifications.title')}
        aria-expanded={open}
        onClick={() => {
          if (!open) void refresh();
          setOpen((value) => !value);
        }}
        data-testid="host-notifications"
      >
        <Bell className="h-5 w-5" />
        {notices.length > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-label-sm font-bold text-on-secondary"
            data-testid="host-notifications-count"
          >
            {notices.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-space-xs w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface-container-high p-space-sm shadow-2xl"
          role="dialog"
          aria-label={t('host.notifications.title')}
          data-testid="host-notifications-panel"
        >
          {notices.length === 0 ? (
            <p className="p-space-sm text-body-sm text-on-surface-variant">{t('host.notifications.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {notices.map((notice) => (
                <li key={notice.key}>
                  <Link
                    to={notice.to}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-space-sm rounded-xl p-space-sm text-body-sm text-on-surface hover:bg-surface-container"
                    data-testid={`host-notice-${notice.key}`}
                  >
                    <notice.icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[notice.tone]}`} />
                    {notice.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
