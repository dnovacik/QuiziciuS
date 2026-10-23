import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Copy, HelpCircle, Pencil, Play, Plus, Radio, Search, Timer, Trash2, TriangleAlert, Trophy } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { Modal } from '../ui/Modal';
import { Pending } from '../ui/Pending';
import { duplicateQuiz, hostApi, type Category, type HostSession, type Quiz } from './api';
import { btn, ConfirmDialog, inputClass, Label, useToast } from './ui';

export interface QuizStats {
  questions: number;
  points: number;
  seconds: number;
}

/** Everything the dashboard and the quiz library need, loaded together. */
export function useHostLibrary(token: string) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<HostSession[]>([]);
  const [stats, setStats] = useState<Record<string, QuizStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [quizRows, categoryRows, sessionRows] = await Promise.all([
        hostApi.listQuizzes(token),
        hostApi.listCategories(token),
        hostApi.listSessions(token),
      ]);
      setQuizzes(quizRows);
      setCategories(categoryRows);
      setSessions(sessionRows);
      const entries = await Promise.all(
        quizRows.map(async (quiz) => {
          const questions = await hostApi.listQuestions(token, quiz.id).catch(() => []);
          const summary: QuizStats = {
            questions: questions.length,
            points: questions.reduce((sum, question) => sum + question.points, 0),
            seconds: questions.reduce((sum, question) => sum + question.time_limit_seconds, 0),
          };
          return [quiz.id, summary] as const;
        }),
      );
      setStats(Object.fromEntries(entries));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { quizzes, categories, sessions, stats, loading, error, reload };
}

type Sort = 'recent' | 'oldest' | 'az';

/** "Knižnica kvízov" — category chips, search, sort and quiz cards. */
export function QuizLibrary({
  token,
  quizzes,
  categories,
  sessions,
  stats,
  loading,
  onChanged,
  onCreate,
}: {
  token: string;
  quizzes: Quiz[];
  categories: Category[];
  sessions: HostSession[];
  stats: Record<string, QuizStats>;
  loading: boolean;
  onChanged: () => void;
  onCreate: () => void;
}) {
  const { t, locale } = useI18n();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [starting, setStarting] = useState<Quiz | null>(null);
  const [duplicating, setDuplicating] = useState<Quiz | null>(null);
  const [deleting, setDeleting] = useState<Quiz | null>(null);
  const navigate = useNavigate();

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return quizzes
      .filter((quiz) => category === 'all' || (category === 'none' ? !quiz.category_id : quiz.category_id === category))
      .filter((quiz) => quiz.title.toLocaleLowerCase().includes(needle))
      .sort((a, b) =>
        sort === 'az'
          ? a.title.localeCompare(b.title)
          : sort === 'recent'
            ? b.created_at.localeCompare(a.created_at)
            : a.created_at.localeCompare(b.created_at),
      );
  }, [quizzes, category, search, sort]);

  const categoryName = (id: string | null) => categories.find((row) => row.id === id)?.name ?? t('host.common.uncategorized');
  const timesPlayed = (quizId: string) => sessions.filter((session) => session.quiz_id === quizId && session.status === 'FINISHED').length;
  const chip = (value: string, label: string, count: number) => (
    <button
      key={value}
      type="button"
      onClick={() => setCategory(value)}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-label-sm ${
        category === value
          ? 'bg-primary-container text-on-primary-container shadow-sm'
          : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <section className="flex flex-col gap-space-md" data-testid="quiz-library">
      <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-center">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0" data-testid="quiz-category-filters">
          {chip('all', t('host.library.all'), quizzes.length)}
          {categories
            .filter((row) => quizzes.some((quiz) => quiz.category_id === row.id))
            .map((row) => chip(row.id, row.name, quizzes.filter((quiz) => quiz.category_id === row.id).length))}
          {quizzes.some((quiz) => !quiz.category_id) &&
            chip('none', t('host.common.uncategorized'), quizzes.filter((quiz) => !quiz.category_id).length)}
        </div>
        <div className="flex items-center gap-space-xs">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-[18px] w-[18px] text-on-surface-variant" />
            <input
              data-testid="quiz-search"
              className="h-10 w-full rounded-xl bg-surface-container pl-9 pr-3 text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t('host.library.search')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            data-testid="quiz-sort"
            onClick={() => setSort((value) => (value === 'recent' ? 'oldest' : value === 'oldest' ? 'az' : 'recent'))}
            className="flex h-10 items-center gap-1 rounded-xl bg-surface-container px-3 text-label-sm text-on-surface-variant hover:text-on-surface"
          >
            <ArrowUpDown className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">{t(`host.library.sort.${sort}`)}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl bg-surface-container-high/50" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div
          className="flex flex-col items-center rounded-2xl bg-surface-container-low/70 px-space-lg py-space-xl text-center"
          data-testid="quiz-library-empty"
        >
          <p className="text-body-lg text-on-surface-variant">{t(quizzes.length ? 'host.library.noMatch' : 'host.library.empty')}</p>
          {!quizzes.length && (
            <button type="button" className={`${btn.primary} mt-space-md`} onClick={onCreate}>
              <Plus className="h-5 w-5" />
              {t('host.library.createFirst')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3">
          {visible.map((quiz) => {
            const stat = stats[quiz.id];
            const played = timesPlayed(quiz.id);
            const ready = stat ? stat.questions > 0 : false;
            return (
              <article
                key={quiz.id}
                data-testid={`quiz-card-${quiz.id}`}
                className="group flex flex-col justify-between rounded-2xl bg-surface-container-low/90 p-space-lg shadow-md backdrop-blur-md transition-all hover:bg-surface-container-low hover:shadow-xl"
              >
                <div>
                  <div className="mb-space-sm flex items-center justify-between">
                    {played > 0 ? (
                      <span className="flex items-center gap-1 rounded-full bg-secondary-container/20 px-2.5 py-0.5 text-label-sm uppercase tracking-wide text-secondary">
                        <Trophy className="h-3.5 w-3.5" />
                        {t('host.library.played')} {played}×
                      </span>
                    ) : ready ? (
                      <span className="flex items-center gap-1 rounded-full bg-tertiary-container/20 px-2.5 py-0.5 text-label-sm uppercase tracking-wide text-tertiary">
                        <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
                        {t('host.library.ready')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-surface-container-highest px-2.5 py-0.5 text-label-sm uppercase tracking-wide text-on-surface-variant">
                        <span className="h-1.5 w-1.5 rounded-full bg-outline" />
                        {t('host.library.draft')}
                      </span>
                    )}
                    <span className="text-body-sm text-on-surface-variant">
                      {new Date(quiz.created_at).toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB')}
                    </span>
                  </div>
                  <h3 className="text-headline-sm text-on-surface transition-colors group-hover:text-primary">{quiz.title}</h3>
                  <span className="text-label-sm uppercase tracking-wider text-secondary">{categoryName(quiz.category_id)}</span>
                  <div className="flex flex-wrap items-center gap-space-md py-space-sm text-body-sm text-on-surface-variant">
                    <span className="flex items-center gap-1" data-testid={`quiz-question-count-${quiz.id}`}>
                      <HelpCircle className="h-4 w-4" />
                      {stat ? stat.questions : '—'} {t('host.common.questions')}
                    </span>
                    {stat && stat.questions > 0 && (
                      <>
                        <span className="flex items-center gap-1">
                          <Trophy className="h-4 w-4" />
                          {stat.points} {t('host.common.pointsShort')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="h-4 w-4" />~{Math.max(1, Math.round(stat.seconds / 60))} min
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-space-sm flex items-center justify-between pt-space-md">
                  {ready ? (
                    <button
                      type="button"
                      className={`${btn.primary} py-2 text-label-md`}
                      onClick={() => setStarting(quiz)}
                      data-testid={`quiz-start-${quiz.id}`}
                    >
                      <Play className="h-[18px] w-[18px]" />
                      {t('host.library.start')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`${btn.secondary} py-2 text-primary`}
                      onClick={() => navigate(`/host/quizzes/${quiz.id}`)}
                    >
                      <Pencil className="h-[18px] w-[18px]" />
                      {t('host.library.finish')}
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={btn.icon}
                      title={t('host.library.edit')}
                      aria-label={t('host.library.edit')}
                      onClick={() => navigate(`/host/quizzes/${quiz.id}`)}
                      data-testid={`quiz-edit-${quiz.id}`}
                    >
                      <Pencil className="h-[18px] w-[18px]" />
                    </button>
                    <button
                      type="button"
                      className={btn.icon}
                      title={t('host.library.duplicate')}
                      aria-label={t('host.library.duplicate')}
                      onClick={() => setDuplicating(quiz)}
                      data-testid={`quiz-duplicate-${quiz.id}`}
                    >
                      <Copy className="h-[18px] w-[18px]" />
                    </button>
                    <button
                      type="button"
                      className={`${btn.icon} hover:bg-error-container/20 hover:text-error`}
                      title={t('host.library.delete')}
                      aria-label={t('host.library.delete')}
                      onClick={() => setDeleting(quiz)}
                      data-testid={`quiz-delete-${quiz.id}`}
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {starting && <StartSessionDialog token={token} quiz={starting} onClose={() => setStarting(null)} />}
      {duplicating && <DuplicateQuizDialog token={token} quiz={duplicating} onClose={() => setDuplicating(null)} onDone={onChanged} />}
      {deleting && <DeleteQuizDialog token={token} quiz={deleting} onClose={() => setDeleting(null)} onDone={onChanged} />}
    </section>
  );
}

/** "Spustiť kvízový večer" — creates the session and opens the control room. */
export function StartSessionDialog({
  token,
  quiz,
  choices = [],
  onClose,
}: {
  token: string;
  /** The quiz to launch; without it the host picks one of `choices`. */
  quiz?: Quiz;
  choices?: Quiz[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [picked, setPicked] = useState(quiz?.id ?? choices[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const session = await hostApi.createSession(token, picked);
      navigate(`/host/sessions/${session.id}`);
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <Modal tone="surface" labelledBy="start-session-title" onClose={onClose} className="max-w-lg" testId="start-session-dialog">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container/20 text-secondary">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h3 id="start-session-title" className="text-headline-sm text-on-surface">
              {t('host.start.title')}
            </h3>
            {quiz && <span className="text-body-sm text-on-surface-variant">{quiz.title}</span>}
          </div>
        </div>
        {!quiz && (
          <div>
            <Label htmlFor="start-session-quiz">{t('host.start.pickQuiz')}</Label>
            {choices.length ? (
              <select
                id="start-session-quiz"
                data-testid="start-session-quiz"
                className={inputClass}
                value={picked}
                onChange={(event) => setPicked(event.target.value)}
              >
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-body-sm text-on-surface-variant">{t('host.start.noReadyQuiz')}</p>
            )}
          </div>
        )}
        <Pending feature="venues">
          <div>
            <Label>{t('host.start.venue')}</Label>
            <div className="rounded-xl bg-surface-container p-space-sm text-label-md text-on-surface-variant">—</div>
          </div>
        </Pending>
        <div className="flex items-center gap-space-sm rounded-xl bg-primary-container/10 p-space-sm text-body-sm text-on-surface-variant">
          <HelpCircle className="h-5 w-5 shrink-0 text-primary" />
          {t('host.start.info')}
        </div>
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-space-xs pt-space-xs">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {t('host.common.cancel')}
          </button>
          <button
            type="button"
            className={btn.gold}
            disabled={busy || !picked}
            onClick={() => void launch()}
            data-testid="start-session-confirm"
          >
            <Radio className="h-[18px] w-[18px]" />
            {busy ? t('common.working') : t('host.start.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DuplicateQuizDialog({ token, quiz, onClose, onDone }: { token: string; quiz: Quiz; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [title, setTitle] = useState(`${quiz.title} (${t('host.duplicate.copy')})`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await duplicateQuiz(token, quiz, title);
      toast(t('host.duplicate.done'));
      onClose();
      onDone();
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      icon={Copy}
      title={t('host.duplicate.title')}
      text={t('host.duplicate.text')}
      confirmLabel={t('host.duplicate.confirm')}
      busy={busy}
      onConfirm={() => void confirm()}
      onClose={onClose}
      testId="duplicate-quiz-dialog"
    >
      <div>
        <Label htmlFor="duplicate-title">{t('host.duplicate.name')}</Label>
        <input
          id="duplicate-title"
          data-testid="duplicate-title"
          className={inputClass}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}

function DeleteQuizDialog({ token, quiz, onClose, onDone }: { token: string; quiz: Quiz; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await hostApi.deleteQuiz(token, quiz.id);
      toast(t('host.delete.done'));
      onClose();
      onDone();
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      icon={TriangleAlert}
      tone="danger"
      title={t('host.delete.title')}
      text={
        <>
          {t('host.delete.prompt')} <strong className="text-on-surface">{quiz.title}</strong>. {t('host.delete.warning')}
        </>
      }
      confirmLabel={t('host.delete.confirm')}
      busy={busy}
      onConfirm={() => void confirm()}
      onClose={onClose}
      testId="delete-quiz-dialog"
    >
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
