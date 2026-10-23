# Backlog

Ideas agreed in principle but not scheduled yet. Each entry says what is wanted, what exists
today, and what has to be decided before building it.

## Short video and audio clips in questions

*Noted 2026-10-23.*

**Wanted:** short video previews (a film scene, a music-video snippet) and short audio tracks
("name the song", "whose voice is this") as part of a question. The host adds them **by upload or by
link**.

**What exists today** (migration `0010_question_media.sql`, PRs #12 and #13):

- A question can have one image or video, uploaded to the private `question-media` bucket (JPEG,
  PNG, WebP, MP4, WebM; up to 50 MB) and served through short-lived signed URLs.
- The media is shown during live play on the projector and the phones.
- There is no audio type, no links, and no start/end trimming.

**To decide before building:**

1. **Where the sound plays.** Most likely the projector only, with the phones staying silent so 30
   phones don't play out of sync. Should the phones show the video without sound, or not at all?
2. **Who controls playback.** Proposal: the host can play, pause and replay from the control room,
   and the projector follows. Should it autoplay when the question opens?
3. **Links.** Which kinds:
   - a direct file URL (an `.mp3` or `.mp4` somewhere): easy;
   - YouTube: an embedded player, which brings ads, region blocks and videos disappearing;
   - Spotify / Apple Music: only 30-second previews through their APIs, and accounts are needed.

   Proposal: direct links and YouTube first.
4. **Clip from a longer source.** Let the host set a start time and a length (e.g. from 1:20, play
   15 s) instead of cutting the file. That works for both links and uploads.
5. **Answer reveal.** Should a clip (e.g. the full chorus) also be playable at the reveal, as
   separate "reveal media"?
6. **Upload limits.** Audio formats (MP3, M4A, OGG) and size (e.g. 15 MB), and whether video clips
   should get a lower limit than 50 MB to keep storage costs down (see plan limits in
   `SAAS_PLAN.md`).
7. **Rights.** Hosts are responsible for the music and clips they play in a pub. The terms of
   service should say so (see the legal items in `SAAS_PLAN.md`).

**Rough shape:** `media_type` gains `audio`. New columns `media_url` (a link, as an alternative to
`media_path`), `media_start_seconds` and `media_duration_seconds`. A control-room player whose
play/pause/replay is broadcast to the projector over the existing realtime channel. The editor gets
upload-or-link input with a preview.
