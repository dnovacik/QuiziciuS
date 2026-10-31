import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Beer, KeyRound, LogIn, Lock, Mail, Smartphone, Table2, UserPlus, Users, Zap } from 'lucide-react';
import { ApiError, apiPost } from '../lib/api-client';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase-client';
import { findSessionByCode, joinSession, normalizeJoinCode, type AttendanceMode } from '../lib/team-seat';
import { FieldLabel, FormNotice, IconInput, IconSelect, SegmentedControl, primaryButtonClass } from '../ui/form';
import { GOOGLE_AUTH, GoogleButton } from '../ui/GoogleButton';
import { Modal } from '../ui/Modal';

type Tab = 'quick' | 'register' | 'login';
type Notice = { tone: 'error' | 'success'; text: string };

const MEMBER_COUNTS = [2, 3, 4, 5, 6] as const;

/** Team entrance dialog from the Stitch portal, plus a captain sign-in tab. */
export function TeamEntryModal({ onClose, onSwitchToHost }: { onClose: () => void; onSwitchToHost: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('quick');
  const [code, setCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('IN_PERSON');
  const [teamPin, setTeamPin] = useState('');
  const [askPin, setAskPin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [members, setMembers] = useState(4);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function switchTab(next: Tab) {
    setTab(next);
    setNotice(null);
  }

  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      // A registered team plays under this name: its members join with the team PIN.
      if (error instanceof ApiError && error.body.code === 'TEAM_NAME_RESERVED') setAskPin(true);
      setNotice({ tone: 'error', text: describeError(error, t, 'errors.generic') });
    } finally {
      setPending(false);
    }
  }

  function quickJoin(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const sessionId = await findSessionByCode(code);
      await joinSession(sessionId, teamName, tableNumber, askPin ? teamPin : '', attendanceMode);
      navigate(`/play/${sessionId}`);
    });
  }

  function registerTeam(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const name = teamName.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { team_name: name, expected_members: members } },
      });
      if (error) throw error;
      if (!data.session) {
        setNotice({ tone: 'success', text: t('teamEntry.register.confirmEmail') });
        return;
      }
      try {
        await apiPost('/registered-teams', { name, expectedMembers: members }, data.session.access_token);
      } catch {
        // The captain account exists; the team hub's onboarding form lets them retry with another name.
      }
      navigate('/team');
    });
  }

  function login(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/team');
    });
  }

  function resetPassword() {
    void run(async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setNotice({ tone: 'success', text: t('landing.auth.recoverSent') });
    });
  }

  const submitLabel = pending ? t('common.working') : null;

  return (
    <Modal labelledBy="team-entry-title" onClose={onClose} testId="team-entry-modal" className="max-w-[500px]">
      <div className="pointer-events-none absolute -left-12 -top-12 h-36 w-36 rounded-full bg-purple-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-amber-500/20 blur-3xl" />

      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-600/30 to-indigo-600/30 shadow-[0_0_25px_-4px_rgba(139,92,246,0.5)]">
          <Users className="h-7 w-7 text-brand-glow drop-shadow" />
        </div>
        <h2 id="team-entry-title" className="text-2xl font-extrabold tracking-tight text-white">
          {t('teamEntry.title')}
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400 sm:text-sm">{t('teamEntry.subtitle')}</p>
      </div>

      <div className="mb-6">
        <SegmentedControl
          testIdPrefix="team-tab"
          value={tab}
          onChange={switchTab}
          options={[
            { value: 'quick', label: t('teamEntry.tab.quick'), icon: Zap },
            { value: 'register', label: t('teamEntry.tab.register'), icon: UserPlus },
            { value: 'login', label: t('teamEntry.tab.login'), icon: LogIn },
          ]}
        />
      </div>

      {tab === 'quick' && (
        <form className="space-y-4" onSubmit={quickJoin} data-testid="team-quick-form">
          <FieldLabel label={t('teamEntry.quick.code')} hint={<span className="text-brand-glow">{t('teamEntry.quick.codeHint')}</span>}>
            <input
              data-testid="team-code"
              className="glass-input border-brand-500/30 bg-purple-950/20 px-4 py-3 text-center text-2xl font-black uppercase tracking-[0.3em] placeholder:text-slate-600"
              value={code}
              onChange={(event) => setCode(normalizeJoinCode(event.target.value))}
              placeholder="A7F3"
              autoCapitalize="characters"
              minLength={4}
              maxLength={4}
              required
            />
          </FieldLabel>
          <FieldLabel label={t('teamEntry.teamName')}>
            <IconInput
              icon={Users}
              data-testid="team-name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder={t('teamEntry.quick.namePlaceholder')}
              maxLength={80}
              required
            />
          </FieldLabel>
          <FieldLabel label={t('play.join.attendanceTitle')} hint={t(`teamEntry.quick.attendanceHint.${attendanceMode}`)}>
            <SegmentedControl
              options={[
                { value: 'IN_PERSON', label: t('teamEntry.quick.inPerson'), icon: Beer },
                { value: 'REMOTE', label: t('teamEntry.quick.remote'), icon: Smartphone },
              ]}
              value={attendanceMode}
              onChange={setAttendanceMode}
              testIdPrefix="team-attendance"
            />
          </FieldLabel>
          <FieldLabel label={`${t('teamEntry.quick.table')} (${t('common.optional')})`}>
            <IconInput
              icon={Table2}
              data-testid="team-table"
              value={tableNumber}
              onChange={(event) => setTableNumber(event.target.value)}
              placeholder={t('teamEntry.quick.tablePlaceholder')}
              maxLength={10}
            />
          </FieldLabel>
          {askPin ? (
            <FieldLabel label={t('team.access.pinLabel')}>
              <IconInput
                icon={KeyRound}
                data-testid="team-pin-input"
                value={teamPin}
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                onChange={(event) => setTeamPin(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
              />
            </FieldLabel>
          ) : (
            <button
              type="button"
              onClick={() => setAskPin(true)}
              className="text-label-md text-primary hover:underline"
              data-testid="team-pin-toggle"
            >
              {t('team.access.registeredTeam')}
            </button>
          )}
          {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
          <button type="submit" data-testid="team-join-submit" disabled={pending} className={`${primaryButtonClass} mt-2`}>
            {submitLabel ?? t('teamEntry.quick.submit')}
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </form>
      )}

      {tab === 'register' && (
        <form className="space-y-3.5" onSubmit={registerTeam} data-testid="team-register-form">
          <FieldLabel label={t('teamEntry.teamName')}>
            <IconInput
              icon={Users}
              data-testid="team-register-name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder={t('teamEntry.register.namePlaceholder')}
              minLength={3}
              maxLength={30}
              required
            />
          </FieldLabel>
          <FieldLabel label={t('teamEntry.captainEmail')}>
            <IconInput
              icon={Mail}
              data-testid="team-register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('teamEntry.register.emailPlaceholder')}
              required
            />
          </FieldLabel>
          <FieldLabel label={t('teamEntry.password')}>
            <IconInput
              icon={Lock}
              data-testid="team-register-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('teamEntry.register.passwordPlaceholder')}
              minLength={6}
              required
            />
          </FieldLabel>
          <FieldLabel label={t('teamEntry.register.members')}>
            <IconSelect
              icon={Users}
              data-testid="team-register-members"
              value={members}
              onChange={(event) => setMembers(Number(event.target.value))}
            >
              {MEMBER_COUNTS.map((count) => (
                <option key={count} value={count}>
                  {t(`teamEntry.register.members${count}`)}
                </option>
              ))}
            </IconSelect>
          </FieldLabel>
          {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
          <button
            type="submit"
            data-testid="team-register-submit"
            disabled={pending}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 font-bold text-white shadow-neon-violet transition-all hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50"
          >
            {submitLabel ?? t('teamEntry.register.submit')}
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </form>
      )}

      {tab === 'login' && (
        <form className="space-y-4" onSubmit={login} data-testid="team-login-form">
          <FieldLabel label={t('teamEntry.captainEmail')}>
            <IconInput
              icon={Mail}
              data-testid="team-login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FieldLabel>
          <FieldLabel label={t('teamEntry.password')}>
            <IconInput
              icon={Lock}
              data-testid="team-login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FieldLabel>
          {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
          <button type="submit" data-testid="team-login-submit" disabled={pending} className={`${primaryButtonClass} mt-2`}>
            {submitLabel ?? t('teamEntry.login.submit')}
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
          {GOOGLE_AUTH && <GoogleButton returnPath="/team" onError={(text) => setNotice({ tone: 'error', text })} />}
          <button
            type="button"
            data-testid="team-forgot-password"
            disabled={pending || !email}
            onClick={resetPassword}
            className="block w-full text-center text-xs font-medium text-purple-300 hover:text-purple-200 disabled:opacity-50"
          >
            {t('landing.auth.forgotPassword')}
          </button>
        </form>
      )}

      <div className="mt-5 border-t border-white/10 pt-4 text-center">
        <button
          type="button"
          data-testid="team-switch-host"
          onClick={onSwitchToHost}
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-purple-300"
        >
          {t('teamEntry.switchToHost')}
          <span className="text-amber-400 transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </Modal>
  );
}
