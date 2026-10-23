import type { ReactNode } from 'react';
import { DoorOpen, LockKeyhole, Timer, Trophy, Award } from 'lucide-react';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Logo } from '../ui/Logo';

export type PlayerPhase = 'lobby' | 'question' | 'locked' | 'reveal' | 'results';

const PHASES: { phase: PlayerPhase; icon: typeof Timer; label: TranslationKey }[] = [
  { phase: 'lobby', icon: DoorOpen, label: 'play.phase.lobby' },
  { phase: 'question', icon: Timer, label: 'play.phase.question' },
  { phase: 'locked', icon: LockKeyhole, label: 'play.phase.locked' },
  { phase: 'reveal', icon: Award, label: 'play.phase.reveal' },
  { phase: 'results', icon: Trophy, label: 'play.phase.results' },
];

/** Fixed header + bottom phase bar shared by every in-game player screen (Stitch player set). */
export function PlayerShell({
  joinCode,
  phase,
  testId,
  children,
}: {
  joinCode: string;
  phase: PlayerPhase;
  testId: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-container-lowest text-on-surface">
      <header className="fixed inset-x-0 top-0 z-50 bg-surface-container-lowest/85 shadow-[0_1px_16px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between gap-space-sm px-margin">
          <div className="flex min-w-0 items-center gap-space-sm">
            <Logo size="sm" />
            <div className="flex items-center gap-space-xs rounded-full bg-surface-container-high px-space-sm py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-tertiary" />
              <span className="text-label-sm uppercase text-on-surface-variant">{t('play.pin')}</span>
              <span className="text-label-md font-bold tracking-wider text-secondary" data-testid="player-join-code">
                #{joinCode}
              </span>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 overflow-x-hidden px-margin pb-28 pt-20">
        <div className="flex flex-col gap-space-md" data-testid={testId}>
          {children}
        </div>
      </main>

      <nav
        aria-label={t('play.phase.label')}
        className="fixed inset-x-0 bottom-0 z-50 bg-surface-container-lowest/90 shadow-[0_-4px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        <ol className="mx-auto flex h-20 max-w-xl items-center justify-around px-space-xs">
          {PHASES.map(({ phase: item, icon: Icon, label }) => {
            const current = item === phase;
            return (
              <li
                key={item}
                aria-current={current ? 'step' : undefined}
                className={`relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-space-xs ${
                  current
                    ? "text-primary after:absolute after:bottom-1 after:h-0.5 after:w-8 after:rounded-full after:bg-primary after:content-['']"
                    : 'text-on-surface-variant'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-center text-label-sm">{t(label)}</span>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
