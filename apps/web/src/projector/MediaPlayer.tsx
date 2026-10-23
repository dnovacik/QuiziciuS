import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Music } from 'lucide-react';
import type { MediaPlaybackState, MediaSlot, ResolvedMediaDto } from '@quizicius/shared-types';
import { useI18n } from '../lib/i18n';
import { sendMediaStatus, subscribeToMediaControl } from '../lib/media-channel';
import { youtubeId } from '../lib/media-ref';
import { createYouTubePlayer, YT_STATE, type YouTubePlayer } from '../lib/youtube';

/** Whether someone clicked the projector page, so the browser lets it play sound. */
export const ProjectorSound = createContext(false);

interface SlotHandle {
  play(): void;
  pause(): void;
  replay(): void;
}
type Report = (state: MediaPlaybackState) => void;
/** A YouTube player that is not ready by then is reported as an error… */
const READY_TIMEOUT_MS = 10_000;
/** …and a play that has not started by then as blocked sound. */
const START_TIMEOUT_MS = 3000;

/**
 * The current question's media on the projector. Nothing plays by itself: the host plays, pauses
 * and replays each slot from the control room (MEDIA_CONTROL), and the projector reports back what
 * it is really doing (MEDIA_STATUS). A new question starts from a clean slate.
 */
export function ProjectorMedia(props: {
  sessionId: string;
  questionId: string;
  media: ResolvedMediaDto | null;
  revealMedia: ResolvedMediaDto | null;
  revealed: boolean;
}) {
  return <MediaStage key={props.questionId} {...props} />;
}

function MediaStage({
  sessionId,
  questionId,
  media,
  revealMedia,
  revealed,
}: {
  sessionId: string;
  questionId: string;
  media: ResolvedMediaDto | null;
  revealMedia: ResolvedMediaDto | null;
  revealed: boolean;
}) {
  const sound = useContext(ProjectorSound);
  const questionSlot = useRef<SlotHandle>(null);
  const revealSlot = useRef<SlotHandle>(null);
  const [revealPlaying, setRevealPlaying] = useState(false);
  const latest = useRef({ sound, media, revealMedia, revealed });
  latest.current = { sound, media, revealMedia, revealed };

  const reporter = useCallback(
    (slot: MediaSlot): Report =>
      (state) =>
        sendMediaStatus(sessionId, { questionId, slot, state }),
    [sessionId, questionId],
  );

  // The reveal stops whatever the question was playing.
  useEffect(() => {
    if (revealed) questionSlot.current?.pause();
  }, [revealed]);

  useEffect(
    () =>
      subscribeToMediaControl(sessionId, (message) => {
        const now = latest.current;
        const ref = message.slot === 'question' ? now.media : now.revealMedia;
        if (message.questionId !== questionId || !ref || ref.kind === 'image') return;
        if (message.slot === 'reveal' && !now.revealed) return;
        if (!now.sound && message.action !== 'pause') {
          reporter(message.slot)('blocked');
          return;
        }
        if (message.slot === 'reveal') {
          if (message.action !== 'pause') setRevealPlaying(true);
          questionSlot.current?.pause();
        } else if (message.action !== 'pause') {
          setRevealPlaying(false);
          revealSlot.current?.pause();
        }
        (message.slot === 'question' ? questionSlot : revealSlot).current?.[message.action]();
      }),
    [sessionId, questionId, reporter],
  );

  const revealShown = revealed && revealMedia !== null && (revealPlaying || revealMedia.kind === 'image');
  return (
    <>
      {media && (
        <div hidden={revealShown} data-testid="projector-media-question">
          <SlotPlayer ref={questionSlot} slot="question" media={media} report={reporter('question')} />
        </div>
      )}
      {revealed && revealMedia && (
        <div hidden={!revealShown} data-testid="projector-media-reveal">
          <SlotPlayer ref={revealSlot} slot="reveal" media={revealMedia} report={reporter('reveal')} />
        </div>
      )}
    </>
  );
}

const SlotPlayer = forwardRef<SlotHandle, { slot: MediaSlot; media: ResolvedMediaDto; report: Report }>(function SlotPlayer(
  { slot, media, report },
  ref,
) {
  const { t } = useI18n();
  if (media.kind === 'image') {
    return (
      <img
        data-testid={slot === 'question' ? 'projector-image' : 'projector-reveal-image'}
        src={media.url}
        alt={t('play.question.image')}
        className="mx-auto max-h-[40vh] max-w-full rounded-xl object-contain shadow-2xl"
      />
    );
  }
  if (media.kind === 'youtube') return <YouTubeSlot ref={ref} slot={slot} media={media} report={report} />;
  return <FileSlot ref={ref} slot={slot} media={media} report={report} />;
});

/** The selected part: from `start`, until `end` (null = to the end of the clip). */
function partOf(media: ResolvedMediaDto) {
  const start = media.startSeconds ?? 0;
  return { start, end: media.durationSeconds ? start + media.durationSeconds : null };
}

const FileSlot = forwardRef<SlotHandle, { slot: MediaSlot; media: ResolvedMediaDto; report: Report }>(function FileSlot(
  { slot, media, report },
  ref,
) {
  const { t } = useI18n();
  const element = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const started = useRef(false);
  const ended = useRef(false);
  const [playing, setPlaying] = useState(false);
  const { start, end } = partOf(media);

  const run = (from: number | null) => {
    const el = element.current;
    if (!el) return;
    if (from !== null) el.currentTime = from;
    started.current = true;
    ended.current = false;
    el.play().catch((err: unknown) => report(err instanceof DOMException && err.name === 'NotAllowedError' ? 'blocked' : 'error'));
  };
  useImperativeHandle(ref, () => ({
    play: () => run(!started.current || ended.current ? start : null),
    replay: () => run(start),
    pause: () => element.current?.pause(),
  }));
  useEffect(() => {
    const el = element.current;
    return () => el?.pause();
  }, []);

  const finish = () => {
    ended.current = true;
    setPlaying(false);
    report('ended');
  };
  const events = {
    onLoadedMetadata: () => {
      if (!started.current && element.current) element.current.currentTime = start;
    },
    onPlaying: () => {
      setPlaying(true);
      report('playing');
    },
    onPause: () => {
      setPlaying(false);
      if (!ended.current) report('paused');
    },
    onEnded: finish,
    onError: () => report('error'),
    onTimeUpdate: () => {
      const el = element.current;
      if (end === null || !el || el.paused || el.currentTime < end) return;
      ended.current = true;
      el.pause();
      finish();
    },
  };

  if (media.kind === 'video') {
    return (
      <video
        ref={element}
        data-testid={`projector-video-${slot}`}
        src={media.url}
        preload="auto"
        playsInline
        className="mx-auto max-h-[45vh] max-w-full rounded-xl bg-black shadow-2xl"
        {...events}
      />
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-space-lg rounded-xl bg-surface-container/90 p-space-lg shadow-2xl">
      <audio ref={element} data-testid={`projector-audio-${slot}`} src={media.url} preload="auto" {...events} />
      <Music className={`h-14 w-14 ${playing ? 'text-secondary' : 'text-outline'}`} />
      <div className="flex h-14 items-end gap-1.5" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
          <span
            key={bar}
            className={`w-2.5 rounded-full bg-secondary ${playing ? 'animate-pulse' : 'opacity-30'}`}
            style={{ height: `${30 + ((bar * 37) % 70)}%`, animationDelay: `${bar * 120}ms` }}
          />
        ))}
      </div>
      <span className="text-headline-sm font-bold text-on-surface">{t(playing ? 'projector.media.playing' : 'projector.media.ready')}</span>
    </div>
  );
});

const YouTubeSlot = forwardRef<SlotHandle, { slot: MediaSlot; media: ResolvedMediaDto; report: Report }>(function YouTubeSlot(
  { slot, media, report },
  ref,
) {
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const waiting = useRef<keyof SlotHandle | null>(null);
  const started = useRef(false);
  const ended = useRef(false);
  const playingNow = useRef(false);
  const watchdog = useRef<number | undefined>(undefined);
  const reportRef = useRef(report);
  reportRef.current = report;
  const { start, end } = partOf(media);
  const videoId = youtubeId(media.url);

  const act = useCallback(
    (action: keyof SlotHandle) => {
      const yt = player.current;
      if (!yt) {
        waiting.current = action;
        return;
      }
      if (action === 'pause') {
        yt.pauseVideo();
        return;
      }
      if (action === 'replay' || !started.current || ended.current) yt.seekTo(start, true);
      started.current = true;
      ended.current = false;
      yt.playVideo();
      // A play the browser refuses (no click on the projector yet) leaves YouTube silent: say so.
      window.clearTimeout(watchdog.current);
      watchdog.current = window.setTimeout(() => {
        if (!playingNow.current) reportRef.current('blocked');
      }, START_TIMEOUT_MS);
    },
    [start],
  );
  useImperativeHandle(ref, () => ({ play: () => act('play'), replay: () => act('replay'), pause: () => act('pause') }), [act]);

  useEffect(() => {
    const box = holder.current;
    if (!box || !videoId) {
      reportRef.current('error');
      return;
    }
    let alive = true;
    const target = document.createElement('div');
    box.appendChild(target);
    createYouTubePlayer(
      target,
      videoId,
      { start, end },
      {
        onStateChange: (state) => {
          playingNow.current = state === YT_STATE.PLAYING;
          if (state === YT_STATE.PLAYING) {
            window.clearTimeout(watchdog.current);
            reportRef.current('playing');
          } else if (state === YT_STATE.PAUSED && !ended.current) reportRef.current('paused');
          else if (state === YT_STATE.ENDED) {
            ended.current = true;
            reportRef.current('ended');
          }
        },
        onError: () => {
          window.clearTimeout(watchdog.current);
          reportRef.current('error');
        },
      },
    )
      .then((created) => {
        if (!alive) return created.destroy();
        window.clearTimeout(notReady);
        player.current = created;
        if (waiting.current) act(waiting.current);
        waiting.current = null;
      })
      .catch(() => alive && reportRef.current('error'));
    // YouTube blocked on the network, or a player that never loads, must not fail silently.
    const notReady = window.setTimeout(() => reportRef.current('error'), READY_TIMEOUT_MS);
    // YouTube's own end time is not reliable after seeking: stop at the end of the part ourselves.
    const timer = window.setInterval(() => {
      const yt = player.current;
      if (end === null || !yt || !playingNow.current || yt.getCurrentTime() < end) return;
      ended.current = true;
      yt.pauseVideo();
      reportRef.current('ended');
    }, 250);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.clearTimeout(notReady);
      window.clearTimeout(watchdog.current);
      player.current?.destroy();
      player.current = null;
      box.innerHTML = '';
    };
  }, [videoId, start, end, act]);

  return (
    <div
      ref={holder}
      data-testid={`projector-youtube-${slot}`}
      className="mx-auto aspect-video max-h-[50vh] w-full max-w-4xl overflow-hidden rounded-xl bg-black shadow-2xl"
    />
  );
});
