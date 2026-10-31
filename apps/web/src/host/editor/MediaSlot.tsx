import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Film, Image as ImageIcon, Link2, Music, Play, Square, Upload, Youtube } from 'lucide-react';
import type { MediaKind, MediaRefDto, MediaSlot as Slot } from '@quizicius/shared-types';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { detectLink, formatPart, formatTime, parseTime, youtubeId } from '../../lib/media-ref';
import { ACCEPTED_MEDIA } from '../api';
import { inputClass } from '../ui';

export const KIND_ICONS: Record<MediaKind, typeof Film> = { image: ImageIcon, video: Film, audio: Music, youtube: Youtube };
export const KIND_LABELS: Record<MediaKind, TranslationKey> = {
  image: 'host.editor.kind.image',
  video: 'host.editor.kind.video',
  audio: 'host.editor.kind.audio',
  youtube: 'host.editor.kind.youtube',
};
const FILE_KINDS: Exclude<MediaKind, 'youtube'>[] = ['video', 'audio', 'image'];

/**
 * One media slot of a question ("Médiá otázky" or "Médiá pri odhalení"): an uploaded file or a link
 * (a file or YouTube), with an optional start and length for clips and a preview of exactly that part.
 */
export function MediaSlot({
  slot,
  value,
  previewUrl,
  busy,
  onUpload,
  onChange,
}: {
  slot: Slot;
  value: MediaRefDto | null;
  /** Playable URL of the slot's file (a signed link for uploads); null while loading or for YouTube. */
  previewUrl: string | null;
  busy: boolean;
  onUpload: (file: File) => void;
  onChange: (ref: MediaRefDto | null) => void;
}) {
  const { t } = useI18n();
  const id = `media-slot-${slot}`;
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [unknownLink, setUnknownLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);

  function addLink() {
    const found = detectLink(link);
    setLinkError(!found);
    if (!found) return;
    if (found.kind) choose(found.kind, found.url);
    else setUnknownLink(found.url);
  }
  function choose(kind: MediaKind, url: string) {
    onChange({ kind, source: 'link', url });
    setLinkOpen(false);
    setLink('');
    setUnknownLink(null);
  }

  return (
    <div className="flex flex-col gap-space-sm" data-testid={id}>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_MEDIA}
        className="hidden"
        data-testid={`${id}-file`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onUpload(file);
        }}
      />
      {!value && (
        <>
          <div className="flex flex-wrap gap-space-md">
            <button
              type="button"
              className="flex items-center gap-1.5 text-label-sm text-primary hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              data-testid={`${id}-upload`}
            >
              <Upload className="h-4 w-4" />
              {busy ? t('host.editor.uploading') : t('host.editor.uploadFile')}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 text-label-sm text-primary hover:underline"
              onClick={() => setLinkOpen((open) => !open)}
              data-testid={`${id}-link`}
            >
              <Link2 className="h-4 w-4" />
              {t('host.editor.addLink')}
            </button>
          </div>
          {linkOpen && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  value={link}
                  placeholder={t('host.editor.linkPlaceholder')}
                  onChange={(event) => {
                    setLink(event.target.value);
                    setLinkError(false);
                    setUnknownLink(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addLink();
                    }
                  }}
                  data-testid={`${id}-link-input`}
                />
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 text-label-sm text-on-primary"
                  onClick={addLink}
                  data-testid={`${id}-link-add`}
                >
                  {t('host.editor.linkAdd')}
                </button>
              </div>
              {linkError && (
                <span className="text-body-sm text-error" data-testid={`${id}-error`}>
                  {t('host.editor.linkInvalid')}
                </span>
              )}
              {unknownLink && (
                <div className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
                  {t('host.editor.linkKindQuestion')}
                  {FILE_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className="rounded-full bg-surface-container-high px-3 py-1 text-label-sm text-on-surface hover:bg-surface-container-highest"
                      onClick={() => choose(kind, unknownLink)}
                      data-testid={`${id}-kind-${kind}`}
                    >
                      {t(KIND_LABELS[kind])}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {value && <ChosenMedia id={id} value={value} previewUrl={previewUrl} onChange={onChange} />}
    </div>
  );
}

function ChosenMedia({
  id,
  value,
  previewUrl,
  onChange,
}: {
  id: string;
  value: MediaRefDto;
  previewUrl: string | null;
  onChange: (ref: MediaRefDto | null) => void;
}) {
  const { t } = useI18n();
  const Icon = KIND_ICONS[value.kind];
  const name = value.source === 'upload' ? (value.path?.split('/').pop() ?? '') : (value.url ?? '');
  const part = formatPart(value);

  function setPart(field: 'startSeconds' | 'durationSeconds', seconds: number | undefined) {
    const next = { ...value };
    if (seconds === undefined) delete next[field];
    else next[field] = seconds;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-space-md pt-1 sm:flex-row">
      <MediaPreview value={value} previewUrl={previewUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-body-sm text-on-surface-variant">
        <span className="flex items-center gap-1.5 text-label-md text-on-surface" data-testid={`${id}-kind`}>
          <Icon className="h-4 w-4 text-secondary" />
          {t(KIND_LABELS[value.kind])}
          <span className="text-label-sm font-normal text-on-surface-variant">
            · {t(value.source === 'upload' ? 'host.editor.source.upload' : 'host.editor.source.link')}
          </span>
        </span>
        <span className="truncate" title={name}>
          {name}
        </span>
        {value.kind !== 'image' && (
          <div className="flex flex-wrap items-end gap-space-md">
            <TimeField
              testId={`${id}-start`}
              label={t('host.editor.start')}
              placeholder="0:00"
              seconds={value.startSeconds}
              format={formatTime}
              parse={parseTime}
              onChange={(seconds) => setPart('startSeconds', seconds)}
            />
            <TimeField
              testId={`${id}-length`}
              label={t('host.editor.length')}
              placeholder="15"
              seconds={value.durationSeconds}
              format={String}
              parse={(text) => {
                const seconds = parseTime(text);
                return seconds === 0 ? null : seconds;
              }}
              onChange={(seconds) => setPart('durationSeconds', seconds)}
            />
            <span className="pb-2 text-label-sm text-secondary" data-testid={`${id}-part`}>
              {part || t('host.editor.wholeClip')}
            </span>
          </div>
        )}
        {value.kind === 'youtube' && (
          <label className="flex items-center gap-2 text-label-sm text-on-surface">
            <input
              type="checkbox"
              checked={value.audioOnly === true}
              onChange={(event) => {
                const next = { ...value };
                if (event.target.checked) next.audioOnly = true;
                else delete next.audioOnly;
                onChange(next);
              }}
              data-testid={`${id}-audio-only`}
            />
            {t('host.editor.audioOnly')}
          </label>
        )}
        <button
          type="button"
          className="self-start text-label-sm text-error hover:underline"
          onClick={() => onChange(null)}
          data-testid={`${id}-remove`}
        >
          {t('host.editor.removeMedia')}
        </button>
      </div>
    </div>
  );
}

/** A text field holding seconds; only readable input reaches the slot, an empty field clears it. */
function TimeField({
  testId,
  label,
  placeholder,
  seconds,
  format,
  parse,
  onChange,
}: {
  testId: string;
  label: string;
  placeholder: string;
  seconds: number | undefined;
  format: (seconds: number) => string;
  parse: (text: string) => number | undefined | null;
  onChange: (seconds: number | undefined) => void;
}) {
  const [text, setText] = useState(seconds === undefined ? '' : format(seconds));
  useEffect(() => {
    setText((current) => (parse(current) === seconds ? current : seconds === undefined ? '' : format(seconds)));
    // Only an outside change (another question, a removed part) rewrites the field.
  }, [seconds]);
  const invalid = parse(text) === null;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-sm">{label}</span>
      <input
        className={`${inputClass} w-24 ${invalid ? 'ring-2 ring-error' : ''}`}
        value={text}
        placeholder={placeholder}
        inputMode="decimal"
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parse(event.target.value);
          if (parsed !== null) onChange(parsed);
        }}
        data-testid={testId}
      />
    </label>
  );
}

/** Image, a player that plays exactly the selected part, or a YouTube thumbnail. */
function MediaPreview({ value, previewUrl }: { value: MediaRefDto; previewUrl: string | null }) {
  const { t } = useI18n();
  const player = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const start = value.startSeconds ?? 0;
  const end = value.durationSeconds ? start + value.durationSeconds : null;
  const frame =
    'relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high sm:w-48';

  if (value.kind === 'youtube') {
    const videoId = youtubeId(value.url ?? '');
    const at = Math.floor(start);
    return (
      <a
        className={`${frame} group`}
        href={`https://www.youtube.com/watch?v=${videoId}${at ? `&t=${at}s` : ''}`}
        target="_blank"
        rel="noreferrer"
        title={t('host.editor.openYoutube')}
      >
        {videoId && <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />}
        <ExternalLink className="absolute h-6 w-6 text-white drop-shadow group-hover:scale-110" />
      </a>
    );
  }
  if (!previewUrl) return <div className={frame} />;
  if (value.kind === 'image') {
    return (
      <div className={frame}>
        <img src={previewUrl} alt={t('play.question.image')} className="h-full w-full object-cover" data-testid="editor-media-image" />
      </div>
    );
  }

  function togglePart() {
    const element = player.current;
    if (!element) return;
    if (playing) {
      element.pause();
      return;
    }
    element.currentTime = start;
    void element.play().catch(() => setPlaying(false));
  }
  const events = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onTimeUpdate: () => {
      if (end !== null && player.current && player.current.currentTime >= end) player.current.pause();
    },
  };
  return (
    <div className="flex w-full shrink-0 flex-col gap-1 sm:w-48">
      {value.kind === 'video' ? (
        <video ref={player} src={previewUrl} controls preload="metadata" className={`${frame} bg-black object-contain`} {...events} />
      ) : (
        <audio ref={player} src={previewUrl} controls preload="metadata" className="w-full" {...events} />
      )}
      <button type="button" className="flex items-center gap-1 self-start text-label-sm text-primary hover:underline" onClick={togglePart}>
        {playing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {t(playing ? 'host.editor.stopPart' : 'host.editor.playPart')}
      </button>
    </div>
  );
}
