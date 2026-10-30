const YouTubeSlot = forwardRef<SlotHandle, { slot: MediaSlot; media: ResolvedMediaDto; report: Report }>(function YouTubeSlot(
  { slot, media, report },
  ref,
) {
  const { t } = useI18n();
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const waiting = useRef<keyof SlotHandle | null>(null);
  const started = useRef(false);
  const ended = useRef(false);
  const playingNow = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
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
          setIsPlaying(playingNow.current);
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
    <div className="relative mx-auto aspect-video max-h-[50vh] w-full max-w-4xl overflow-hidden rounded-xl bg-black shadow-2xl">
      <div
        ref={holder}
        data-testid={`projector-youtube-${slot}`}
        className={`absolute inset-0 ${isPlaying ? '' : 'invisible'}`}
      />
      {!isPlaying && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-space-md bg-surface-container text-center" data-testid={`projector-youtube-placeholder-${slot}`}>
          <Music className="h-14 w-14 text-secondary" />
          <span className="text-headline-sm font-bold text-on-surface">{t('projector.media.ready')}</span>
        </div>
      )}
    </div>
  );
});
