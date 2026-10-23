import { useState } from 'react';
import { CirclePlus, FolderHeart } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { CreateQuizDialog } from './HostShell';
import { QuizLibrary, useHostLibrary } from './library';
import { btn, ErrorBanner } from './ui';

export function QuizzesPage({ token }: { token: string }) {
  const { t } = useI18n();
  const library = useHostLibrary(token);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex w-full flex-col gap-space-lg" data-testid="host-quizzes">
      <div className="flex flex-col justify-between gap-space-sm py-space-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container/20 text-primary">
            <FolderHeart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-headline-lg tracking-tight text-on-surface">{t('host.library.title')}</h1>
            <p className="text-body-md text-on-surface-variant">{t('host.library.subtitle')}</p>
          </div>
        </div>
        <button type="button" className={btn.primary} onClick={() => setCreating(true)} data-testid="quizzes-add">
          <CirclePlus className="h-5 w-5" />
          {t('host.library.add')}
        </button>
      </div>
      {library.error !== null && <ErrorBanner>{describeError(library.error, t, 'errors.generic')}</ErrorBanner>}
      <QuizLibrary token={token} {...library} onChanged={() => void library.reload()} onCreate={() => setCreating(true)} />
      {creating && <CreateQuizDialog token={token} onClose={() => setCreating(false)} />}
    </div>
  );
}
