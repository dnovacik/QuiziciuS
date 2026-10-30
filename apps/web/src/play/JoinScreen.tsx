import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { AlertCircle, BadgeCheck, Camera, Hash, History, KeyRound, LogIn, QrCode, Table2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api-client';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import {
  findSessionByCode,
  joinSession,
  normalizeJoinCode,
  parseJoinTarget,
  recentTeamNames,
  type TeamSeat,
  type AttendanceMode,
} from '../lib/team-seat';
import { useSessionDisplay } from '../lib/use-quiz-title';
import { useSessionState } from '../lib/use-session-state';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Logo } from '../ui/Logo';
import { QrScanner } from '../ui/QrScanner';

type Method = 'pin' | 'link';

/** Stitch "Mobilný Vstup a Pripojenie" — players join with the 4-character code or a /play/:id link. */
export function JoinScreen({ sessionId, onJoined }: { sessionId?: string; onJoined: (seat: TeamSeat) => void }) {
  const { t } = useI18n();
  const { title, pub } = useSessionDisplay(sessionId);
  const { state } = useSessionState(sessionId);
  const [method, setMethod] = useState<Method>('pin');
  const [pin, setPin] = useState(['', '', '', '']);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();

  /** A scanned join link opens that quiz night; a scanned code fills the code boxes. */
  function onScanned(text: string): boolean {
    const target = parseJoinTarget(text);
    if (!target) return false;
    setScanning(false);
    if ('sessionId' in target) navigate(`/play/${target.sessionId}`);
    else {
      setPin(target.code.split(''));
      setMethod('pin');
    }
    return true;
  }
  const [teamName, setTeamName] = useState('');
  const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('IN_PERSON');
  const [tableNumber, setTableNumber] = useState('');
  const [teamPin, setTeamPin] = useState('');
  const [askPin, setAskPin] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent] = useState(recentTeamNames);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = pin.join('');
  const canSubmit = teamName.trim().length > 0 && (Boolean(sessionId) || code.length === 4);

  function setPinFrom(index: number, raw: string) {
    const chars = normalizeJoinCode(raw).split('');
    if (chars.length === 0) {
      setPin((current) => current.map((value, i) => (i === index ? '' : value)));
      return;
    }
    setPin((current) => {
      const next = [...current];
      chars.forEach((char, offset) => {
        if (index + offset < 4) next[index + offset] = char;
      });
      return next;
    });
    pinRefs.current[Math.min(index + chars.length, 3)]?.focus();
  }

  function onPinKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !pin[index] && index > 0) pinRefs.current[index - 1]?.focus();
  }

  function onPinPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    setPinFrom(index, event.clipboardData.getData('text'));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const resolvedSessionId = sessionId ?? (await findSessionByCode(code));
      onJoined(await joinSession(resolvedSessionId, teamName, tableNumber, askPin ? teamPin : '', attendanceMode));
    } catch (err) {
      const code = err instanceof ApiError ? err.body.code : undefined;
      // A registered team plays under this name: its members join with the team PIN.
      if (code === 'TEAM_NAME_RESERVED') setAskPin(true);
      setError(
        err instanceof ApiError && err.status === 404 && code !== 'TEAM_NOT_REGISTERED'
          ? t('play.join.codeNotFound')
          : describeError(err, t, 'play.join.failed'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-container-lowest text-on-surface" data-testid="player-join">
      {scanning && <QrScanner onResult={onScanned} onClose={() => setScanning(false)} rejectedText={t('scanner.notQuiz')} />}
      <main className="relative mx-auto flex w-full max-w-xl flex-col px-margin pb-10">
        <div className="pointer-events-none relative mb-space-sm w-full overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-36 w-72 -translate-x-1/2 rounded-full bg-primary-container/20 blur-3xl" />
          <div className="absolute -top-12 right-0 h-24 w-44 rounded-full bg-secondary/15 blur-2xl" />
        </div>

        <header className="mb-space-md flex w-full items-center justify-between pt-space-md">
          <Logo size="sm" to="/" />
          <LanguageSwitcher />
        </header>

        {sessionId && (
          <section className="mb-space-md flex w-full items-center justify-between rounded-xl bg-surface-container p-space-sm">
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm uppercase tracking-wider text-secondary">{t('play.join.eventTag')}</span>
              <span className="truncate text-body-md font-semibold text-on-surface" data-testid="player-quiz-title">
                {title ?? t('play.join.eventFallback')}
              </span>
              {pub && (
                <span className="truncate text-body-sm text-on-surface-variant" data-testid="player-quiz-pub">
                  {pub}
                </span>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-container-highest px-2.5 py-1 text-label-sm text-tertiary">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-tertiary" />
              LIVE
            </span>
          </section>
        )}

        {sessionId ? (
          <section
            className="mb-space-md flex w-full items-center gap-space-sm rounded-xl bg-surface-container-low p-space-sm"
            data-testid="player-direct-link"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary-container/30">
              <BadgeCheck className="h-5 w-5 text-tertiary" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm font-bold text-tertiary">
                {t('play.join.linkVerified')} {state ? `#${state.joinCode}` : ''}
              </span>
              <span className="truncate text-body-sm text-on-surface-variant">{t('play.join.linkVerifiedHint')}</span>
            </div>
          </section>
        ) : (
          <div role="tablist" className="mb-space-md flex w-full items-center rounded-xl bg-surface-container-low p-1 shadow-inner">
            <MethodTab active={method === 'pin'} onClick={() => setMethod('pin')} icon={<Hash className="h-5 w-5 text-primary" />}>
              {t('play.join.tabPin')}
            </MethodTab>
            <MethodTab active={method === 'link'} onClick={() => setMethod('link')} icon={<QrCode className="h-5 w-5 text-secondary" />}>
              {t('play.join.tabLink')}
            </MethodTab>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-space-md flex w-full items-center gap-space-sm rounded-xl bg-error-container p-space-sm text-on-error-container shadow-lg"
          >
            <AlertCircle className="h-6 w-6 shrink-0 text-error" />
            <div className="flex min-w-0 flex-col">
              <span className="text-label-md font-bold">{t('play.join.errorTitle')}</span>
              <span className="text-body-sm">{error}</span>
            </div>
          </div>
        )}

        <section className="relative mb-space-md w-full overflow-hidden rounded-xl bg-surface-container p-space-md shadow-2xl">
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

          {!sessionId && method === 'link' ? (
            <div className="flex flex-col gap-space-md text-center">
              <QrCode className="mx-auto h-12 w-12 text-secondary" />
              <p className="text-body-md text-on-surface-variant">{t('play.join.linkHint')}</p>
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-surface-container-high text-label-md text-on-surface"
                data-testid="player-scan"
              >
                <Camera className="h-5 w-5 text-secondary" />
                {t('play.join.scanQr')}
              </button>
              <button type="button" className="text-label-md text-primary underline" onClick={() => setMethod('pin')}>
                {t('play.join.usePinInstead')}
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-space-md" onSubmit={submit} data-testid="player-join-form">
              {!sessionId && (
                <fieldset className="m-0 flex min-w-0 flex-col gap-space-xs border-0 p-0">
                  <legend className="mb-space-xs flex items-center gap-1 text-label-md uppercase tracking-wider text-on-surface-variant">
                    <KeyRound className="h-4 w-4 text-primary" />
                    {t('play.join.pinLabel')}
                  </legend>
                  <div className="grid grid-cols-4 gap-space-xs py-1">
                    {pin.map((char, index) => (
                      <div key={index} className="relative">
                        <input
                          ref={(element) => {
                            pinRefs.current[index] = element;
                          }}
                          data-testid={`player-pin-${index}`}
                          aria-label={`${t('play.join.pinLabel')} ${index + 1}`}
                          value={char}
                          onChange={(event) => setPinFrom(index, event.target.value.slice(-1))}
                          onKeyDown={(event) => onPinKeyDown(index, event)}
                          onPaste={(event) => onPinPaste(index, event)}
                          autoCapitalize="characters"
                          autoComplete="off"
                          inputMode="text"
                          className="h-14 w-full rounded-xl bg-surface-container-lowest text-center text-headline-lg uppercase text-on-surface caret-primary outline-none transition-all duration-150 focus:bg-surface-container-high focus:text-primary"
                        />
                        <div className="absolute bottom-1.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary/50" />
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="flex flex-col gap-space-xs">
                <label
                  htmlFor="player-team-name"
                  className="flex items-center justify-between text-label-md uppercase tracking-wider text-on-surface-variant"
                >
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-secondary" />
                    {t('play.join.teamName')}
                  </span>
                  <span className="text-label-sm text-secondary">{t('play.join.required')}</span>
                </label>
                <input
                  id="player-team-name"
                  data-testid="player-team-name"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder={t('play.join.teamPlaceholder')}
                  maxLength={80}
                  required
                  className="w-full rounded-xl bg-surface-container-lowest px-space-md py-3 text-body-lg text-on-surface outline-none transition-all duration-150 placeholder:text-outline focus:bg-surface-container-high focus:text-secondary"
                />
                {recent.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                      <History className="h-3.5 w-3.5" />
                      {t('play.join.recentTeams')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {recent.map((name) => (
                        <button
                          key={name}
                          type="button"
                          data-testid="player-recent-team"
                          onClick={() => setTeamName(name)}
                          className="flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-label-sm text-on-surface transition-all hover:bg-surface-bright"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${name === teamName ? 'bg-secondary' : 'bg-outline'}`} />
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <fieldset className="flex flex-col gap-2 rounded-xl bg-surface-container-high p-3">
                <legend className="text-label-md font-bold">{t('play.join.attendanceTitle')}</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="attendance"
                    checked={attendanceMode === 'IN_PERSON'}
                    onChange={() => setAttendanceMode('IN_PERSON')}
                  />
                  {t('play.join.inPerson')}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="attendance"
                    checked={attendanceMode === 'REMOTE'}
                    onChange={() => setAttendanceMode('REMOTE')}
                  />
                  {t('play.join.remote')}
                </label>
              </fieldset>
              <label className="flex flex-col gap-space-xs">
                <span className="flex items-center gap-1 text-label-md uppercase tracking-wider text-on-surface-variant">
                  <Table2 className="h-4 w-4 text-outline" />
                  {t('teamEntry.quick.table')} ({t('common.optional')})
                </span>
                <input
                  data-testid="player-table"
                  value={tableNumber}
                  maxLength={10}
                  onChange={(event) => setTableNumber(event.target.value)}
                  placeholder={t('teamEntry.quick.tablePlaceholder')}
                  className="h-12 w-full rounded-xl bg-surface-container-lowest px-space-md text-body-md text-on-surface outline-none placeholder:text-outline"
                />
              </label>

              {askPin ? (
                <label className="flex flex-col gap-space-xs">
                  <span className="flex items-center gap-1 text-label-md uppercase tracking-wider text-on-surface-variant">
                    <KeyRound className="h-4 w-4 text-outline" />
                    {t('team.access.pinLabel')}
                  </span>
                  <input
                    data-testid="player-team-pin"
                    value={teamPin}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    onChange={(event) => setTeamPin(event.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="h-12 w-full rounded-xl bg-surface-container-lowest px-space-md text-center font-mono text-headline-sm tracking-[0.4em] text-on-surface outline-none placeholder:text-outline"
                  />
                  <span className="text-body-sm text-on-surface-variant">{t('team.access.pinJoinHint')}</span>
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setAskPin(true)}
                  className="self-start text-label-md text-primary hover:underline"
                  data-testid="player-team-pin-toggle"
                >
                  {t('team.access.registeredTeam')}
                </button>
              )}

              <div className="flex flex-col gap-space-sm pt-2">
                <button
                  type="submit"
                  data-testid="player-join-submit"
                  disabled={pending || !canSubmit}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-container via-primary to-primary-container text-label-lg uppercase tracking-wider text-on-primary-container shadow-lg shadow-primary-container/30 transition-all duration-150 active:scale-95 disabled:opacity-50"
                >
                  {pending ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary-container border-t-transparent" />
                  ) : (
                    <LogIn className="h-5 w-5" />
                  )}
                  {t('play.join.submit')}
                </button>
              </div>
            </form>
          )}
        </section>

        {state && (
          <section
            className="flex w-full items-center gap-2 rounded-xl bg-surface-container-low p-space-sm"
            data-testid="player-join-teams"
          >
            <Users className="h-4 w-4 text-primary" />
            <span className="text-body-sm text-on-surface-variant">
              {t('play.join.teamsJoined')} <strong className="text-on-surface">{state.teams.length}</strong>
            </span>
          </section>
        )}
      </main>
    </div>
  );
}

function MethodTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-label-md transition-all duration-300 ${
        active ? 'bg-surface-container-highest text-on-surface shadow-md' : 'text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
