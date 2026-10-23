-- Question clips: each question has an optional question-media slot and an optional reveal-media
-- slot, both stored as a MediaRef JSON object:
--   { kind: image|video|audio|youtube, source: upload|link, path?, url?, startSeconds?, durationSeconds? }
-- See docs/superpowers/specs/2026-10-23-question-clips-design.md.
alter table public.questions
  add column media jsonb,
  add column reveal_media jsonb;

-- Today's single upload becomes the question-media slot.
update public.questions
set media = jsonb_build_object('kind', media_type, 'source', 'upload', 'path', media_path)
where media_type is not null and media_path is not null;

alter table public.questions
  drop constraint if exists questions_media_pair,
  drop column media_type,
  drop column media_path;

-- Audio uploads, and full-length videos (100 MB).
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'
    ]
where id = 'question-media';
