-- Optional question media, stored in a private Supabase Storage bucket.
ALTER TABLE public.questions
  ADD COLUMN media_type text CHECK (media_type IN ('image', 'video')),
  ADD COLUMN media_path text,
  ADD CONSTRAINT questions_media_pair CHECK ((media_type IS NULL) = (media_path IS NULL));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('question-media', 'question-media', false, 52428800,
        ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
ON CONFLICT (id) DO UPDATE SET
  public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
-- No direct public storage policies: all access uses short-lived signed URLs.
