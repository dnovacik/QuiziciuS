# Question Clips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Questions get an optional question-media slot and an optional reveal-media slot (image, video, audio or YouTube; upload or link; optional start/length), played on the projector under the host's control.

**Architecture:** Both slots are one `MediaRef` JSON shape on `questions` (migration 0016 moves today's `media_type`/`media_path` into it). The API validates/normalises refs, serves resolved URLs per slot and state, and relays host playback commands as a realtime `MEDIA_CONTROL` broadcast. The projector owns playback (audio/video elements, YouTube IFrame API) and reports `MEDIA_STATUS` back on the same channel for the control room.

**Tech Stack:** NestJS + Supabase (storage, realtime broadcast), Jest; React + Vite + Tailwind, Vitest + Testing Library; YouTube IFrame Player API (script `https://www.youtube.com/iframe_api`, loaded on demand).

**Spec:** `docs/superpowers/specs/2026-10-23-question-clips-design.md`

## Global Constraints

- `MediaRef = { kind: 'image'|'video'|'audio'|'youtube'; source: 'upload'|'link'; path?; url?; startSeconds?; durationSeconds? }`; youtube is always `source: 'link'`.
- Links must be `https://`; YouTube accepted as `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, stored as `https://www.youtube.com/watch?v=<id>`; `startSeconds ≥ 0`, `durationSeconds > 0`; images drop start/length.
- Uploads: audio `audio/mpeg`, `audio/mp4`, `audio/ogg`, `audio/wav` up to 25 MB; video up to 100 MB; images unchanged (10 MB).
- Question media is served from `LOCK_IN_ROUND` through `QUESTION_REVEAL`; reveal media **only** in `QUESTION_REVEAL`.
- Control: `POST /sessions/:id/media/control { slot: 'question'|'reveal', action: 'play'|'pause'|'replay' }`; `question` allowed in `QUESTION_ACTIVE`/`QUESTION_REVEAL`, `reveal` only in `QUESTION_REVEAL`, else `409 MEDIA_NOT_AVAILABLE`.
- Broadcasts: `MEDIA_CONTROL { questionId, slot, action, at }` (API → projector), `MEDIA_STATUS { questionId, slot, state: 'playing'|'paused'|'ended'|'error'|'blocked' }` (projector → control room).
- Sound plays only on the projector; nothing autoplays; phones render images only and a "Počúvajte / Sledujte projektor" card for clips.
- Slovak strings first, English alongside (`merge-locales.cjs`). Behaviour tests, one commit per task, `pnpm format` before commits.

## Review Focus

- Reveal media requested before the reveal (lock-in, answering) → the endpoint returns `revealMedia: null`.
- A part with `durationSeconds` → the projector pauses at `start + duration`; ⟲ Znova restarts from `start`, not 0.
- The host moves to the next question while a clip plays → the clip stops at once.
- YouTube links with extras (`&list=…`, `youtu.be/ID?t=42`, `m.youtube.com`) → the id is extracted; `http://` links are refused.
- A projector nobody clicked yet (sound blocked) → the control room shows "Projektor nemá zapnutý zvuk", not "hrá".

---

## Phase 1 — API

### Task 1: MediaRef type, validation and migration

**Files:** Create `supabase/migrations/0016_question_clips.sql`, `apps/api/src/questions/media-ref.ts`, `apps/api/src/questions/media-ref.spec.ts`; modify `packages/shared-types/src/dto.ts`.

**Produces:** shared `MediaKind`, `MediaRefDto`, `ResolvedMediaDto = { kind: MediaKind; url: string; startSeconds: number | null; durationSeconds: number | null }`, `MediaSlot = 'question'|'reveal'`, `MediaAction = 'play'|'pause'|'replay'`, `MediaPlaybackState`; API `normalizeMediaRef(input: unknown, hostId: string, quizId: string): MediaRefDto | null` (throws `BadRequestException({ code: 'INVALID_MEDIA' })`), `youtubeId(url: string): string | null`.

- [ ] **Step 1: Failing tests** (`media-ref.spec.ts`): null/undefined → null; upload under `host/quiz/` kept, outside or with `..` → INVALID_MEDIA; `http://x/a.mp3` → INVALID_MEDIA; `https://x/a.mp3` kind audio kept; YouTube `https://youtu.be/dQw4w9WgXcQ?t=42`, `https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1`, `https://www.youtube.com/shorts/dQw4w9WgXcQ` → `{ kind: 'youtube', source: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }`; a YouTube URL given as kind video is turned into youtube; negative start / zero length → INVALID_MEDIA; image with start/length → start/length removed.
- [ ] **Step 2:** `npx jest src/questions/media-ref` → FAIL (module missing).
- [ ] **Step 3:** Implement; migration: `alter table questions add column media jsonb, add column reveal_media jsonb;` copy `media_type/media_path` into `media` as `{kind, source:'upload', path}`; drop the constraint `questions_media_pair` and both old columns; update the `question-media` bucket `allowed_mime_types` (add the four audio types) and `file_size_limit` to 100 MB.
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit `feat(clips): media refs and migration`.

### Task 2: Questions read and write both slots; audio uploads

**Files:** Modify `apps/api/src/data/questions.repository.ts` (`media: MediaRefDto | null`, `reveal_media: MediaRefDto | null` replace `media_type`/`media_path`), `apps/api/src/questions/dto/create-question.dto.ts` (`media?`, `revealMedia?` as objects, `@IsOptional() @IsObject()`), `apps/api/src/questions/questions.controller.ts` (use `normalizeMediaRef` for both; upload policy adds audio types 25 MB and video 100 MB, `mediaType` returns `'image'|'video'|'audio'`), fakes and fixtures that build `QuestionRecord`; test `apps/api/src/questions/questions.controller.spec.ts` (new).

- [ ] **Step 1: Failing tests:** creating a question stores normalised `media` and `revealMedia` (YouTube canonicalised); an invalid ref → INVALID_MEDIA and nothing stored; upload-url accepts `audio/mpeg` 20 MB and refuses 30 MB, accepts `video/mp4` 90 MB.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** API suite → PASS. **Step 5:** Commit `feat(clips): questions carry question and reveal media`.

### Task 3: Serving media per state, and host playback control

**Files:** Modify `apps/api/src/questions/session-question-media.controller.ts` (+ spec), `apps/api/src/realtime/realtime-broadcast.service.ts` (`BroadcastEvent` adds `'MEDIA_CONTROL'`), `apps/api/src/sessions/sessions.controller.ts` (+ spec) for `POST sessions/:sessionId/media/control` (`@RequireRole('HOST')`, own session), `apps/api/src/auth/require-role.spec.ts` stays green (route is HOST).

**Produces:** `GET /sessions/:id/media` → `{ media: ResolvedMediaDto | null; revealMedia: ResolvedMediaDto | null }` (uploads via the cached signed link; links as is).

- [ ] **Step 1: Failing tests:** lock-in serves `media` and `revealMedia: null`; reveal serves both; answering serves `revealMedia: null` (Review Focus 1); lobby serves both null; control `play` on `question` while `QUESTION_ACTIVE` publishes `MEDIA_CONTROL` with `{ questionId, slot, action }`; `reveal` while answering → 409 MEDIA_NOT_AVAILABLE; another host's session → 403.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** API suite → PASS. **Step 5:** Commit `feat(clips): media per state and playback control`, open PR "Question clips API", apply migration 0016 to dev, CI.

## Phase 2 — Web

### Task 4: Editor slots

**Files:** Create `apps/web/src/host/editor/MediaSlot.tsx` (+ tests in `apps/web/src/host/editor/media-slot.test.tsx`), `apps/web/src/lib/media-ref.ts` (`detectLink(url): { kind: MediaKind; url: string } | null`, `formatPart(ref): string` e.g. "1:20 – 1:35", `parseTime('1:20') → 80`); modify `apps/web/src/host/api.ts` (`Question.media`, `Question.reveal_media`; duplicate keeps link media, drops uploads), `question-draft.ts`, `QuestionForm.tsx`, `QuizEditorPage.tsx` (upload per slot), `PhonePreview.tsx`, locales.

- [ ] **Step 1: Failing tests:** pasting a YouTube URL shows "YouTube" and saves `{kind:'youtube', source:'link', url}`; pasting `https://x/a.mp3` → audio; an unknown extension asks for the kind; start "1:20" + length "15" save `startSeconds: 80, durationSeconds: 15`; removing clears the slot; the reveal slot is optional and saved separately; duplicating a quiz keeps a YouTube clip and drops an uploaded one.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (preview: `<audio>/<video>` seeking to start and pausing at start+length; YouTube preview via the same player module as Task 6). **Step 4:** Web suite → PASS. **Step 5:** Commit `feat(clips): editor media slots`.

### Task 5: Phones

**Files:** Modify `apps/web/src/lib/use-current-question-media.ts` (new response shape; preload warms only `image`, `audio`, `video`; hook returns `{ media, revealMedia, error }`), `apps/web/src/play/QuestionScreen.tsx`, the reveal screen in `apps/web/src/play/ResultScreens.tsx`, tests in `apps/web/src/lib/use-current-question-media.test.tsx` and `PlayApp.test.tsx`.

- [ ] **Step 1: Failing tests:** an image shows as today; audio shows "Počúvajte projektor", video/YouTube "Sledujte projektor", and no `<audio>`/`<video>`/iframe is rendered on the phone; at the reveal an image reveal media is shown.
- [ ] **Step 2–4:** FAIL → implement → web suite PASS. **Step 5:** Commit `feat(clips): phones point to the projector`.

### Task 6: Projector playback

**Files:** Create `apps/web/src/projector/MediaPlayer.tsx` (one player per slot: audio/video element or YouTube player), `apps/web/src/lib/youtube.ts` (`loadYouTubeApi(): Promise<YT>` once; `createYouTubePlayer(el, id, { start, end })`), `apps/web/src/lib/media-channel.ts` (`subscribeToMediaControl`, `sendMediaStatus` on the session channel); modify `apps/web/src/lib/supabase-client.ts` (events `MEDIA_CONTROL`, `MEDIA_STATUS`), `apps/web/src/projector/QuestionScenes.tsx`, `ProjectorApp.tsx` (sound-enable overlay `projector-sound-overlay`, cue/preload during lock-in), tests `apps/web/src/projector/media-player.test.tsx` (YouTube module mocked).

- [ ] **Step 1: Failing tests:** `play` starts at `startSeconds` the first time and continues after `pause`; `replay` seeks to `startSeconds` (Review Focus 2); reaching `start+duration` pauses and reports `ended`; a new question stops playback (Review Focus 3); before the overlay is clicked, `play` reports `blocked` (Review Focus 5); at the reveal, playing `reveal` replaces the question media; a YouTube error reports `error`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(clips): projector plays clips under host control`.

### Task 7: Control room player bar

**Files:** Modify `apps/web/src/host/control-room/QuestionPanel.tsx` (replace the inline `<video>`/`<img>` preview with `MediaControls` per slot), create `apps/web/src/host/control-room/MediaControls.tsx`, `apps/web/src/host/control-room/use-control-room.ts` (`mediaControl(slot, action)` → POST), tests in `apps/web/src/host/host.test.tsx`; docs: mark the BACKLOG entry built and link the spec.

- [ ] **Step 1: Failing tests:** for a question with an audio clip the bar shows kind and part "1:20 – 1:35"; ▶ posts `{ slot:'question', action:'play' }`; the reveal bar appears only at the reveal; a `MEDIA_STATUS blocked` shows "Projektor nemá zapnutý zvuk"; `error` shows the error.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(clips): control-room player`, open PR "Question clips UI", whole-branch review, CI, stop for review.
