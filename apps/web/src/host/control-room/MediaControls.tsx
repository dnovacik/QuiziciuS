import { useEffect, useState } from 'react';
import { AlertTriangle, Pause, Play, RotateCcw, VolumeX } from 'lucide-react';
import type { MediaAction, MediaPlaybackState, MediaRefDto, MediaSlot } from '@quizicius/shared-types';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { formatPart } from '../../lib/media-ref';
import { KIND_ICONS, KIND_LABELS } from '../editor/MediaSlot';
import { btn } from '../ui';

const STATE_LABELS: Record<MediaPlaybackState | 'waiting', TranslationKey> = {
  playing: 'host.room.media.playing',
  paused: 'host.room.media.paused',
  ended: 'host.room.media.ended',
  error: 'host.room.media.error',
  blocked: 'host.room.media.blocked',
  waiting: 'host.room.media.waiting',
};
/** How long the projector may take to answer a play before the host is told it is not responding. */
const NO_ANSWER_MS = 4000;

/**
 * Player bar for one clip of the current question: the projector plays it, this bar starts,
 * pauses and replays it, and shows what the projector reports back.
 */
export function MediaControls({
  slot,
  media,
  status,
  enabled,
  onControl,
}: {
  slot: MediaSlot;
  media: MediaRefDto;
  /** The projector's last report, and when it arrived. */
  status: { state: MediaPlaybackState; at: number } | null;
  enabled: boolean;
  onControl: (action: MediaAction) => void;
}) {
  const { t } = useI18n();
  const id = `room-media-${slot}`;
  const Icon = KIND_ICONS[media.kind];
  const part = formatPart(media);
  // After a play, wait for the projector's answer; silence means the projector is not open.
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [silent, setSilent] = useState(false);
  const answered = sentAt !== null && status !== null && status.at >= sentAt;
  useEffect(() => {
    if (sentAt === null || answered) return;
    const timer = window.setTimeout(() => setSilent(true), NO_ANSWER_MS);
    return () => window.clearTimeout(timer);
  }, [sentAt, answered]);

  const send = (action: MediaAction) => {
    if (action !== 'pause') {
      setSilent(false);
      setSentAt(Date.now());
    }
    onControl(action);
  };
  const shown = silent && !answered ? 'waiting' : (status?.state ?? null);
  const warn = shown === 'blocked' || shown === 'error' || shown === 'waiting';

  return (
    <div className="flex flex-wrap items-center gap-space-sm rounded-xl bg-surface-container-high p-space-sm" data-testid={id}>
      <span className="flex items-center gap-1.5 text-label-md text-on-surface">
        <Icon className="h-5 w-5 text-secondary" />
        {t(slot === 'question' ? 'host.room.media.question' : 'host.room.media.reveal')}: {t(KIND_LABELS[media.kind])}
      </span>
      {part && <span className="text-label-sm text-secondary">{part}</span>}
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          className={`${btn.primary} px-space-sm py-1 text-label-sm`}
          disabled={!enabled}
          onClick={() => send('play')}
          data-testid={`${id}-play`}
        >
          <Play className="h-4 w-4" />
          {t('host.room.media.play')}
        </button>
        <button
          type="button"
          className={`${btn.secondary} px-space-sm py-1 text-label-sm`}
          disabled={!enabled}
          onClick={() => send('pause')}
          data-testid={`${id}-pause`}
        >
          <Pause className="h-4 w-4" />
          {t('host.room.media.pause')}
        </button>
        <button
          type="button"
          className={`${btn.secondary} px-space-sm py-1 text-label-sm`}
          disabled={!enabled}
          onClick={() => send('replay')}
          data-testid={`${id}-replay`}
        >
          <RotateCcw className="h-4 w-4" />
          {t('host.room.media.replay')}
        </button>
      </div>
      {shown && (
        <span
          className={`flex w-full items-center gap-1.5 text-label-sm ${warn ? 'text-error' : 'text-tertiary'}`}
          data-testid={`${id}-state`}
          role={warn ? 'alert' : undefined}
        >
          {shown === 'blocked' ? <VolumeX className="h-4 w-4" /> : warn ? <AlertTriangle className="h-4 w-4" /> : null}
          {t(STATE_LABELS[shown])}
        </span>
      )}
    </div>
  );
}
