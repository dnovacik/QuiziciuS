import { Brain, Crown, Shield, Star, Trophy, Zap, type LucideIcon } from 'lucide-react';
import type { Badge, TeamColor } from './api';

export const BADGE_ICON: Record<Badge, LucideIcon> = {
  shield: Shield,
  crown: Crown,
  bolt: Zap,
  star: Star,
  brain: Brain,
  trophy: Trophy,
};

/** Tailwind classes per team colour: swatch, emblem tile and glow. */
export const COLOR_STYLE: Record<TeamColor, { swatch: string; tile: string; glow: string }> = {
  purple: { swatch: 'bg-primary-container', tile: 'bg-primary-container text-on-primary-container', glow: 'shadow-[0_0_24px_rgba(160,120,255,0.4)]' },
  amber: { swatch: 'bg-secondary', tile: 'bg-secondary text-on-secondary', glow: 'shadow-[0_0_24px_rgba(255,185,95,0.4)]' },
  cyan: { swatch: 'bg-sky-400', tile: 'bg-sky-400 text-sky-950', glow: 'shadow-[0_0_24px_rgba(56,189,248,0.4)]' },
  green: { swatch: 'bg-tertiary', tile: 'bg-tertiary text-on-tertiary', glow: 'shadow-[0_0_24px_rgba(78,222,163,0.4)]' },
  pink: { swatch: 'bg-rose-400', tile: 'bg-rose-400 text-rose-950', glow: 'shadow-[0_0_24px_rgba(251,113,133,0.4)]' },
};

export function TeamEmblem({ badge, color, size = 'md' }: { badge: Badge; color: TeamColor; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = BADGE_ICON[badge];
  const style = COLOR_STYLE[color];
  const box = { sm: 'h-10 w-10 rounded-lg', md: 'h-16 w-16 rounded-2xl', lg: 'h-24 w-24 rounded-2xl lg:h-28 lg:w-28' }[size];
  const icon = { sm: 'h-6 w-6', md: 'h-9 w-9', lg: 'h-14 w-14' }[size];
  return (
    <div className={`flex shrink-0 items-center justify-center ${box} ${style.tile} ${style.glow}`} data-testid="team-emblem" data-badge={badge} data-color={color}>
      <Icon className={icon} />
    </div>
  );
}
