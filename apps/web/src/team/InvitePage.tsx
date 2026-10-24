import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api-client';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { Logo } from '../ui/Logo';
import { BADGES, COLORS, type Badge, type TeamColor } from './api';
import { TeamEmblem } from './TeamEmblem';

interface InvitePreview {
  name: string;
  badge: string;
  badgeColor: string;
  rosterSize: number;
}

const asBadge = (value: string): Badge => ((BADGES as readonly string[]).includes(value) ? (value as Badge) : 'shield');
const asColor = (value: string): TeamColor => ((COLORS as readonly string[]).includes(value) ? (value as TeamColor) : 'purple');

/** /join-team/:inviteToken — a teammate puts their name on the roster; no account needed. */
export default function InvitePage() {
  const { inviteToken = '' } = useParams<{ inviteToken: string }>();
  const { t } = useI18n();
  const [team, setTeam] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<InvitePreview>(`/team-access/invite/${encodeURIComponent(inviteToken)}`)
      .then((row) => active && setTeam(row))
      .catch((err) => active && setLoadError(describeError(err, t, 'errors.generic')));
    return () => {
      active = false;
    };
  }, [inviteToken, t]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/team-access/invite/${encodeURIComponent(inviteToken)}/players`, { name: name.trim() });
      setJoined(true);
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-container-lowest text-on-surface" data-testid="team-invite">
      <header className="flex items-center justify-between p-space-md">
        <Logo size="md" />
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center p-space-md">
        <section className="flex w-full max-w-md flex-col items-center gap-space-md rounded-3xl bg-surface-container-low p-space-lg text-center shadow-2xl">
          {loadError ? (
            <p role="alert" className="text-body-md text-error" data-testid="team-invite-error">
              {loadError}
            </p>
          ) : !team ? (
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-busy="true" />
          ) : joined ? (
            <>
              <CheckCircle2 className="h-14 w-14 text-tertiary" />
              <span className="text-label-sm uppercase tracking-widest text-secondary">{t('team.invite.joined')}</span>
              <h1 className="text-headline-md text-on-surface" data-testid="team-invite-joined">
                {team.name}
              </h1>
              <p className="text-body-md text-on-surface-variant">{t('team.invite.joinedText')}</p>
              <Link to="/" className="text-label-lg text-primary underline">
                {t('team.invite.home')}
              </Link>
            </>
          ) : (
            <>
              <TeamEmblem badge={asBadge(team.badge)} color={asColor(team.badgeColor)} size="md" />
              <span className="text-label-sm uppercase tracking-widest text-secondary">{t('team.invite.tag')}</span>
              <h1 className="text-headline-lg text-on-surface" data-testid="team-invite-name">
                {team.name}
              </h1>
              <p className="text-body-md text-on-surface-variant">{t('team.invite.text')}</p>
              <form className="flex w-full flex-col gap-space-sm" onSubmit={(event) => void submit(event)}>
                <input
                  data-testid="team-invite-player"
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('team.roster.namePlaceholder')}
                  className="h-12 w-full rounded-xl bg-surface-container-lowest px-space-md text-body-md text-on-surface outline-none placeholder:text-outline focus:ring-2 focus:ring-primary"
                />
                {error && (
                  <p role="alert" className="text-body-sm text-error">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  data-testid="team-invite-submit"
                  className="flex h-12 items-center justify-center gap-space-xs rounded-xl bg-primary-container text-label-lg font-bold text-on-primary-container disabled:opacity-50"
                >
                  <UserPlus className="h-5 w-5" />
                  {t('team.invite.submit')}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
