import { MonitorPlay, Volume2 } from 'lucide-react';
import type { MediaKind } from '@quizicius/shared-types';
import { useI18n } from '../lib/i18n';

/** Shown on phones instead of a clip: sound and video come from the projector only. */
export function ProjectorMediaCard({ kind, compact = false }: { kind: Exclude<MediaKind, 'image'>; compact?: boolean }) {
  const { t } = useI18n();
  const listen = kind === 'audio';
  const Icon = listen ? Volume2 : MonitorPlay;
  return (
    <div
      className={`flex items-center justify-center gap-3 rounded-xl border border-secondary/30 bg-secondary/10 text-secondary ${
        compact ? 'p-2 text-xs font-bold' : 'p-space-md text-label-lg'
      }`}
      data-testid="projector-media-card"
    >
      <Icon className={compact ? 'h-4 w-4' : 'h-7 w-7'} />
      {t(listen ? 'play.media.listen' : 'play.media.watch')}
    </div>
  );
}
