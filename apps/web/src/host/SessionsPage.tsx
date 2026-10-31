import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Archive, ArchiveRestore, History, Radio, Trophy } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { useHostLibrary } from './library';
import { hostApi } from './api';
import { LiveSessionCard } from './sessions';
import { btn, ErrorBanner } from './ui';

/** Live sessions plus the history of finished quiz nights. */
export function SessionsPage({ token }: { token: string }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const library = useHostLibrary(token);
  const live = library.sessions.filter((session) => session.status !== 'FINISHED');
  const [showArchived, setShowArchived] = useState(false);
  const allFinished = library.sessions.filter((session) => session.status === 'FINISHED');
  const archivedCount = allFinished.filter((session) => session.archived_at).length;
  const finished = allFinished.filter((session) => showArchived || !session.archived_at);

  async function setArchived(sessionId: string, archived: boolean) {
    try {
      await hostApi.archiveSession(token, sessionId, archived);
      void library.reload();
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
    }
  }
  const [error, setError] = useState<string | null>(null);
  const quizTitle = (quizId: string) => library.quizzes.find((quiz) => quiz.id === quizId)?.title ?? '—';
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <div className="flex w-full flex-col gap-space-lg" data-testid="host-sessions">
      <div className="flex items-center gap-space-sm py-space-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tertiary-container/20 text-tertiary">
          <Radio className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-headline-lg tracking-tight text-on-surface">{t('host.nav.sessions')}</h1>
          <p className="text-body-md text-on-surface-variant">{t('host.sessions.subtitle')}</p>
        </div>
      </div>
      {library.error !== null && <ErrorBanner>{describeError(library.error, t, 'errors.generic')}</ErrorBanner>}
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {live.length === 0 && !library.loading ? (
        <div className="rounded-2xl bg-surface-container-low/70 p-space-lg text-body-md text-on-surface-variant">
          {t('host.dashboard.noLive')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-space-md xl:grid-cols-2">
          {live.map((session) => (
            <LiveSessionCard
              key={session.id}
              token={token}
              session={session}
              quiz={library.quizzes.find((quiz) => quiz.id === session.quiz_id)}
            />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-space-md rounded-2xl bg-surface-container-low p-space-lg shadow-xl">
        <div className="flex items-center gap-space-sm">
          <History className="h-5 w-5 text-secondary" />
          <h2 className="text-headline-sm text-on-surface">{t('host.sessions.history')}</h2>
          {archivedCount > 0 && (
            <label className="ml-auto flex cursor-pointer items-center gap-space-xs text-label-md text-on-surface-variant">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                data-testid="sessions-show-archived"
              />
              {t('host.sessions.showArchived')} ({archivedCount})
            </label>
          )}
        </div>
        {finished.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">{t('host.sessions.noHistory')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm text-on-surface">
              <thead className="bg-surface-container text-label-sm uppercase text-on-surface-variant">
                <tr>
                  <th className="rounded-l-lg p-space-sm">{t('host.sessions.quiz')}</th>
                  <th className="p-space-sm">{t('host.session.code')}</th>
                  <th className="p-space-sm">{t('host.sessions.started')}</th>
                  <th className="p-space-sm">{t('host.sessions.finished')}</th>
                  <th className="rounded-r-lg p-space-sm text-right" />
                </tr>
              </thead>
              <tbody>
                {finished.map((session) => (
                  <tr key={session.id} className="transition-colors hover:bg-surface-container/40" data-testid={`history-${session.id}`}>
                    <td className="p-space-sm text-label-md">{quizTitle(session.quiz_id)}</td>
                    <td className="p-space-sm font-bold tracking-widest text-secondary">#{session.join_code}</td>
                    <td className="p-space-sm text-on-surface-variant">{date(session.started_at ?? session.created_at)}</td>
                    <td className="p-space-sm text-on-surface-variant">{date(session.finished_at)}</td>
                    <td className="p-space-sm text-right">
                      <span className="inline-flex items-center gap-space-xs">
                        <button
                          type="button"
                          className={`${btn.secondary} py-1.5`}
                          onClick={() => navigate(`/host/sessions/${session.id}`)}
                        >
                          <Trophy className="h-4 w-4 text-secondary" />
                          {t('host.sessions.results')}
                        </button>
                        <button
                          type="button"
                          className={`${btn.icon}`}
                          onClick={() => void setArchived(session.id, !session.archived_at)}
                          aria-label={t(session.archived_at ? 'host.sessions.unarchive' : 'host.room.archive')}
                          title={t(session.archived_at ? 'host.sessions.unarchive' : 'host.room.archive')}
                          data-testid={`history-archive-${session.id}`}
                        >
                          {session.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
