import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  GripVertical,
  Hash,
  HelpCircle,
  Lightbulb,
  LayoutGrid,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  Trophy,
  TriangleAlert,
  Type,
} from 'lucide-react';
import type { QuestionType } from '@quizicius/shared-types';
import { describeError } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { Modal } from '../../ui/Modal';
import { Pending } from '../../ui/Pending';
import {
  hostApi,
  isAcceptedMedia,
  saveQuestionOrder,
  stripIds,
  uploadQuestionMedia,
  type Category,
  type Question,
  type QuestionDraft,
  type Quiz,
} from '../api';
import { btn, Card, ConfirmDialog, ErrorBanner, inputClass, Label, useToast } from '../ui';
import { PhonePreview } from './PhonePreview';
import { QuestionForm } from './QuestionForm';
import { blankQuestion, cleanForSave, validate } from './question-draft';

const TYPE_ICON: Record<QuestionType, typeof LayoutGrid> = { MULTIPLE_CHOICE: LayoutGrid, FREE_TEXT: Type, NUMERIC_NEAREST: Hash };
const TYPE_BADGE: Record<QuestionType, string> = { MULTIPLE_CHOICE: 'ABCD', FREE_TEXT: 'Aa', NUMERIC_NEAREST: '#~' };

/** The question being edited: `id` null means a new question that is not saved yet. */
interface Editing {
  id: string | null;
  draft: QuestionDraft;
  original: QuestionDraft;
}

type MobileTab = 'list' | 'editor' | 'preview';

/** Stitch "Správa kvízu a Editor otázok". */
export function QuizEditorPage({ token }: { token: string }) {
  const { quizId = '' } = useParams<{ quizId: string }>();
  const { t } = useI18n();
  const toast = useToast();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<(() => void) | null>(null);
  const [deleting, setDeleting] = useState<Question | 'current' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editor');
  const [dragId, setDragId] = useState<string | null>(null);

  const ordered = useMemo(() => [...questions].sort((a, b) => a.order_index - b.order_index), [questions]);
  const questionDirty = editing ? JSON.stringify(editing.draft) !== JSON.stringify(editing.original) : false;
  const titleDirty = quiz !== null && title.trim() !== quiz.title;
  const dirty = questionDirty || titleDirty;

  const startEditing = useCallback((question: Question | null, orderIndex: number) => {
    const draft = question ? stripIds(question) : blankQuestion(orderIndex);
    setEditing({ id: question?.id ?? null, draft, original: draft });
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([hostApi.listQuizzes(token), hostApi.listCategories(token), hostApi.listQuestions(token, quizId)])
      .then(([quizRows, categoryRows, questionRows]) => {
        if (!active) return;
        const found = quizRows.find((row) => row.id === quizId) ?? null;
        setQuiz(found);
        setTitle(found?.title ?? '');
        setCategories(categoryRows);
        setQuestions(questionRows);
        const first = [...questionRows].sort((a, b) => a.order_index - b.order_index)[0];
        if (first) startEditing(first, 0);
        if (!found) setError(t('host.editor.notFound'));
      })
      .catch((err) => active && setError(describeError(err, t, 'errors.generic')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token, quizId, startEditing, t]);

  useEffect(() => {
    const path = editing?.draft.media_path;
    setMediaUrl(null);
    if (!path) return;
    let active = true;
    hostApi
      .mediaUrl(token, quizId, path)
      .then((url) => active && setMediaUrl(url))
      .catch(() => active && setMediaUrl(null));
    return () => {
      active = false;
    };
  }, [editing?.draft.media_path, token, quizId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** Runs `action` now, or after the host confirms throwing away the unsaved question. */
  function guard(action: () => void) {
    if (questionDirty) setPendingSwitch(() => action);
    else action();
  }

  const select = (question: Question) =>
    guard(() => {
      startEditing(question, question.order_index);
      setMobileTab('editor');
    });
  const addQuestion = () =>
    guard(() => {
      startEditing(null, ordered.length);
      setMobileTab('editor');
    });

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  const saveQuestion = () =>
    run(async () => {
      if (!editing) return;
      const errors = validate(editing.draft);
      if (errors.length) {
        setError(t('host.editor.fixErrors'));
        return;
      }
      const draft = cleanForSave(editing.draft);
      const saved = editing.id
        ? await hostApi.updateQuestion(token, quizId, editing.id, draft)
        : await hostApi.createQuestion(token, quizId, draft);
      setQuestions((list) => [...list.filter((question) => question.id !== saved.id), saved]);
      startEditing(saved, saved.order_index);
      toast(t('host.editor.saved'));
    });

  const saveAll = () =>
    run(async () => {
      if (titleDirty && title.trim()) {
        const updated = await hostApi.updateQuiz(token, quizId, { title: title.trim() });
        setQuiz(updated);
        setTitle(updated.title);
      }
      if (questionDirty && editing) {
        if (validate(editing.draft).length) {
          setError(t('host.editor.fixErrors'));
          return;
        }
        const draft = cleanForSave(editing.draft);
        const saved = editing.id
          ? await hostApi.updateQuestion(token, quizId, editing.id, draft)
          : await hostApi.createQuestion(token, quizId, draft);
        setQuestions((list) => [...list.filter((question) => question.id !== saved.id), saved]);
        startEditing(saved, saved.order_index);
      }
      toast(t('host.editor.quizSaved'));
    });

  function discardAll() {
    if (quiz) setTitle(quiz.title);
    if (editing) setEditing({ ...editing, draft: editing.original });
  }

  const duplicateQuestion = () =>
    run(async () => {
      if (!editing?.id) return;
      const copy = await hostApi.createQuestion(token, quizId, { ...cleanForSave(editing.draft), order_index: ordered.length });
      setQuestions((list) => [...list, copy]);
      startEditing(copy, copy.order_index);
      toast(t('host.editor.duplicated'));
    });

  const confirmDelete = () =>
    run(async () => {
      const target = deleting === 'current' ? (editing?.id ? questions.find((question) => question.id === editing.id) : null) : deleting;
      setDeleting(null);
      if (target) {
        await hostApi.deleteQuestion(token, quizId, target.id);
        const rest = ordered.filter((question) => question.id !== target.id);
        setQuestions(await saveQuestionOrder(token, quizId, rest));
        if (editing?.id === target.id || !editing) {
          if (rest[0]) startEditing(rest[0], rest[0].order_index);
          else setEditing(null);
        }
      } else if (editing && !editing.id) {
        // Deleting a question that was never saved just drops the draft.
        if (ordered[0]) startEditing(ordered[0], ordered[0].order_index);
        else setEditing(null);
      }
    });

  async function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const moving = ordered.find((question) => question.id === dragId);
    const without = ordered.filter((question) => question.id !== dragId);
    const targetIndex = without.findIndex((question) => question.id === targetId);
    if (!moving || targetIndex < 0) return;
    const next = [...without.slice(0, targetIndex), moving, ...without.slice(targetIndex)];
    setDragId(null);
    setQuestions(next.map((question, index) => ({ ...question, order_index: index })));
    await run(async () => {
      const saved = await saveQuestionOrder(token, quizId, next);
      setQuestions(saved);
      const current = saved.find((question) => question.id === editing?.id);
      if (current && editing)
        setEditing({
          ...editing,
          original: { ...editing.original, order_index: current.order_index },
          draft: { ...editing.draft, order_index: current.order_index },
        });
    });
  }

  async function uploadMedia(file: File) {
    if (!editing) return;
    if (!isAcceptedMedia(file)) {
      setError(t('host.editor.mediaInvalid'));
      return;
    }
    setMediaBusy(true);
    setError(null);
    try {
      const { path, mediaType } = await uploadQuestionMedia(token, quizId, file);
      setEditing((current) => current && { ...current, draft: { ...current.draft, media_path: path, media_type: mediaType } });
    } catch (err) {
      setError(describeError(err, t, 'host.editor.mediaFailed'));
    } finally {
      setMediaBusy(false);
    }
  }

  const totalPoints = ordered.reduce((sum, question) => sum + question.points, 0);
  const totalMinutes = Math.max(1, Math.round(ordered.reduce((sum, question) => sum + question.time_limit_seconds, 0) / 60));
  const editingIndex = editing?.id ? ordered.findIndex((question) => question.id === editing.id) : ordered.length;
  const errors = editing ? validate(editing.draft) : [];
  const categoryName = categories.find((category) => category.id === quiz?.category_id)?.name ?? t('host.common.uncategorized');
  const hidden = (tab: MobileTab) => (mobileTab === tab ? '' : 'hidden xl:flex');

  return (
    <div className="flex w-full flex-col pb-16 text-on-surface" data-testid="quiz-editor">
      <header className="mb-space-lg flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center gap-space-xs text-body-sm text-on-surface-variant">
          <Link
            to="/host/quizzes"
            className="group flex items-center gap-1 text-primary transition-colors hover:text-white"
            data-testid="editor-back"
          >
            <ArrowLeft className="h-[18px] w-[18px] transition-transform group-hover:-translate-x-0.5" />
            {t('host.nav.quizzes')}
          </Link>
          <span>/</span>
          <span className="text-on-surface-variant/80">{t('host.editor.breadcrumb')}</span>
          <span>/</span>
          <span className="text-label-md text-on-surface">{quiz?.title ?? '…'}</span>
        </div>

        <div className="relative flex flex-col justify-between gap-space-lg overflow-hidden rounded-2xl bg-surface-container-low/90 p-space-lg shadow-xl backdrop-blur-xl lg:flex-row lg:items-center">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="z-10 flex min-w-0 flex-1 flex-col gap-space-xs">
            <div className="flex flex-wrap items-center gap-space-sm">
              <span className="rounded-full bg-surface-container-highest px-2.5 py-0.5 text-label-sm uppercase tracking-wider text-secondary">
                {categoryName}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label-sm ${
                  ordered.length ? 'bg-tertiary-container/30 text-tertiary-fixed' : 'bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${ordered.length ? 'bg-tertiary shadow-[0_0_8px_#4edea3]' : 'bg-outline'}`} />
                {t(ordered.length ? 'host.library.ready' : 'host.library.draft')}
              </span>
              {dirty && (
                <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-secondary-container/30 px-2.5 py-0.5 text-label-sm text-secondary-fixed">
                  <Pencil className="h-3.5 w-3.5" />
                  {t('host.editor.unsavedChanges')}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-space-sm">
              <input
                aria-label={t('host.create.name')}
                data-testid="editor-quiz-title"
                className="-ml-2 w-full max-w-xl truncate rounded-xl bg-transparent px-2 py-1 text-headline-lg text-on-surface transition-all focus:bg-surface-container-high/60 focus:outline-none"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-space-lg pt-1 text-body-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-[18px] w-[18px] text-primary" />
                {ordered.length} {t('host.common.questions')}
              </span>
              <span className="flex items-center gap-1.5">
                <Trophy className="h-[18px] w-[18px] text-secondary" />
                {totalPoints} {t('host.common.pointsShort')}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-[18px] w-[18px] text-tertiary" />~{totalMinutes} min
              </span>
            </div>
          </div>
          <div className="z-10 flex shrink-0 flex-wrap items-center gap-space-sm">
            <button type="button" className={btn.secondary} onClick={() => setSettingsOpen(true)} data-testid="editor-settings">
              <SlidersHorizontal className="h-5 w-5" />
              {t('host.editor.settings')}
            </button>
            <button
              type="button"
              className={`${btn.ghost} hover:bg-error-container/20 hover:text-error`}
              disabled={!dirty}
              onClick={discardAll}
            >
              {t('host.editor.discard')}
            </button>
            <button
              type="button"
              className={btn.primary}
              disabled={!dirty || busy}
              onClick={() => void saveAll()}
              data-testid="editor-save-all"
            >
              <Save className="h-5 w-5" />
              {t('host.editor.saveAll')}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-space-md">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}

      <div className="mb-space-md flex rounded-xl bg-surface-container-low p-1 xl:hidden" role="tablist">
        {(['list', 'editor', 'preview'] as const).map((tab, index) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mobileTab === tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 rounded-lg py-2 text-center text-label-md transition-all ${mobileTab === tab ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}
          >
            {index + 1}. {t(`host.editor.tab.${tab}`)}
            {tab === 'list' && ` (${ordered.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          className="flex h-96 w-full animate-pulse flex-col items-center justify-center gap-4 rounded-2xl bg-surface-container-low/50"
          data-testid="editor-loading"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-headline-sm text-on-surface">{t('host.editor.loading')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-space-lg xl:grid-cols-12">
          <aside className={`w-full flex-col gap-space-md xl:col-span-3 ${hidden('list')} flex`}>
            <Card className="flex flex-col gap-space-md p-space-md" testId="editor-navigator">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-headline-sm text-on-surface">{t('host.editor.questions')}</span>
                  <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-sm text-primary">{ordered.length}</span>
                </div>
                <button
                  type="button"
                  className={`${btn.primary} px-3 py-1.5 text-label-sm`}
                  onClick={addQuestion}
                  data-testid="editor-add-question"
                >
                  <Plus className="h-4 w-4" />
                  {t('host.editor.add')}
                </button>
              </div>
              <ol className="flex max-h-[calc(100vh-320px)] flex-col gap-2 overflow-y-auto pr-1">
                {ordered.length === 0 && (
                  <li className="rounded-xl bg-surface-container p-4 text-center text-body-sm text-on-surface-variant">
                    {t('host.editor.noQuestions')}
                  </li>
                )}
                {ordered.map((question, index) => {
                  const active = question.id === editing?.id;
                  const valid = validate(stripIds(question)).length === 0;
                  const Icon = TYPE_ICON[question.type];
                  return (
                    <li
                      key={question.id}
                      draggable
                      onDragStart={() => setDragId(question.id)}
                      onDragOver={(event: DragEvent) => event.preventDefault()}
                      onDrop={() => void onDrop(question.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => select(question)}
                      data-testid={`editor-question-${question.id}`}
                      className={`group relative flex cursor-pointer select-none items-center gap-2.5 rounded-xl p-2.5 transition-all ${
                        active
                          ? 'bg-surface-container-high text-on-surface shadow-[0_0_16px_rgba(160,120,255,0.25)]'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high/60 hover:text-on-surface'
                      } ${dragId === question.id ? 'opacity-40' : ''}`}
                    >
                      <GripVertical
                        className="h-4 w-4 cursor-grab text-on-surface-variant/40 group-hover:text-on-surface-variant"
                        aria-label={t('host.editor.reorder')}
                      />
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-label-sm font-bold ${
                          active ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-on-surface-variant'
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-label-md text-on-surface">{question.prompt || t('host.editor.untitled')}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-label-sm">
                          <span className="flex items-center gap-0.5 text-primary">
                            <Icon className="h-3 w-3" />
                            {TYPE_BADGE[question.type]}
                          </span>
                          <span>•</span>
                          <span className="text-secondary">
                            {question.points}
                            {t('host.common.pointsShort')}
                          </span>
                          <span>•</span>
                          <span>{question.time_limit_seconds}s</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {valid ? <CheckCircle2 className="h-4 w-4 text-tertiary" /> : <TriangleAlert className="h-4 w-4 text-secondary" />}
                        <button
                          type="button"
                          aria-label={t('host.editor.delete')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleting(question);
                          }}
                          className="p-1 text-on-surface-variant opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
                {editing && !editing.id && (
                  <li className="flex items-center gap-2.5 rounded-xl bg-surface-container-high p-2.5 text-on-surface shadow-[0_0_16px_rgba(160,120,255,0.25)]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary-container text-label-sm font-bold text-on-primary-container">
                      #{ordered.length + 1}
                    </span>
                    <span className="truncate text-label-md">{editing.draft.prompt || t('host.editor.newQuestion')}</span>
                  </li>
                )}
              </ol>
              <div className="flex items-center justify-between pt-space-sm text-body-sm text-on-surface-variant">
                <span>{t('host.editor.totalPoints')}</span>
                <span className="text-label-lg text-secondary">
                  {totalPoints} {t('host.common.pointsShort')}
                </span>
              </div>
            </Card>
          </aside>

          <section className={`w-full flex-col gap-space-md xl:col-span-6 ${hidden('editor')} flex`}>
            {editing ? (
              <QuestionForm
                draft={editing.draft}
                index={editingIndex}
                isNew={!editing.id}
                dirty={questionDirty}
                busy={busy}
                mediaUrl={mediaUrl}
                mediaBusy={mediaBusy}
                onChange={(patch) => setEditing((current) => current && { ...current, draft: { ...current.draft, ...patch } })}
                onUploadMedia={(file) => void uploadMedia(file)}
                onRemoveMedia={() =>
                  setEditing((current) => current && { ...current, draft: { ...current.draft, media_path: null, media_type: null } })
                }
                onSave={() => void saveQuestion()}
                onRevert={() => setEditing((current) => current && { ...current, draft: current.original })}
                onDuplicate={() => void duplicateQuestion()}
                onDelete={() => setDeleting('current')}
              />
            ) : (
              <Card className="flex flex-col items-center justify-center gap-space-md p-12 text-center" testId="editor-empty">
                <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-highest text-primary shadow-[0_0_24px_rgba(160,120,255,0.2)]">
                  <Lightbulb className="h-9 w-9" />
                </div>
                <h3 className="text-headline-lg text-on-surface">{t('host.editor.emptyTitle')}</h3>
                <p className="max-w-md text-body-md text-on-surface-variant">{t('host.editor.emptyText')}</p>
                <button type="button" className={`${btn.primary} mt-2 px-space-lg py-3`} onClick={addQuestion}>
                  <Plus className="h-5 w-5" />
                  {t('host.editor.createFirst')}
                </button>
              </Card>
            )}
          </section>

          <aside className={`w-full flex-col gap-space-md xl:col-span-3 ${hidden('preview')} flex`}>
            {editing && (
              <PhonePreview draft={editing.draft} index={editingIndex} total={ordered.length + (editing.id ? 0 : 1)} mediaUrl={mediaUrl} />
            )}
            {editing && (
              <Card className="flex flex-col gap-2 p-space-md" testId="editor-validation">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-[18px] w-[18px] text-tertiary" />
                  <span className="text-label-md text-on-surface">{t('host.editor.validationTitle')}</span>
                </div>
                <div className="flex flex-col gap-1.5 text-body-sm">
                  {errors.length === 0 ? (
                    <div className="flex items-center gap-2 text-tertiary">
                      <CheckCircle2 className="h-4 w-4" />
                      {t('host.editor.validationOk')}
                    </div>
                  ) : (
                    errors.map((key) => (
                      <div key={key} className="flex items-center gap-2 text-secondary">
                        <TriangleAlert className="h-4 w-4 shrink-0" />
                        {t(key)}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}
            {editing && (
              <Card className="flex flex-col gap-2 p-space-md text-body-sm text-on-surface-variant">
                <span className="text-label-md text-on-surface">{t('host.editor.scoringTitle')}</span>
                <p>
                  {t(`host.editor.scoring.${editing.draft.type}`)} ({editing.draft.points} {t('host.common.pointsShort')})
                </p>
              </Card>
            )}
          </aside>
        </div>
      )}

      {pendingSwitch && (
        <ConfirmDialog
          icon={TriangleAlert}
          tone="danger"
          title={t('host.editor.leaveTitle')}
          text={t('host.editor.leaveText')}
          confirmLabel={t('host.editor.leaveConfirm')}
          cancelLabel={t('host.editor.leaveStay')}
          onConfirm={() => {
            const action = pendingSwitch;
            setPendingSwitch(null);
            action();
          }}
          onClose={() => setPendingSwitch(null)}
          testId="editor-leave-dialog"
        />
      )}
      {deleting && (
        <ConfirmDialog
          icon={Trash2}
          tone="danger"
          title={t('host.editor.deleteTitle')}
          text={t('host.editor.deleteText')}
          confirmLabel={t('host.editor.delete')}
          cancelLabel={t('host.editor.keep')}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleting(null)}
          testId="editor-delete-dialog"
        />
      )}
      {settingsOpen && quiz && (
        <QuizSettingsDialog
          token={token}
          quiz={quiz}
          categories={categories}
          onClose={() => setSettingsOpen(false)}
          onSaved={(updated) => {
            setQuiz(updated);
            setTitle(updated.title);
            setSettingsOpen(false);
            toast(t('host.editor.quizSaved'));
          }}
        />
      )}
    </div>
  );
}

function QuizSettingsDialog({
  token,
  quiz,
  categories,
  onClose,
  onSaved,
}: {
  token: string;
  quiz: Quiz;
  categories: Category[];
  onClose: () => void;
  onSaved: (quiz: Quiz) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(quiz.title);
  const [categoryId, setCategoryId] = useState(quiz.category_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await hostApi.updateQuiz(token, quiz.id, { title: title.trim(), categoryId: categoryId || null }));
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <Modal tone="surface" labelledBy="quiz-settings-title" onClose={onClose} className="max-w-lg" testId="quiz-settings-dialog">
      <div className="flex flex-col gap-space-md">
        <h3 id="quiz-settings-title" className="text-headline-sm text-on-surface">
          {t('host.editor.settings')}
        </h3>
        <div>
          <Label htmlFor="settings-title">{t('host.create.name')}</Label>
          <input
            id="settings-title"
            data-testid="settings-title"
            className={`${inputClass} p-space-md`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-space-md">
          <div>
            <Label htmlFor="settings-category">{t('host.create.category')}</Label>
            <select
              id="settings-category"
              data-testid="settings-category"
              className={`${inputClass} p-space-md`}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">{t('host.common.uncategorized')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <Pending feature="quiz-default-timer">
            <div>
              <Label>{t('host.editor.defaultTimer')}</Label>
              <select className={`${inputClass} p-space-md`} defaultValue="30">
                <option value="30">30 {t('host.editor.seconds')}</option>
              </select>
            </div>
          </Pending>
        </div>
        <Pending feature="venues">
          <div>
            <Label>{t('host.start.venue')}</Label>
            <input readOnly value="—" className={`${inputClass} p-space-md`} />
          </div>
        </Pending>
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-space-sm pt-space-sm">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {t('host.common.cancel')}
          </button>
          <button
            type="button"
            className={btn.primary}
            disabled={busy || !title.trim()}
            onClick={() => void save()}
            data-testid="settings-save"
          >
            {busy ? t('common.working') : t('host.editor.applySettings')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
