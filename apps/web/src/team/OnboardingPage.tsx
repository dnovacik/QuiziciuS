import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, BadgeCheck, CheckCircle2, Contact, Info, Lightbulb, Loader2, MapPin, Palette, Quote, Shuffle, Store, TableProperties, UserPlus, Users, XCircle } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { Modal } from '../ui/Modal';
import { teamApi, type RegisteredTeam, type TeamProfile } from './api';
import { BadgePicker, CapacityPicker, ColorPicker, useNameAvailability, type Availability } from './profile-fields';
import { TeamEmblem } from './TeamEmblem';

const NAME_IDEAS = ['Múdre kačky', 'Kvízové šelmy', 'Pivný Mozart', 'Atómové hlavy', 'Bystrí lišiaci', 'Nočné sovy', 'Štamgasti z rohu', 'Krčmoví géniovia'];

function initials(text: string): string {
  return text.slice(0, 2).toUpperCase();
}

/** Stitch "Vytvorenie tímu (Onboarding kapitána)". */
export function OnboardingPage({
  token,
  email,
  suggestedName,
  suggestedMembers,
  onCreated,
}: {
  token: string;
  email: string;
  suggestedName: string;
  suggestedMembers: number;
  onCreated: (team: RegisteredTeam) => void;
}) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<TeamProfile>({
    name: suggestedName,
    description: '',
    badge: 'shield',
    color: 'purple',
    expectedMembers: Math.min(6, Math.max(2, suggestedMembers)),
    homePub: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegisteredTeam | null>(null);
  const check = useCallback((name: string) => teamApi.availability(token, name), [token]);
  const availability = useNameAvailability(profile.name, check);
  const set = (patch: Partial<TeamProfile>) => setProfile((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || availability !== 'available') return;
    setBusy(true);
    setError(null);
    try {
      setCreated(await teamApi.create(token, profile));
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-7xl py-space-md" data-testid="team-onboarding">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-label-sm uppercase tracking-wider text-primary">{t('team.onboarding.step')}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
          <span className="text-body-sm text-on-surface-variant">{t('team.onboarding.next')}</span>
        </div>
        <div className="flex items-center gap-3 self-start rounded-2xl bg-surface-container-low px-3 py-1.5 shadow-sm sm:self-auto">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-secondary text-xs font-bold text-on-primary shadow-md">
            {initials(email)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-tertiary" />
          </div>
          <div className="flex flex-col">
            <span className="w-fit rounded bg-secondary-container/20 px-1.5 text-[10px] font-bold uppercase text-secondary">{t('team.captain')}</span>
            <span className="text-[11px] leading-tight text-on-surface-variant">{email}</span>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-headline-lg font-extrabold tracking-tight text-on-surface lg:text-[34px] lg:leading-[42px]">{t('team.onboarding.title')}</h1>
        <p className="mt-2 max-w-3xl text-body-lg text-on-surface-variant">{t('team.onboarding.subtitle')}</p>
      </div>

      <form className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12" onSubmit={(event) => void submit(event)} data-testid="team-create-form">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Section icon={Contact} tone="text-primary" title={t('team.form.identity')} subtitle={t('team.form.identityHint')} required={t('play.join.required')}>
            <NameField value={profile.name} onChange={(name) => set({ name })} availability={availability} />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-on-surface-variant">{t('team.form.ideas')}</span>
              {NAME_IDEAS.slice(0, 3).map((idea) => (
                <button key={idea} type="button" onClick={() => set({ name: idea })} className="rounded-lg bg-surface-container px-2.5 py-1 text-[11px] text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface">
                  {idea}
                </button>
              ))}
              <button
                type="button"
                onClick={() => set({ name: NAME_IDEAS[Math.floor(Math.random() * NAME_IDEAS.length)] })}
                className="ml-auto flex items-center gap-1 text-label-sm text-primary transition-colors hover:text-primary-fixed"
              >
                <Shuffle className="h-3.5 w-3.5" />
                {t('team.form.random')}
              </button>
            </div>
          </Section>

          <Section icon={Palette} tone="text-secondary" title={t('team.form.badgeTitle')} subtitle={t('team.form.badgeHint')}>
            <BadgePicker value={profile.badge} onChange={(badge) => set({ badge })} />
            <div className="flex flex-col justify-between gap-3 pt-2 sm:flex-row sm:items-center">
              <span className="text-label-md text-on-surface">{t('team.form.color')}</span>
              <ColorPicker value={profile.color} onChange={(color) => set({ color })} />
            </div>
          </Section>

          <Section icon={TableProperties} tone="text-tertiary" title={t('team.form.tableTitle')} subtitle={t('team.form.tableHint')}>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-label-md text-on-surface">{t('team.form.capacity')}</span>
                <span className="text-body-sm text-on-surface-variant">{t('team.form.capacityRule')}</span>
              </div>
              <CapacityPicker value={profile.expectedMembers} onChange={(expectedMembers) => set({ expectedMembers })} />
            </div>
            <label className="flex flex-col gap-2">
              <span className="flex items-center justify-between text-label-md text-on-surface">
                {t('team.form.homePub')}
                <span className="text-body-sm text-on-surface-variant">{t('common.optional')}</span>
              </span>
              <span className="relative">
                <Store className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
                <input
                  data-testid="team-home-pub"
                  value={profile.homePub}
                  maxLength={100}
                  onChange={(event) => set({ homePub: event.target.value })}
                  placeholder={t('team.form.homePubPlaceholder')}
                  className="h-12 w-full rounded-xl bg-surface-container-lowest pl-11 pr-4 text-body-md text-on-surface shadow-inner placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </span>
            </label>
            <label className="flex flex-col gap-2">
              <span className="flex items-center justify-between text-label-md text-on-surface">
                {t('team.form.motto')}
                <span className="text-body-sm text-on-surface-variant">{profile.description.length} / 160</span>
              </span>
              <textarea
                data-testid="team-motto"
                rows={2}
                maxLength={160}
                value={profile.description}
                onChange={(event) => set({ description: event.target.value })}
                placeholder={t('team.form.mottoPlaceholder')}
                className="w-full resize-none rounded-xl bg-surface-container-lowest p-3.5 text-body-md text-on-surface shadow-inner placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </Section>

          {error && (
            <p role="alert" className="rounded-xl bg-error-container/30 p-space-md text-body-md text-on-error-container">
              {error}
            </p>
          )}

          <div className="flex flex-col items-center justify-end gap-4 rounded-2xl bg-surface-container-low/70 p-4 backdrop-blur-md sm:flex-row">
            <button
              type="submit"
              data-testid="team-create-submit"
              disabled={busy || availability !== 'available'}
              className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-8 py-3 text-headline-sm text-on-primary shadow-[0_0_24px_-4px_rgba(160,120,255,0.45)] transition-all hover:bg-primary-container active:scale-95 disabled:opacity-50 sm:w-auto"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
              {t('team.onboarding.submit')}
            </button>
          </div>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:col-span-5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-tertiary" />
              <span className="text-label-lg uppercase tracking-wider text-on-surface">{t('team.preview.title')}</span>
            </div>
            <span className="text-body-sm text-on-surface-variant">{t('team.preview.hint')}</span>
          </div>
          <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl bg-surface-container-high/90 p-7 shadow-2xl backdrop-blur-2xl" data-testid="team-preview">
            <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-52 w-52 rounded-full bg-secondary/15 blur-3xl" />
            <div className="relative z-10 flex items-center gap-3.5">
              <TeamEmblem badge={profile.badge} color={profile.color} />
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">{t('team.preview.newTeam')}</span>
                <h3 className="truncate text-headline-md font-extrabold tracking-tight text-on-surface" data-testid="team-preview-name">
                  {profile.name.trim() || t('team.preview.unnamed')}
                </h3>
                {profile.homePub.trim() && (
                  <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
                    <MapPin className="h-3.5 w-3.5" />
                    {profile.homePub}
                  </span>
                )}
              </div>
            </div>
            {profile.description.trim() && (
              <div className="relative z-10 rounded-xl bg-surface-container-lowest/60 p-3.5">
                <Quote className="absolute left-2 top-2 h-4 w-4 text-primary opacity-40" />
                <p className="line-clamp-2 pl-5 text-body-sm italic text-on-surface/90">„{profile.description}“</p>
              </div>
            )}
            <div className="relative z-10 flex flex-col gap-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-label-md text-on-surface">
                  <Users className="h-4 w-4 text-primary" />
                  {t('team.preview.roster')}
                </span>
                <span className="rounded-md bg-surface-container px-2 py-0.5 text-label-sm text-on-surface-variant">
                  1 / {profile.expectedMembers}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2.5 rounded-xl bg-surface-container-low p-2 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-secondary text-xs font-bold text-on-primary">{initials(email)}</div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-label-sm text-on-surface">{email}</span>
                    <span className="text-[10px] font-bold text-secondary">{t('team.captain')}</span>
                  </div>
                </div>
                {Array.from({ length: profile.expectedMembers - 1 }, (_, index) => (
                  <div key={index} className="flex items-center gap-2.5 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-lowest/50 p-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-outline">
                      <UserPlus className="h-4 w-4" />
                    </div>
                    <span className="text-[12px] text-outline">{t('team.preview.openSeat')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3.5 rounded-2xl bg-surface-container-low/70 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary-container/20 text-secondary">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h4 className="text-label-md font-bold text-on-surface">{t('team.tip.title')}</h4>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">{t('team.tip.text')}</p>
            </div>
          </div>
        </aside>
      </form>

      {created && (
        <Modal tone="surface" labelledBy="team-created-title" onClose={() => onCreated(created)} className="max-w-md" testId="team-created-dialog">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-tertiary/15 text-tertiary shadow-[0_0_30px_rgba(78,222,163,0.35)]">
              <CheckCircle2 className="h-12 w-12" />
              <div className="absolute inset-0 animate-ping rounded-full border-2 border-tertiary opacity-25" />
            </div>
            <span className="mb-2 rounded-full bg-tertiary/10 px-3 py-1 text-label-sm font-bold uppercase tracking-wider text-tertiary">{t('team.created.badge')}</span>
            <h3 id="team-created-title" className="mb-2 text-headline-lg font-extrabold text-on-surface">
              {t('team.created.title')}
            </h3>
            <p className="mb-6 text-body-lg text-on-surface-variant">
              <strong className="text-on-surface">{created.name}</strong> {t('team.created.text')}
            </p>
            <div className="mb-6 flex w-full items-center gap-3 rounded-xl bg-surface-container-lowest/80 p-4 text-left">
              <TeamEmblem badge={created.badge} color={created.badge_color} size="sm" />
              <div>
                <div className="text-label-md font-bold text-on-surface">{created.name}</div>
                {created.home_pub && <div className="text-body-sm text-on-surface-variant">{created.home_pub}</div>}
              </div>
            </div>
            <button
              type="button"
              data-testid="team-created-continue"
              onClick={() => onCreated(created)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-headline-sm text-on-primary shadow-lg transition-transform hover:bg-primary-container active:scale-95"
            >
              <BadgeCheck className="h-5 w-5" />
              {t('team.created.continue')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  tone,
  title,
  subtitle,
  required,
  children,
}: {
  icon: typeof Info;
  tone: string;
  title: string;
  subtitle: string;
  required?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative flex flex-col gap-6 overflow-hidden rounded-2xl bg-surface-container-low/90 p-6 shadow-xl backdrop-blur-xl md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container ${tone}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-headline-sm text-on-surface">{title}</h2>
            <p className="text-body-sm text-on-surface-variant">{subtitle}</p>
          </div>
        </div>
        {required && <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-label-sm text-secondary">{required}</span>}
      </div>
      {children}
    </section>
  );
}

export function NameField({ value, onChange, availability }: { value: string; onChange: (name: string) => void; availability: Availability }) {
  const { t } = useI18n();
  const message: Record<Availability, string> = {
    idle: t('team.name.hint'),
    checking: t('team.name.checking'),
    available: t('team.name.available'),
    taken: t('team.name.taken'),
    invalid: t('errors.INVALID_NAME'),
    error: t('team.name.checkFailed'),
  };
  const tone = availability === 'available' ? 'text-tertiary' : availability === 'taken' || availability === 'invalid' ? 'text-error' : 'text-on-surface-variant';
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center justify-between text-label-md text-on-surface" htmlFor="team-name-input">
        {t('teamEntry.teamName')}
        <span className="text-body-sm text-on-surface-variant">{value.length} / 30</span>
      </label>
      <div className="relative flex items-center">
        <Users className="pointer-events-none absolute left-4 h-5 w-5 text-on-surface-variant" />
        <input
          id="team-name-input"
          data-testid="team-name-input"
          autoComplete="off"
          maxLength={30}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('team.name.placeholder')}
          className="w-full rounded-xl bg-surface-container-lowest py-3 pl-11 pr-12 text-[16px] font-semibold text-on-surface shadow-inner transition-all placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <span className="absolute right-3.5 flex items-center">
          {availability === 'available' && <CheckCircle2 className="h-5 w-5 text-tertiary" />}
          {availability === 'checking' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {(availability === 'taken' || availability === 'invalid') && <XCircle className="h-5 w-5 text-error" />}
        </span>
      </div>
      <p className={`text-body-sm ${tone}`} data-testid="team-name-status" data-status={availability}>
        {message[availability]}
      </p>
    </div>
  );
}
