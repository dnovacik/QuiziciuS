import { useState, type ComponentType, type ReactNode } from 'react';
import { BookOpen, CalendarClock, CirclePlay, CirclePlus, FolderHeart, Radio, Star, Trophy, Zap, type LucideProps } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { Pending } from '../ui/Pending';
import { CreateQuizDialog } from './HostShell';
import { QuizLibrary, StartSessionDialog, useHostLibrary } from './library';
import { LiveSessionCard } from './sessions';
import { btn, ErrorBanner } from './ui';

/** Stitch "Host Dashboard (Hlavný panel moderátora)". */
export function DashboardPage({ token }: { token: string }) {
  const { t, plural } = useI18n();
  const library = useHostLibrary(token);
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);

  const live = library.sessions.filter((session) => session.status !== 'FINISHED');
  const hosted = library.sessions.filter((session) => session.status === 'FINISHED').length;
  const running = live.filter((session) => session.status !== 'LOBBY').length;
  const readyQuizzes = library.quizzes.filter((quiz) => (library.stats[quiz.id]?.questions ?? 0) > 0);

  return (
    <div className="flex w-full flex-col gap-space-lg" data-testid="host-dashboard">
      <section className="flex flex-col py-space-sm">
        <div className="flex items-center gap-space-xs text-label-md text-secondary">
          <Zap className="h-4 w-4" />
          {t('host.dashboard.badge')}
        </div>
        <h1 className="text-headline-lg tracking-tight text-on-surface">{t('host.dashboard.welcome')}</h1>
        <p className="text-body-md text-on-surface-variant">{t('host.dashboard.subtitle')}</p>
      </section>

      {library.error !== null && <ErrorBanner>{describeError(library.error, t, 'errors.generic')}</ErrorBanner>}

      <section className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4" aria-label={t('host.dashboard.statsLabel')}>
        <StatCard
          icon={BookOpen}
          tone="primary"
          label={t('host.dashboard.statQuizzes')}
          value={library.loading ? '—' : String(library.quizzes.length)}
          testId="stat-quizzes"
        >
          {readyQuizzes.length} {plural('count.readyQuizzes', readyQuizzes.length)}
        </StatCard>
        <StatCard
          icon={Radio}
          tone="tertiary"
          label={t('host.dashboard.statLive')}
          value={library.loading ? '—' : String(live.length)}
          testId="stat-live"
        >
          {running > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-tertiary/20 px-2 py-0.5 text-label-sm text-tertiary">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-tertiary" />
              {running} {plural('count.runningNow', running)}
            </span>
          )}
        </StatCard>
        <StatCard
          icon={Trophy}
          tone="secondary"
          label={t('host.dashboard.statHosted')}
          value={library.loading ? '—' : String(hosted)}
          testId="stat-hosted"
        />
        <Pending feature="team-ratings">
          <StatCard icon={Star} tone="secondary" label={t('host.dashboard.statRating')} value="—" />
        </Pending>
      </section>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-surface-container via-surface-container-high/80 to-surface-container p-space-lg shadow-xl">
        <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-primary-container/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 right-20 h-72 w-72 rounded-full bg-secondary-container/15 blur-3xl" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-space-lg lg:flex-row lg:items-center">
          <div className="flex max-w-2xl flex-col">
            <div className="mb-space-xs flex flex-wrap items-center gap-space-xs">
              <span className="flex items-center gap-1 rounded-full bg-secondary-container/20 px-2.5 py-0.5 text-label-sm uppercase tracking-wider text-secondary">
                <Zap className="h-3.5 w-3.5" />
                {t('host.dashboard.heroBadge')}
              </span>
              <span className="text-label-sm text-on-surface-variant">• {t('host.dashboard.heroSubtag')}</span>
            </div>
            <h2 className="mb-space-xs text-headline-md text-on-surface">{t('host.dashboard.heroTitle')}</h2>
            <p className="text-body-md text-on-surface-variant">{t('host.dashboard.heroText')}</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-space-md sm:w-auto">
            <button
              type="button"
              className={`${btn.primary} flex-1 py-3.5 sm:flex-initial`}
              onClick={() => setCreating(true)}
              data-testid="hero-create-quiz"
            >
              <CirclePlus className="h-5 w-5" />
              {t('host.dashboard.createQuiz')}
            </button>
            <button
              type="button"
              className={`${btn.gold} flex-1 py-3.5 sm:flex-initial`}
              onClick={() => setStarting(true)}
              data-testid="hero-start-evening"
            >
              <CirclePlay className="h-5 w-5" />
              {t('host.dashboard.startEvening')}
            </button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-space-md" aria-label={t('host.dashboard.liveTitle')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <span
              className={`h-3 w-3 rounded-full ${live.length ? 'animate-pulse bg-tertiary shadow-[0_0_12px_#4edea3]' : 'bg-outline'}`}
            />
            <h2 className="text-headline-sm text-on-surface">{t('host.dashboard.liveTitle')}</h2>
          </div>
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
            {live.length} {plural('count.activeSessions', live.length)}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-space-md lg:grid-cols-3">
          <div className="flex flex-col gap-space-md lg:col-span-2">
            {live.length === 0 ? (
              <div
                className="flex items-center rounded-2xl bg-surface-container-low/70 p-space-lg text-body-md text-on-surface-variant"
                data-testid="no-live-sessions"
              >
                {t('host.dashboard.noLive')}
              </div>
            ) : (
              live.map((session) => (
                <LiveSessionCard key={session.id} session={session} quiz={library.quizzes.find((quiz) => quiz.id === session.quiz_id)} />
              ))
            )}
          </div>
          <Pending feature="scheduled-sessions">
            <div className="flex h-full flex-col rounded-2xl bg-surface-container-low/70 p-space-lg shadow-md">
              <span className="mb-space-sm flex w-fit items-center gap-1 rounded-full bg-secondary-container/20 px-2.5 py-1 text-label-sm uppercase tracking-wide text-secondary">
                <CalendarClock className="h-3.5 w-3.5" />
                {t('host.dashboard.scheduled')}
              </span>
              <p className="text-body-sm text-on-surface-variant">{t('host.dashboard.scheduledText')}</p>
            </div>
          </Pending>
        </div>
      </section>

      <section className="flex flex-col gap-space-md pt-space-xs">
        <div className="flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container/20 text-primary">
              <FolderHeart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-headline-sm text-on-surface">{t('host.library.title')}</h2>
              <p className="text-body-sm text-on-surface-variant">{t('host.library.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            className={`${btn.primary} py-2 text-label-md`}
            onClick={() => setCreating(true)}
            data-testid="library-add-quiz"
          >
            <CirclePlus className="h-[18px] w-[18px]" />
            {t('host.library.add')}
          </button>
        </div>
        <QuizLibrary token={token} {...library} onChanged={() => void library.reload()} onCreate={() => setCreating(true)} />
      </section>

      {creating && <CreateQuizDialog token={token} onClose={() => setCreating(false)} />}
      {starting && <StartSessionDialog token={token} choices={readyQuizzes} onClose={() => setStarting(false)} />}
    </div>
  );
}

const TONES = {
  primary: { tile: 'bg-primary-container/20 text-primary', bar: 'bg-primary-container' },
  tertiary: { tile: 'bg-tertiary-container/20 text-tertiary', bar: 'bg-tertiary shadow-[0_0_8px_#4edea3]' },
  secondary: { tile: 'bg-secondary-container/20 text-secondary', bar: 'bg-secondary-container shadow-[0_0_8px_#ee9800]' },
} as const;

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  children,
  testId,
}: {
  icon: ComponentType<LucideProps>;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-2xl bg-surface-container-low/80 p-space-lg shadow-md backdrop-blur-md"
      data-testid={testId}
    >
      <div className="mb-space-xs flex items-center justify-between">
        <span className="text-label-md text-on-surface-variant">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone].tile}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <div className="mt-space-xs flex items-baseline gap-space-sm">
        <span className="text-display-lg tracking-tight text-on-surface" data-testid={testId && `${testId}-value`}>
          {value}
        </span>
        <span className="text-label-md text-on-surface-variant">{children}</span>
      </div>
      <div className="mt-space-sm h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div className={`h-full w-3/4 rounded-full ${TONES[tone].bar}`} />
      </div>
    </div>
  );
}
