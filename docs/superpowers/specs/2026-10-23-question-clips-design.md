# Question clips (video, audio, YouTube) — design

Status: draft for approval, 2026-10-23. Replaces the "Short video and audio clips" entry in
`docs/BACKLOG.md`.

## Why

Hosts want music and film rounds: "name the song", "which film is this scene from", "whose voice
is this". Today a question can only carry one uploaded image or short video, which plays on every
phone at once and starts by itself. Clips should come from wherever the host has them (a file, a
link, YouTube), play only the part the host chose, and be under the host's control — and the
answer reveal may play the full thing.

## Decisions (from the conversation)

- **Sources:** upload (file stored like today's images), **direct link** to a file
  (`…/song.mp3`, `…/clip.mp4`), or **YouTube link**.
- **Kinds:** image, video, audio, YouTube.
- **Sound plays on the projector only.** Phones stay silent.
- **Nothing plays by itself.** The host plays, pauses and replays from the control room; the
  projector follows.
- **Clips may be full length; the host selects the part:** an optional **start** (e.g. 1:20) and
  optional **length** (e.g. 15 s). No length = play to the end.
- **Optional reveal clip:** at the reveal a question may play something else (e.g. the full song or
  the answer scene) — again an upload, a direct link, YouTube, or an image.
- **Everything is optional.** A question can have no media, only question media, only reveal media,
  or both. Start and length are optional.

## Goals

- Editor: add question media and reveal media from upload / link / YouTube, with start and length
  and a preview player to try the cut.
- Control room: play / pause / replay the current clip; the projector follows within a moment.
- Projector: plays sound and video; preloads during the lock-in (as images do today).
- Phones: show images as today; for video, audio and YouTube show a "watch / listen to the
  projector" card instead of playing anything.

## Non-goals

- Sound or video on phones.
- Editing or converting files (cutting is by start/length only).
- Spotify / Apple Music (accounts, 30 s previews).
- Playlists or several clips per question.
- Autoplay.

## Anti-goals

- A clip blaring out unexpectedly — the host always starts it.
- The answer leaking: reveal media must not be reachable before the reveal.
- A night stalled by a dead link — the host sees the error and moves on.

## Data model (migration `0016_question_clips.sql`)

Both media slots use the same shape, stored as `jsonb` on `questions`:

```ts
interface MediaRef {
  kind: 'image' | 'video' | 'audio' | 'youtube';
  source: 'upload' | 'link';   // youtube is always 'link'
  path?: string;                // upload: storage path in `question-media`
  url?: string;                 // link: https URL (file or YouTube)
  startSeconds?: number;        // ≥ 0
  durationSeconds?: number;     // > 0
}
```

- `questions.media jsonb` (question media) and `questions.reveal_media jsonb` (reveal media), both
  nullable. The existing `media_type` / `media_path` are migrated into `media` (`source: 'upload'`)
  and then dropped.
- Shared type `MediaRefDto` in `packages/shared-types` with the same shape.
- Validation (API): uploads must be under `<hostId>/<quizId>/` as today; links must be `https://`;
  YouTube links are accepted as `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/` and
  stored as the canonical `https://www.youtube.com/watch?v=<id>`; `startSeconds ≥ 0`,
  `durationSeconds > 0`; images ignore start/length.

## Uploads

- Bucket `question-media` accepts additionally `audio/mpeg`, `audio/mp4` (m4a), `audio/ogg`,
  `audio/wav`; audio up to **25 MB**. Video limit raised to **100 MB** (full-length clips).
  Images unchanged.

## Serving media during a night

- `GET /sessions/:id/media` returns `{ media: ResolvedMedia | null, revealMedia: ResolvedMedia | null }`
  where `ResolvedMedia = { kind, url, startSeconds, durationSeconds }` (uploads get the cached
  signed link built for preloading; links are returned as is).
  - Question media: from the lock-in of the current question until it ends (as today).
  - **Reveal media: only while the current question is in `QUESTION_REVEAL`.**
- Phones keep using the same endpoint; they render `image` only.

## Playback control

- `POST /sessions/:id/media/control` (host, own session) with
  `{ slot: 'question' | 'reveal', action: 'play' | 'pause' | 'replay' }` broadcasts
  `MEDIA_CONTROL { questionId, slot, action, at }` on the session's realtime channel. No state is
  stored.
- Allowed: `question` during `QUESTION_ACTIVE` and `QUESTION_REVEAL`; `reveal` during
  `QUESTION_REVEAL`. Otherwise `409 MEDIA_NOT_AVAILABLE`.
- Projector:
  - `play` starts from where it was paused, or from `startSeconds` the first time; `replay` jumps
    to `startSeconds` and plays; `pause` pauses.
  - With `durationSeconds`, playback stops at `startSeconds + durationSeconds`.
  - Changing question or state stops anything playing. At the reveal, question media stays shown
    (paused) until the host plays the reveal clip, which then replaces it.
  - A projector reloaded mid-question shows the media paused and waits for the host.
  - **Browsers block sound until someone clicks on the page.** The projector shows a one-time
    "Zapnúť zvuk" overlay when it is opened (any click enables sound for the night); until then,
    control-room playback shows "Projektor nemá zapnutý zvuk" to the host.
  - YouTube plays through the YouTube IFrame Player API (loaded only when needed), using its
    start/end parameters; errors (removed video, embedding disabled, region) are reported.
  - The projector reports playback errors back via the same channel
    (`MEDIA_STATUS { questionId, slot, state: 'playing' | 'paused' | 'ended' | 'error' }`) so the
    control room shows the real state and errors.
- Control room: in the question panel, for the current question, a small player bar per slot with
  **▶ Prehrať / ⏸ Pauza / ⟲ Znova**, the kind/source, the selected part ("1:20 – 1:35"), and the
  projector-reported state.

## Editor

- "Médiá otázky" and "Médiá pri odhalení (nepovinné)", each with: **Nahrať súbor** | **Odkaz**
  (one field; a YouTube URL is recognised, otherwise the kind is taken from the file extension
  or asked: video / audio / image), then **Začiatok** (m:ss) and **Dĺžka** (s), both optional, and a
  preview player that plays exactly the selected part. Remove resets the slot.
- The quiz preview (phone preview) shows what phones will show.

## Phones

- Image (question or reveal): shown as today.
- Video / audio / YouTube: a card "🔊 Počúvajte projektor" / "🎬 Sledujte projektor" in place of
  the media.

## Testing

- API: MediaRef validation (link schemes, YouTube forms → canonical, start/length bounds, upload
  paths), migration of old media, the media endpoint per state (reveal media only at reveal),
  control endpoint (ownership, allowed states, broadcast payload).
- Web: editor slots (upload / link / YouTube recognition, start/length, remove), control-room
  buttons send the right control, projector reacts to play / pause / replay and stops at the end of
  the part, sound-enable overlay, phones show the projector card for clips.

## Calls I made (to check while reading)

- **Uploaded videos stop playing on phones** (they did until now): phones show the projector card
  for every video, so sound and picture come from one place and phones save data.
- **Limits:** audio 25 MB, video raised from 50 to 100 MB for full-length clips (storage cost).
- **YouTube preloading:** in the lock-in the projector cues the video (loads it without playing),
  so play starts quickly; uploads and direct links preload like images do.
- **Projector → control room status** goes over the existing public realtime channel. Anyone could
  fake a status message, but it only changes what the control room displays, never the game.
- **Duplicating a quiz** copies both media slots; uploaded files are shared, not copied (as today).
- The old `media_type` / `media_path` columns are removed after migrating into `media`.

## Calls left to the builder

- Exact player bar layout in the control room and the editor preview styling.
- How the projector keeps its media elements (one per slot, created on demand).
