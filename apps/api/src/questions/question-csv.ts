import { MediaKind, MediaRefDto, QUESTION_TYPES, QuestionType } from '@quizicius/shared-types';
import { QuestionRecord } from '../data/questions.repository';

/**
 * Questions as CSV, one row per question, for writing quizzes outside the app (by hand or with an
 * AI) and moving them between quizzes. Lists (options, accepted answers) are separated with `|`.
 * Media travels as links only; uploaded files stay in the app.
 */
export const CSV_COLUMNS = [
  'type',
  'prompt',
  'options',
  'answer',
  'unit',
  'points',
  'time_limit_seconds',
  'media_url',
  'media_kind',
  'media_start',
  'media_duration',
  'reveal_media_url',
  'reveal_media_kind',
  'reveal_media_start',
  'reveal_media_duration',
] as const;
type Column = (typeof CSV_COLUMNS)[number];
const REQUIRED: Column[] = ['type', 'prompt', 'answer'];

const YOUTUBE_AUDIO = 'youtube-audio';

export const MAX_OPTIONS = 6;
export const MAX_PROMPT = 250;
/** Keeps an upload well under the API's 100 kB request limit. */
export const MAX_IMPORT_ROWS = 200;

/** A question read from CSV, ready for the same checks as one written in the editor. */
export type ImportedQuestion = Omit<QuestionRecord, 'id' | 'quiz_id' | 'order_index' | 'media' | 'reveal_media' | 'time_limit_seconds'> & {
  /** Raw media slots, still to be checked by normalizeMediaRef. */
  media: Record<string, unknown> | null;
  reveal_media: Record<string, unknown> | null;
  /** null = the quiz's default answer time. */
  time_limit_seconds: number | null;
  /** Where the question is in the file, for error messages. */
  row: number;
};

/** `row` is the line number in the file as a spreadsheet shows it (the header is row 1). */
export interface CsvRowError {
  row: number;
  message: string;
}

export type CsvParseResult = { ok: true; questions: ImportedQuestion[] } | { ok: false; errors: CsvRowError[] };

/** Splits CSV text into records (RFC 4180 quoting; `,` or `;` as the delimiter). */
export function readCsvRecords(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = !firstLine.includes(',') && firstLine.includes(';') ? ';' : ',';
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}

const list = (value: string) =>
  value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

/** Accepts a decimal comma ("1,5") as well as a point. */
function number(value: string): number | null {
  const n = Number(value.trim().replace(/\s/g, '').replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(n) ? n : null;
}

const KIND_BY_EXTENSION: Record<string, MediaKind> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  webp: 'image',
  gif: 'image',
  mp4: 'video',
  webm: 'video',
  mp3: 'audio',
  m4a: 'audio',
  ogg: 'audio',
  wav: 'audio',
};
const KINDS: MediaKind[] = ['image', 'video', 'audio', 'youtube'];

function mediaSlot(
  cells: Partial<Record<Column, string>>,
  prefix: 'media' | 'reveal_media',
  fail: (message: string) => void,
): Record<string, unknown> | null {
  const url = cells[`${prefix}_url`]?.trim() ?? '';
  const kindCell = cells[`${prefix}_kind`]?.trim().toLowerCase() ?? '';
  const start = cells[`${prefix}_start`]?.trim() ?? '';
  const duration = cells[`${prefix}_duration`]?.trim() ?? '';
  if (!url) {
    if (kindCell || start || duration) fail(`${prefix}_url is empty but other ${prefix} columns are filled in`);
    return null;
  }
  let kind: MediaKind | undefined;
  // "youtube-audio": a YouTube clip played as sound only (the projector never shows the video).
  const audioOnly = kindCell === YOUTUBE_AUDIO;
  if (audioOnly) {
    kind = 'youtube';
  } else if (kindCell) {
    kind = KINDS.find((k) => k === kindCell);
    if (!kind) fail(`${prefix}_kind must be one of ${[...KINDS, YOUTUBE_AUDIO].join(', ')}`);
  } else if (/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i.test(hostOf(url))) {
    kind = 'youtube';
  } else {
    const extension = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
    kind = KIND_BY_EXTENSION[extension];
    if (!kind) fail(`Can't tell what ${prefix}_url is; fill in ${prefix}_kind (${KINDS.join(', ')})`);
  }
  const ref: Record<string, unknown> = { kind, source: 'link', url };
  if (audioOnly) ref.audioOnly = true;
  if (start) ref.startSeconds = number(start) ?? start;
  if (duration) ref.durationSeconds = number(duration) ?? duration;
  return ref;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Reads every row and reports every problem, so a file is either imported whole or not at all. */
export function parseQuestionsCsv(text: string): CsvParseResult {
  const records = readCsvRecords(text);
  const [header, ...rest] = records;
  if (!header || header.every((cell) => !cell.trim())) return { ok: false, errors: [{ row: 1, message: 'The file is empty' }] };

  const names = header.map((cell) => cell.trim().toLowerCase());
  const errors: CsvRowError[] = [];
  const unknown = names.filter((name) => name && !(CSV_COLUMNS as readonly string[]).includes(name));
  if (unknown.length) errors.push({ row: 1, message: `Unknown columns: ${unknown.join(', ')}` });
  const missing = REQUIRED.filter((name) => !names.includes(name));
  if (missing.length) errors.push({ row: 1, message: `Missing columns: ${missing.join(', ')}` });
  if (errors.length) return { ok: false, errors };

  const questions: ImportedQuestion[] = [];
  rest.forEach((record, index) => {
    const row = index + 2;
    if (record.every((cell) => !cell.trim())) return;
    const fail = (message: string) => errors.push({ row, message });
    const cells: Partial<Record<Column, string>> = {};
    names.forEach((name, column) => {
      if (name) cells[name as Column] = record[column] ?? '';
    });
    if (record.length > names.length && record.slice(names.length).some((cell) => cell.trim())) fail('More cells than columns');

    const typeCell = (cells.type ?? '').trim().toUpperCase();
    const type = QUESTION_TYPES.find((value) => value === typeCell) as QuestionType | undefined;
    if (!type) fail(`type must be one of ${QUESTION_TYPES.join(', ')}`);

    const prompt = (cells.prompt ?? '').trim();
    if (!prompt) fail('prompt is empty');
    else if (prompt.length > MAX_PROMPT) fail(`prompt is longer than ${MAX_PROMPT} characters`);

    const answer = (cells.answer ?? '').trim();
    const optionLabels = list(cells.options ?? '');
    let options: ImportedQuestion['options'] = null;
    let acceptedAnswers: string[] | null = null;
    let correctNumeric: number | null = null;
    if (type === 'MULTIPLE_CHOICE') {
      if (optionLabels.length < 2 || optionLabels.length > MAX_OPTIONS) fail(`options needs 2–${MAX_OPTIONS} choices separated by |`);
      const correct = optionLabels.filter((label) => label.toLowerCase() === answer.toLowerCase());
      if (correct.length !== 1) fail('answer must be exactly one of the options');
      options = optionLabels.map((label, i) => ({
        id: 'abcdefghijklmnopqrstuvwxyz'[i],
        label,
        isCorrect: label.toLowerCase() === answer.toLowerCase(),
      }));
    } else if (type === 'FREE_TEXT') {
      if (optionLabels.length) fail('options are only for MULTIPLE_CHOICE');
      acceptedAnswers = list(answer);
      if (!acceptedAnswers.length) fail('answer needs at least one accepted answer');
    } else if (type === 'NUMERIC_NEAREST') {
      if (optionLabels.length) fail('options are only for MULTIPLE_CHOICE');
      correctNumeric = number(answer);
      if (correctNumeric === null) fail('answer must be a number');
    }

    const unit = (cells.unit ?? '').trim();
    if (unit && type !== 'NUMERIC_NEAREST') fail('unit is only for NUMERIC_NEAREST');
    if (unit.length > 20) fail('unit is longer than 20 characters');

    const pointsCell = (cells.points ?? '').trim();
    const points = pointsCell ? number(pointsCell) : 1;
    if (points === null || !Number.isInteger(points) || points < 1) fail('points must be a whole number, 1 or more');

    const timeCell = (cells.time_limit_seconds ?? '').trim();
    const time = timeCell ? number(timeCell) : null;
    if (timeCell && (time === null || !Number.isInteger(time) || time < 0 || time > 3600))
      fail('time_limit_seconds must be a whole number from 0 (no timer) to 3600');

    const media = mediaSlot(cells, 'media', fail);
    const revealMedia = mediaSlot(cells, 'reveal_media', fail);

    if (type)
      questions.push({
        type,
        prompt,
        options,
        accepted_answers: acceptedAnswers,
        correct_numeric: correctNumeric,
        unit: type === 'NUMERIC_NEAREST' ? unit || null : null,
        points: points ?? 1,
        time_limit_seconds: time,
        media,
        reveal_media: revealMedia,
        row,
      });
  });

  if (!errors.length && !questions.length) errors.push({ row: 2, message: 'The file has no questions' });
  if (questions.length > MAX_IMPORT_ROWS) errors.push({ row: 1, message: `At most ${MAX_IMPORT_ROWS} questions per file` });
  return errors.length ? { ok: false, errors } : { ok: true, questions };
}

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",;\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

function mediaCells(ref: MediaRefDto | null | undefined): (string | number | undefined)[] {
  // Uploads live in the quiz's storage and can't travel in a file.
  if (!ref || ref.source !== 'link') return ['', '', '', ''];
  return [ref.url, ref.audioOnly ? YOUTUBE_AUDIO : ref.kind, ref.startSeconds, ref.durationSeconds];
}

/** The quiz's questions as CSV (UTF-8 with BOM so Excel keeps diacritics), in quiz order. */
export function questionsToCsv(questions: QuestionRecord[]): string {
  const rows = [...questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((question) => {
      const answer =
        question.type === 'MULTIPLE_CHOICE'
          ? (question.options?.find((option) => option.isCorrect)?.label ?? '')
          : question.type === 'FREE_TEXT'
            ? (question.accepted_answers ?? []).join(' | ')
            : question.correct_numeric;
      return [
        question.type,
        question.prompt,
        question.type === 'MULTIPLE_CHOICE' ? (question.options ?? []).map((option) => option.label).join(' | ') : '',
        answer,
        question.unit ?? '',
        question.points,
        question.time_limit_seconds,
        ...mediaCells(question.media),
        ...mediaCells(question.reveal_media),
      ]
        .map(cell)
        .join(',');
    });
  return `﻿${[CSV_COLUMNS.join(','), ...rows].join('\r\n')}\r\n`;
}
