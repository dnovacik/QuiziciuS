# Quiz questions as CSV

The quiz editor's **Import CSV** adds the questions in a file after the quiz's own; **Export CSV**
downloads them. The whole file is checked first: if any row is wrong, nothing is saved and the
editor lists the problems by row (the header is row 1).

One row per question, UTF-8, comma-separated (semicolons also work), with a header row. Quote a
cell that contains a comma, quote or line break (`"Áno, naozaj"`; a quote inside is doubled: `""`).
Column order doesn't matter; only `type`, `prompt` and `answer` are required.

| Column | Meaning |
| --- | --- |
| `type` | `MULTIPLE_CHOICE`, `FREE_TEXT` or `NUMERIC_NEAREST` |
| `prompt` | The question, up to 250 characters |
| `options` | Multiple choice only: 2–6 choices separated by `\|` |
| `answer` | Multiple choice: the correct choice, exactly as in `options`. Free text: accepted answers separated by `\|` (case, diacritics and small typos are forgiven, so list only real alternatives). Numeric: the number (`2654.4` or `2654,4`) |
| `unit` | Numeric only: shown next to the answer, e.g. `m`, `km`, `%` (up to 20 characters) |
| `points` | Whole number, 1 or more; empty = 1 |
| `time_limit_seconds` | 0 = no timer (the host closes answering); empty = the quiz's default |
| `media_url` | Optional picture, video, audio or YouTube link shown with the question (`https://` only) |
| `media_kind` | `image`, `video`, `audio` or `youtube`; may be left empty when the link ends in a file extension or is a YouTube link |
| `media_start`, `media_duration` | Seconds: where the clip starts and how long it plays (not for images) |
| `reveal_media_*` | The same four columns for media shown at the answer reveal |

Uploaded media files can't travel in a CSV: export leaves them out, and you add them in the editor.

`live-test-kviz-1.csv` and `live-test-kviz-2.csv` are full examples (20 questions each, in Slovak).
