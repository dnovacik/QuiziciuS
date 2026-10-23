import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Check,
  History,
  Info,
  KeyRound,
  LogOut,
  MapPin,
  Pencil,
  QrCode,
  Radio,
  Share2,
  SlidersHorizontal,
  Star,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ApiError } from '../lib/api-client';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { pubLabel } from '../lib/pubs';
import { findSessionByCode, normalizeJoinCode } from '../lib/team-seat';
import { Modal } from '../ui/Modal';
import { Pending } from '../ui/Pending';
import { MAX_PLAYERS, profileOf, teamApi, type Player, type RegisteredTeam, type TeamProfile } from './api';
import { NameField } from './OnboardingPage';
import { BadgePicker, CapacityPicker, ColorPicker, PubsPicker, useNameAvailability, usePubList } from './profile-fields';
import { TeamEmblem } from './TeamEmblem';

const card = 'rounded-3xl bg-surface-container/70 p-space-md shadow-xl backdrop-blur-xl lg:p-space-lg';
const fieldClass =
  'w-full rounded-xl bg-surface-container-lowest px-space-md py-3 text-body-md text-on-surface shadow-inner focus:outline-none focus:ring-2 focus:ring-primary';

/** Stitch "Tímový Dashboard Kapitána". */
export function TeamDashboard({
  token,
  team,
  email,
  onUpdated,
}: {
  token: string;
  team: RegisteredTeam;
  email: string;
  onUpdated: (team: RegisteredTeam) => void;
}) {
  const { t } = useI18n();
  const [players, setPlayers] = useState<Player[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadPlayers = useCallback(() => {
    teamApi
      .players(token, team.id)
      .then(setPlayers)
      .catch((err) => setRosterError(describeError(err, t, 'errors.generic')));
  }, [token, team.id, t]);
  useEffect(loadPlayers, [loadPlayers]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-space-lg py-space-md" data-testid="team-dashboard">
      <section className="relative overflow-hidden rounded-3xl bg-surface-container/80 p-space-md shadow-xl backdrop-blur-2xl lg:p-space-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/20 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-secondary/15 blur-[90px]" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-space-lg lg:flex-row lg:items-center">
          <div className="flex flex-col items-center gap-space-md text-center sm:flex-row sm:items-start sm:text-left">
            <TeamEmblem badge={team.badge} color={team.badge_color} size="lg" />
            <div className="space-y-space-xs">
              <h1 className="text-headline-lg tracking-tight text-on-surface" data-testid="team-name">
                {team.name}
              </h1>
              <p className="max-w-lg text-body-md text-on-surface-variant">{team.description || t('team.dashboard.noMotto')}</p>
              <div className="flex flex-wrap items-center justify-center gap-space-sm pt-space-xs sm:justify-start">
                {team.pubs.map((pub) => (
                  <span
                    key={pub.id}
                    data-testid="team-pub"
                    title={pub.isPrimary ? t('team.dashboard.primaryPub') : undefined}
                    className={`flex items-center gap-1.5 rounded-xl px-space-sm py-1 text-label-md text-on-surface ${
                      pub.isPrimary ? 'bg-secondary-container/30 ring-1 ring-secondary/60' : 'bg-surface-container-high'
                    }`}
                  >
                    {pub.isPrimary ? (
                      <Star className="h-[18px] w-[18px] fill-current text-secondary" />
                    ) : (
                      <MapPin className="h-[18px] w-[18px] text-secondary" />
                    )}
                    {pubLabel(pub)}
                  </span>
                ))}
                {team.pubs.length === 0 && team.home_pub && (
                  <span className="flex items-center gap-1.5 rounded-xl bg-surface-container-high px-space-sm py-1 text-label-md text-on-surface-variant">
                    <MapPin className="h-[18px] w-[18px] text-secondary" />
                    {team.home_pub}
                  </span>
                )}
                <span className="flex items-center gap-1.5 rounded-xl bg-surface-container-high px-space-sm py-1 text-label-md text-on-surface">
                  <Users className="h-[18px] w-[18px] text-primary" />
                  {team.expected_members} {t('team.dashboard.atTable')}
                </span>
                <span className="flex items-center gap-1 rounded-xl bg-tertiary-container/30 px-space-sm py-1 text-label-md text-tertiary">
                  <Check className="h-4 w-4" />
                  {t('team.captain')}: {email}
                </span>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-row items-center gap-space-sm sm:flex-col lg:w-auto lg:flex-row">
            <button
              type="button"
              data-testid="team-edit-open"
              onClick={() => setEditing(true)}
              className="flex flex-1 items-center justify-center gap-space-xs rounded-xl bg-surface-container-high px-space-md py-space-sm text-label-lg text-on-surface shadow-md transition-all hover:bg-surface-bright active:scale-95 sm:flex-none"
            >
              <Pencil className="h-5 w-5" />
              {t('team.dashboard.edit')}
            </button>
            <Pending feature="team-invite-link" badge="inline">
              <span className="flex items-center justify-center gap-space-xs rounded-xl bg-primary-container px-space-md py-space-sm text-label-lg text-on-primary-container">
                <Share2 className="h-5 w-5" />
                {t('team.dashboard.share')}
              </span>
            </Pending>
          </div>
        </div>
      </section>

      <JoinQuizBar token={token} team={team} />

      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
        <section className={`${card} flex flex-col justify-between lg:col-span-5`} data-testid="team-roster">
          <div>
            <div className="mb-space-md flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <Users className="h-6 w-6 text-primary" />
                <h3 className="text-headline-sm text-on-surface">{t('team.roster.title')}</h3>
                <span
                  className="rounded-full bg-surface-container-high px-space-xs py-0.5 text-label-sm text-on-surface"
                  data-testid="roster-count"
                >
                  {players.length} / {MAX_PLAYERS}
                </span>
              </div>
              <button
                type="button"
                data-testid="roster-add-open"
                disabled={players.length >= MAX_PLAYERS}
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 rounded-xl bg-primary-container px-space-sm py-1 text-label-sm text-on-primary-container shadow-md transition-all hover:bg-primary active:scale-95 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                {t('team.roster.add')}
              </button>
            </div>
            <p className="mb-space-md text-body-sm text-on-surface-variant">{t('team.roster.hint')}</p>
            {rosterError && (
              <p role="alert" className="mb-space-sm text-body-sm text-error">
                {rosterError}
              </p>
            )}
            <ul className="space-y-space-xs">
              <li className="flex items-center justify-between rounded-2xl bg-surface-container-high/70 p-space-sm shadow-sm">
                <div className="flex min-w-0 items-center gap-space-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-headline-sm font-bold text-on-secondary-container">
                    {email.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-label-lg text-on-surface">{email}</span>
                    <span className="rounded bg-secondary/20 px-1.5 text-label-sm text-secondary">{t('team.captain')}</span>
                  </div>
                </div>
                <Star className="h-5 w-5 text-secondary" />
              </li>
              {players.map((player) => (
                <PlayerRow
                  key={player.id}
                  token={token}
                  teamId={team.id}
                  player={player}
                  onChanged={loadPlayers}
                  onError={setRosterError}
                />
              ))}
            </ul>
            {players.length === 0 && (
              <p className="mt-space-sm text-body-sm text-on-surface-variant" data-testid="roster-empty">
                {t('team.roster.empty')}
              </p>
            )}
          </div>
          <Pending feature="team-access-pin" className="mt-space-md">
            <div className="flex items-center justify-between gap-space-sm rounded-2xl bg-surface-container-lowest/80 p-space-sm">
              <div className="flex items-center gap-space-xs">
                <KeyRound className="h-5 w-5 text-primary" />
                <span className="text-label-sm text-on-surface-variant">{t('team.roster.pin')}</span>
              </div>
            </div>
          </Pending>
        </section>

        <div className="flex flex-col gap-space-lg lg:col-span-7">
          <Pending feature="leagues">
            <section className={card}>
              <span className="flex items-center gap-1 text-label-sm uppercase tracking-wider text-secondary">
                <Trophy className="h-4 w-4" />
                {t('team.dashboard.league')}
              </span>
              <p className="mt-space-xs text-body-sm text-on-surface-variant">{t('team.dashboard.leagueText')}</p>
            </section>
          </Pending>
          <Pending feature="scheduled-sessions">
            <section className={card}>
              <span className="flex items-center gap-1 text-label-sm uppercase tracking-wider text-secondary">
                <CalendarCheck className="h-4 w-4" />
                {t('team.dashboard.upcoming')}
              </span>
              <p className="mt-space-xs text-body-sm text-on-surface-variant">{t('team.dashboard.upcomingText')}</p>
            </section>
          </Pending>
          <section
            className={`${card} flex min-h-[320px] flex-col items-center justify-center text-center`}
            data-testid="team-history-empty"
          >
            <div className="mb-space-md flex h-20 w-20 items-center justify-center rounded-full bg-primary-container/20 text-primary shadow-inner">
              <History className="h-10 w-10" />
            </div>
            <h3 className="mb-space-xs text-headline-lg text-on-surface">{t('team.history.emptyTitle')}</h3>
            <p className="mb-space-lg max-w-md text-body-lg text-on-surface-variant">{t('team.history.emptyText')}</p>
            <div className="flex flex-col gap-space-sm sm:flex-row">
              <a
                href="#join-quiz"
                className="rounded-xl bg-secondary-container px-space-lg py-space-sm text-label-lg font-bold text-on-secondary-container shadow-md transition-all hover:bg-secondary"
              >
                {t('team.history.enterCode')}
              </a>
              <button
                type="button"
                onClick={() => setAdding(true)}
                disabled={players.length >= MAX_PLAYERS}
                className="rounded-xl bg-surface-container-high px-space-lg py-space-sm text-label-lg text-on-surface transition-all hover:bg-surface-bright disabled:opacity-50"
              >
                {t('team.history.addPlayers')}
              </button>
            </div>
            <div className="mt-space-xl flex max-w-sm items-center gap-space-xs rounded-2xl bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
              <Info className="h-5 w-5 shrink-0 text-secondary" />
              {t('team.history.note')}
            </div>
          </section>
        </div>
      </div>

      {editing && (
        <EditTeamDialog
          token={token}
          team={team}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            onUpdated(updated);
            setEditing(false);
          }}
        />
      )}
      {adding && (
        <AddPlayerDialog
          token={token}
          teamId={team.id}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            loadPlayers();
          }}
        />
      )}
    </div>
  );
}

/** "Pripojiť tím k aktuálnemu kvízu" — joins a live session under the team's name. */
function JoinQuizBar({ token, team }: { token: string; team: RegisteredTeam }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (busy || code.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const sessionId = await findSessionByCode(code);
      await teamApi.joinSession(token, team.id, sessionId);
      navigate(`/play/${sessionId}`);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? t('play.join.codeNotFound') : describeError(err, t, 'play.join.failed'));
      setBusy(false);
    }
  }

  return (
    <section
      id="join-quiz"
      className="relative scroll-mt-28 overflow-hidden rounded-3xl bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-low p-space-md shadow-2xl lg:p-space-lg"
    >
      <div className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-secondary/10 blur-[70px]" />
      <div className="flex flex-col items-stretch justify-between gap-space-lg xl:flex-row xl:items-center">
        <div className="flex items-start gap-space-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary-container/30 text-secondary shadow-lg lg:h-14 lg:w-14">
            <Radio className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-headline-md text-on-surface">{t('team.join.title')}</h2>
            <p className="text-body-md text-on-surface-variant">{t('team.join.text')}</p>
          </div>
        </div>
        <form
          className="flex flex-col items-center gap-space-sm sm:flex-row xl:min-w-[480px]"
          onSubmit={(event) => void join(event)}
          data-testid="team-join-form"
        >
          <div className="relative w-full sm:flex-1">
            <input
              data-testid="team-join-code"
              aria-label={t('play.join.pinLabel')}
              value={code}
              onChange={(event) => setCode(normalizeJoinCode(event.target.value))}
              placeholder="A7F3"
              maxLength={4}
              autoCapitalize="characters"
              className="h-14 w-full rounded-xl bg-surface-container-lowest/90 px-space-md pr-10 text-headline-sm uppercase tracking-widest text-on-surface shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {code && (
              <button
                type="button"
                aria-label={t('play.question.clear')}
                onClick={() => setCode('')}
                className="absolute inset-y-0 right-0 flex items-center pr-space-md text-on-surface-variant hover:text-on-surface"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
          <button
            type="submit"
            data-testid="team-join-submit"
            disabled={busy || code.length !== 4}
            className="flex h-14 w-full items-center justify-center gap-space-xs whitespace-nowrap rounded-xl bg-secondary px-space-lg text-label-lg font-bold text-on-secondary shadow-xl shadow-secondary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 sm:w-auto"
          >
            {busy ? t('common.working') : t('team.join.submit')}
            <ArrowRight className="h-5 w-5" />
          </button>
          <Pending feature="qr-scanner" badge="inline">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container text-primary shadow-md">
              <QrCode className="h-6 w-6" />
            </span>
          </Pending>
        </form>
      </div>
      {error && (
        <p role="alert" className="mt-space-sm text-body-sm text-error" data-testid="team-join-error">
          {error}
        </p>
      )}
    </section>
  );
}

function PlayerRow({
  token,
  teamId,
  player,
  onChanged,
  onError,
}: {
  token: string;
  teamId: string;
  player: Player;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(player.name);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    onError(null);
    try {
      await action();
      setRenaming(false);
      onChanged();
    } catch (err) {
      onError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className="flex items-center justify-between gap-space-sm rounded-2xl bg-surface-container-low p-space-sm shadow-sm transition-colors hover:bg-surface-container-high"
      data-testid="roster-player"
    >
      {renaming ? (
        <form
          className="flex flex-1 items-center gap-space-xs"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) void run(() => teamApi.renamePlayer(token, teamId, player.id, name));
          }}
        >
          <input
            autoFocus
            data-testid="roster-rename-input"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 rounded-lg bg-surface-container-lowest px-space-sm py-1.5 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg p-1.5 text-tertiary hover:bg-surface-container"
            aria-label={t('host.editor.save')}
          >
            <Check className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => setRenaming(false)}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container"
            aria-label={t('host.common.cancel')}
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </form>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-space-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-headline-sm font-bold text-on-surface">
              {player.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="truncate text-label-lg text-on-surface">{player.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => setRenaming(true)}
              className="p-1 text-on-surface-variant transition-colors hover:text-primary"
              aria-label={t('team.roster.rename')}
              data-testid={`roster-rename-${player.id}`}
            >
              <Pencil className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => teamApi.removePlayer(token, teamId, player.id))}
              className="p-1 text-on-surface-variant transition-colors hover:text-error"
              aria-label={t('team.roster.remove')}
              data-testid={`roster-remove-${player.id}`}
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function AddPlayerDialog({ token, teamId, onClose, onAdded }: { token: string; teamId: string; onClose: () => void; onAdded: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await teamApi.addPlayer(token, teamId, name);
      onAdded();
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <Modal tone="surface" labelledBy="add-player-title" onClose={onClose} className="max-w-md" testId="add-player-dialog">
      <form className="space-y-space-md" onSubmit={(event) => void submit(event)}>
        <div className="flex items-center gap-space-xs">
          <UserPlus className="h-6 w-6 text-primary" />
          <h3 id="add-player-title" className="text-headline-sm text-on-surface">
            {t('team.roster.addTitle')}
          </h3>
        </div>
        <p className="text-body-sm text-on-surface-variant">{t('team.roster.addHint')}</p>
        <input
          data-testid="roster-new-name"
          className={fieldClass}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('team.roster.namePlaceholder')}
        />
        <Pending feature="team-invite-link">
          <div className="space-y-space-xs">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('team.roster.inviteEmail')}</span>
            <input className={fieldClass} type="email" placeholder="kamos@pivo.sk" />
          </div>
        </Pending>
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-space-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-surface-container-high px-space-md py-space-sm text-label-md text-on-surface hover:bg-surface-bright"
          >
            {t('host.common.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            data-testid="roster-add-submit"
            className="rounded-xl bg-primary-container px-space-lg py-space-sm text-label-md font-bold text-on-primary-container shadow-md hover:bg-primary disabled:opacity-50"
          >
            {busy ? t('common.working') : t('team.roster.addSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditTeamDialog({
  token,
  team,
  onClose,
  onSaved,
}: {
  token: string;
  team: RegisteredTeam;
  onClose: () => void;
  onSaved: (team: RegisteredTeam) => void;
}) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<TeamProfile>(() => profileOf(team));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useCallback((name: string) => teamApi.availability(token, name), [token]);
  const availability = useNameAvailability(profile.name, check, team.name);
  const set = (patch: Partial<TeamProfile>) => setProfile((current) => ({ ...current, ...patch }));
  const pubList = usePubList(token);

  async function save() {
    if (busy || availability !== 'available') return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await teamApi.update(token, team.id, profile));
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <Modal tone="surface" labelledBy="edit-team-title" onClose={onClose} className="max-w-lg" testId="edit-team-dialog">
      <div className="space-y-space-md">
        <div className="flex items-center gap-space-xs">
          <SlidersHorizontal className="h-6 w-6 text-secondary" />
          <h3 id="edit-team-title" className="text-headline-sm text-on-surface">
            {t('team.edit.title')}
          </h3>
        </div>
        <NameField value={profile.name} onChange={(name) => set({ name })} availability={availability} />
        <label className="block space-y-1">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('team.form.motto')}</span>
          <textarea
            data-testid="edit-motto"
            rows={2}
            maxLength={160}
            className={`${fieldClass} resize-none`}
            value={profile.description}
            onChange={(event) => set({ description: event.target.value })}
          />
        </label>
        <PubsPicker
          pubs={pubList}
          pubIds={profile.pubIds}
          primaryPubId={profile.primaryPubId}
          onChange={(pubIds, primaryPubId) => set({ pubIds, primaryPubId })}
        />
        <BadgePicker value={profile.badge} onChange={(badge) => set({ badge })} />
        <div className="flex items-center justify-between gap-space-sm">
          <span className="text-label-md text-on-surface">{t('team.form.color')}</span>
          <ColorPicker value={profile.color} onChange={(color) => set({ color })} />
        </div>
        <CapacityPicker value={profile.expectedMembers} onChange={(expectedMembers) => set({ expectedMembers })} />
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-space-sm pt-space-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-surface-container-high px-space-md py-space-sm text-label-md text-on-surface hover:bg-surface-bright"
          >
            {t('host.common.cancel')}
          </button>
          <button
            type="button"
            data-testid="edit-save"
            disabled={busy || availability !== 'available'}
            onClick={() => void save()}
            className="rounded-xl bg-secondary-container px-space-lg py-space-sm text-label-md font-bold text-on-secondary-container shadow-md transition-all hover:bg-secondary disabled:opacity-50"
          >
            {busy ? t('common.working') : t('team.edit.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
