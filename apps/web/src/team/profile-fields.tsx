import { useEffect, useState } from 'react';
import { BADGES, COLORS, type Badge, type TeamColor } from './api';
import { useI18n } from '../lib/i18n';
import { BADGE_ICON, COLOR_STYLE } from './TeamEmblem';

export type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

/** Debounced uniqueness check of a team name; `currentName` (when editing) always counts as available. */
export function useNameAvailability(name: string, check: (name: string) => Promise<{ available: boolean }>, currentName?: string): Availability {
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
              selected ? 'bg-primary/10 shadow-[0_0_16px_-4px_rgba(160,120,255,0.4)] ring-2 ring-primary' : 'bg-surface-container hover:bg-surface-container-high'
            }`}
          >
            <Icon className="h-8 w-8 text-secondary transition-transform group-hover:scale-110" />
            <span className={`mt-1 text-[10px] ${selected ? 'text-on-surface' : 'text-on-surface-variant'}`}>{t(`team.badge.${badge}`)}</span>
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
              selected ? 'bg-primary text-on-primary shadow-md ring-2 ring-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
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
