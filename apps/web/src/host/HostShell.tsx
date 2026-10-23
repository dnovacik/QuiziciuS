import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, CirclePlus, LayoutGrid, LogOut, Menu, NotebookPen, Radio, Settings, Trophy, UserRound, X } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase-client';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { LogoMark } from '../ui/Logo';
import { Modal } from '../ui/Modal';
import { Pending } from '../ui/Pending';
import { hostApi, type Category, type HostSession } from './api';
import { btn, inputClass, Label } from './ui';

const NAV_ITEM =
  'flex w-full items-center gap-space-sm rounded-xl px-space-md py-3 text-label-lg transition-all hover:bg-surface-container-high hover:text-on-surface';
const NAV_ACTIVE =
  'bg-primary-container text-on-primary-container shadow-[0_0_20px_-4px_rgba(160,120,255,0.4)] hover:bg-primary-container hover:text-on-primary-container';

/** Sidebar + top bar from the Stitch host dashboard and quiz editor. */
export function HostShell({ token, email, children }: { token: string; email: string; children: ReactNode }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sessions, setSessions] = useState<HostSession[]>([]);

  useEffect(() => {
    hostApi
      .listSessions(token)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [token]);
  const live = sessions.filter((session) => session.status !== 'FINISHED').length;

  const navLink = ({ isActive }: { isActive: boolean }) => `${NAV_ITEM} ${isActive ? NAV_ACTIVE : 'text-on-surface-variant'}`;

  const sidebar = (
    <aside className="flex h-full w-72 flex-col justify-between bg-surface-container-low/95 backdrop-blur-xl">
      <div className="flex flex-col">
        <div className="flex h-16 items-center gap-space-sm px-space-lg">
          <LogoMark />
          <div className="flex flex-col">
            <span className="text-headline-sm tracking-tight text-on-surface">QuiziciuS</span>
            <span className="text-label-sm uppercase tracking-widest text-secondary">Pub Engine</span>
          </div>
        </div>
        <div className="px-space-md py-space-sm">
          <div className="mb-space-xs px-space-sm py-space-xs text-label-sm uppercase tracking-wider text-on-surface-variant">
            {t('host.nav.title')}
          </div>
          <nav className="flex flex-col gap-space-xs" onClick={() => setMenuOpen(false)}>
            <NavLink to="/host" end className={navLink} data-testid="host-nav-dashboard">
              <LayoutGrid className="h-5 w-5" />
              {t('host.nav.dashboard')}
            </NavLink>
            <NavLink to="/host/quizzes" className={navLink} data-testid="host-nav-quizzes">
              <NotebookPen className="h-5 w-5" />
              {t('host.nav.quizzes')}
            </NavLink>
            <button
              type="button"
              className={`${NAV_ITEM} text-on-surface-variant`}
              onClick={() => setCreating(true)}
              data-testid="host-nav-create"
            >
              <CirclePlus className="h-5 w-5" />
              {t('host.nav.create')}
            </button>
            <NavLink to="/host/sessions" className={navLink} data-testid="host-nav-sessions">
              <Radio className="h-5 w-5" />
              {t('host.nav.sessions')}
              {live > 0 && <span className="ml-auto h-2 w-2 rounded-full bg-tertiary shadow-[0_0_8px_#4edea3]" />}
            </NavLink>
            <Pending feature="leagues">
              <span className={`${NAV_ITEM} text-on-surface-variant`}>
                <Trophy className="h-5 w-5" />
                {t('host.nav.leagues')}
              </span>
            </Pending>
            <Pending feature="host-settings">
              <span className={`${NAV_ITEM} text-on-surface-variant`}>
                <Settings className="h-5 w-5" />
                {t('host.nav.settings')}
              </span>
            </Pending>
          </nav>
        </div>
      </div>
      <div className="m-space-md rounded-xl bg-surface-container-high/60 p-space-md">
        <div className="mb-space-xs flex items-center gap-space-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
            <UserRound className="h-4 w-4 text-primary" />
          </div>
          <span className="text-label-sm uppercase text-secondary">{t('host.nav.account')}</span>
        </div>
        <div className="truncate text-body-md font-semibold text-on-surface" title={email}>
          {email}
        </div>
        <button
          type="button"
          data-testid="host-logout"
          onClick={() => void supabase.auth.signOut()}
          className="mt-space-sm flex items-center gap-space-xs text-label-md text-on-surface-variant hover:text-error"
        >
          <LogOut className="h-4 w-4" />
          {t('host.nav.signOut')}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface">
      <div className="fixed left-0 top-0 z-50 hidden h-full lg:block">{sidebar}</div>
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}
        >
          {sidebar}
          <div className="flex-1 bg-surface-container-lowest/70 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="lg:pl-72">
        <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between bg-surface-container-low/80 px-space-lg backdrop-blur-xl lg:left-72">
          <div className="flex items-center gap-space-sm">
            <button
              type="button"
              className={`${btn.icon} lg:hidden`}
              aria-label={t('host.nav.menu')}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span
              className={`h-2.5 w-2.5 rounded-full ${live ? 'bg-tertiary shadow-[0_0_8px_#4edea3]' : 'bg-secondary shadow-[0_0_8px_#ffb95f]'}`}
            />
            <span
              className={`text-label-md uppercase tracking-wide ${live ? 'text-tertiary' : 'text-secondary'}`}
              data-testid="host-live-status"
            >
              {live ? `${live} ${t('host.header.liveSessions')}` : t('host.header.ready')}
            </span>
          </div>
          <div className="flex items-center gap-space-md">
            <LanguageSwitcher />
            <Pending feature="notifications" badge="inline">
              <span className="flex rounded-xl p-space-sm text-on-surface-variant">
                <Bell className="h-5 w-5" />
              </span>
            </Pending>
            <div className="hidden items-center gap-space-sm sm:flex">
              <div className="flex flex-col text-right">
                <span className="max-w-[200px] truncate text-label-lg text-on-surface">{email}</span>
                <span className="text-body-sm text-on-surface-variant">{t('host.header.role')}</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <UserRound className="h-[18px] w-[18px] text-on-primary" />
              </div>
            </div>
          </div>
        </header>
        <main className="relative min-h-screen w-full px-space-md pb-16 pt-20 sm:px-space-lg">{children}</main>
      </div>

      {creating && <CreateQuizDialog token={token} onClose={() => setCreating(false)} />}
    </div>
  );
}

/** "Vytvoriť kvíz" — creates the quiz and opens it in the editor. */
export function CreateQuizDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hostApi
      .listCategories(token)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [token]);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const quiz = await hostApi.createQuiz(token, title, categoryId || null);
      onClose();
      navigate(`/host/quizzes/${quiz.id}`);
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <Modal tone="surface" labelledBy="create-quiz-title" onClose={onClose} className="max-w-lg" testId="create-quiz-dialog">
      <form
        className="flex flex-col gap-space-md"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container/20 text-primary">
            <CirclePlus className="h-6 w-6" />
          </div>
          <h3 id="create-quiz-title" className="text-headline-sm text-on-surface">
            {t('host.create.title')}
          </h3>
        </div>
        <div>
          <Label htmlFor="create-quiz-name">{t('host.create.name')}</Label>
          <input
            id="create-quiz-name"
            data-testid="create-quiz-name"
            className={inputClass}
            value={title}
            maxLength={120}
            required
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="create-quiz-category">{t('host.create.category')}</Label>
          <select
            id="create-quiz-category"
            className={inputClass}
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
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-space-xs pt-space-xs">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {t('host.common.cancel')}
          </button>
          <button type="submit" className={btn.primary} disabled={busy || !title.trim()} data-testid="create-quiz-submit">
            {busy ? t('common.working') : t('host.create.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
