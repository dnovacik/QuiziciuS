import { useEffect, useMemo, useState } from 'react';
import { MapPin, Star, X } from 'lucide-react';
import { BADGES, COLORS, MAX_TEAM_PUBS, type Badge, type TeamColor } from './api';
import { useI18n } from '../lib/i18n';
import { pubsApi, type Pub } from '../lib/pubs';
import { BADGE_ICON, COLOR_STYLE } from './TeamEmblem';

export type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

/** Debounced uniqueness check of a team name; `currentName` (when editing) always counts as available. */
export function useNameAvailability(
  name: string,
  check: (name: string) => Promise<{ available: boolean }>,
  currentName?: string,
): Availability {
  const [status, setStatus] = useState<Availability>('idle');
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setStatus('idle');
      return;
    }
    if (trimmed.length < 3 || trimmed.length > 30) {
      setStatus('invalid');
      return;
    }
    if (currentName && trimmed.toLowerCase() === currentName.trim().toLowerCase()) {
      setStatus('available');
      return;
    }
    setStatus('checking');
    let active = true;
    const timer = setTimeout(() => {
      check(trimmed)
        .then((result) => active && setStatus(result.available ? 'available' : 'taken'))
        .catch(() => active && setStatus('error'));
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name, check, currentName]);
  return status;
}

export function BadgePicker({ value, onChange }: { value: Badge; onChange: (badge: Badge) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6" role="radiogroup" aria-label={t('team.form.badge')}>
      {BADGES.map((badge) => {
        const Icon = BADGE_ICON[badge];
        const selected = badge === value;
        return (
          <button
            key={badge}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`badge-${badge}`}
            onClick={() => onChange(badge)}
            className={`group relative flex flex-col items-center justify-center rounded-xl p-3.5 transition-all active:scale-95 ${
              selected
                ? 'bg-primary/10 shadow-[0_0_16px_-4px_rgba(160,120,255,0.4)] ring-2 ring-primary'
                : 'bg-surface-container hover:bg-surface-container-high'
            }`}
          >
            <Icon className="h-8 w-8 text-secondary transition-transform group-hover:scale-110" />
            <span className={`mt-1 text-[10px] ${selected ? 'text-on-surface' : 'text-on-surface-variant'}`}>
              {t(`team.badge.${badge}`)}
            </span>
            {selected && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: TeamColor; onChange: (color: TeamColor) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3" role="radiogroup" aria-label={t('team.form.color')}>
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={t(`team.color.${color}`)}
          data-testid={`color-${color}`}
          onClick={() => onChange(color)}
          className={`h-7 w-7 rounded-full transition-transform active:scale-90 ${COLOR_STYLE[color].swatch} ${
            color === value ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface-container-lowest' : 'hover:opacity-90'
          }`}
        />
      ))}
    </div>
  );
}

const SIZE_LABEL = ['team.size.2', 'team.size.3', 'team.size.4', 'team.size.5', 'team.size.6'] as const;

export function CapacityPicker({ value, onChange }: { value: number; onChange: (count: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('team.form.capacity')}>
      {[2, 3, 4, 5, 6].map((count, index) => {
        const selected = count === value;
        return (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`capacity-${count}`}
            onClick={() => onChange(count)}
            className={`flex flex-col items-center justify-center rounded-xl py-3 text-headline-sm transition-all ${
              selected
                ? 'bg-primary text-on-primary shadow-md ring-2 ring-primary'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span>{count}</span>
            <span className={`text-[10px] ${selected ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{t(SIZE_LABEL[index])}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The shared pub list (null while loading). */
export function usePubList(token: string): Pub[] | null {
  const [pubs, setPubs] = useState<Pub[] | null>(null);
  useEffect(() => {
    pubsApi
      .search(token)
      .then(setPubs)
      .catch(() => setPubs([]));
  }, [token]);
  return pubs;
}

/**
 * The pubs a team plays at, picked from the shared list hosts maintain. The starred pub is the
 * primary one — the pub the team represents in league standings.
 */
export function PubsPicker({
  pubs,
  pubIds,
  primaryPubId,
  onChange,
}: {
  pubs: Pub[] | null;
  pubIds: string[];
  primaryPubId: string | null;
  onChange: (pubIds: string[], primaryPubId: string | null) => void;
}) {
  const { t } = useI18n();
  const byId = useMemo(() => new Map((pubs ?? []).map((pub) => [pub.id, pub])), [pubs]);
  const byCity = useMemo(() => {
    const groups = new Map<string, Pub[]>();
    for (const pub of pubs ?? []) if (!pubIds.includes(pub.id)) groups.set(pub.city, [...(groups.get(pub.city) ?? []), pub]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pubs, pubIds]);
  const full = pubIds.length >= MAX_TEAM_PUBS;

  function add(pubId: string) {
    if (!pubId || full) return;
    onChange([...pubIds, pubId], primaryPubId ?? pubId);
  }
  function remove(pubId: string) {
    const rest = pubIds.filter((id) => id !== pubId);
    onChange(rest, primaryPubId === pubId ? (rest[0] ?? null) : primaryPubId);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="team-pubs">
      <span className="flex items-center justify-between text-label-md text-on-surface">
        {t('team.form.pubs')}
        <span className="text-body-sm text-on-surface-variant">
          {pubIds.length} / {MAX_TEAM_PUBS}
        </span>
      </span>
      {pubIds.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {pubIds.map((id) => {
            const pub = byId.get(id);
            const primary = id === primaryPubId;
            return (
              <li
                key={id}
                data-testid="team-pub-chip"
                data-primary={primary}
                className={`flex items-center gap-1 rounded-xl py-1 pl-1 pr-2 text-label-md ${
                  primary ? 'bg-secondary-container/30 text-on-surface ring-1 ring-secondary' : 'bg-surface-container text-on-surface'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChange(pubIds, id)}
                  aria-pressed={primary}
                  aria-label={t('team.form.makePrimary')}
                  title={t('team.form.makePrimary')}
                  data-testid={`team-pub-primary-${id}`}
                  className={`rounded-lg p-1 ${primary ? 'text-secondary' : 'text-on-surface-variant hover:text-secondary'}`}
                >
                  <Star className={`h-4 w-4 ${primary ? 'fill-current' : ''}`} />
                </button>
                <span>{pub ? `${pub.name}, ${pub.city}` : '…'}</span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={t('team.form.removePub')}
                  data-testid={`team-pub-remove-${id}`}
                  className="ml-1 rounded p-0.5 text-on-surface-variant hover:text-error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <span className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
        <select
          data-testid="team-pub-select"
          value=""
          disabled={full || pubs === null || byCity.length === 0}
          onChange={(event) => add(event.target.value)}
          className="h-12 w-full cursor-pointer appearance-none rounded-xl bg-surface-container-lowest pl-11 pr-4 text-body-md text-on-surface shadow-inner focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">
            {pubs === null
              ? t('common.working')
              : pubs.length === 0
                ? t('team.form.noPubs')
                : full
                  ? t('team.form.pubsFull')
                  : t('team.form.addPub')}
          </option>
          {byCity.map(([city, group]) => (
            <optgroup key={city} label={city}>
              {group.map((pub) => (
                <option key={pub.id} value={pub.id}>
                  {pub.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </span>
      <span className="text-body-sm text-on-surface-variant">{t('team.form.pubsHint')}</span>
    </div>
  );
}
