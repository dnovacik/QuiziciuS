import { QuestionRecord } from '../data/questions.repository';
import { CSV_COLUMNS, parseQuestionsCsv, questionsToCsv, readCsvRecords } from './question-csv';

const HEADER = CSV_COLUMNS.join(',');

describe('readCsvRecords', () => {
  it('handles quotes, doubled quotes, newlines inside quotes, CRLF and a BOM', () => {
    expect(readCsvRecords('﻿a,b\r\n"x, ""y""","line\nbreak"\r\n')).toEqual([
      ['a', 'b'],
      ['x, "y"', 'line\nbreak'],
    ]);
  });

  it('reads semicolon-separated files (Excel in Slovak)', () => {
    expect(readCsvRecords('type;prompt\nFREE_TEXT;Kto?')).toEqual([
      ['type', 'prompt'],
      ['FREE_TEXT', 'Kto?'],
    ]);
  });
});

describe('parseQuestionsCsv', () => {
  it('reads all three question types, in Slovak', () => {
    const result = parseQuestionsCsv(
      [
        'type,prompt,options,answer,unit,points,time_limit_seconds',
        'MULTIPLE_CHOICE,Hlavné mesto Slovenska?,Košice | Bratislava | Žilina,bratislava,,2,20',
        'free_text,Kto napísal Krvavé sonety?,,Hviezdoslav | Pavol Országh Hviezdoslav,,,',
        'NUMERIC_NEAREST,Výška Gerlachovského štítu?,,"2654,4",m,,0',
        '',
      ].join('\n'),
    );

    expect(result).toEqual({
      ok: true,
      questions: [
        expect.objectContaining({
          type: 'MULTIPLE_CHOICE',
          options: [
            { id: 'a', label: 'Košice', isCorrect: false },
            { id: 'b', label: 'Bratislava', isCorrect: true },
            { id: 'c', label: 'Žilina', isCorrect: false },
          ],
          points: 2,
          time_limit_seconds: 20,
          row: 2,
        }),
        expect.objectContaining({
          type: 'FREE_TEXT',
          accepted_answers: ['Hviezdoslav', 'Pavol Országh Hviezdoslav'],
          points: 1,
          time_limit_seconds: null,
        }),
        expect.objectContaining({ type: 'NUMERIC_NEAREST', correct_numeric: 2654.4, unit: 'm', time_limit_seconds: 0 }),
      ],
    });
  });

  it('tells the media kind from the link, or from media_kind', () => {
    const result = parseQuestionsCsv(
      [
        'type,prompt,answer,media_url,media_start,media_duration,reveal_media_url,reveal_media_kind',
        'FREE_TEXT,Kto spieva?,ABBA,https://youtu.be/dQw4w9WgXcQ,30,15,https://cdn.example/photo,image',
        'FREE_TEXT,Čo je to?,Mačka,https://cdn.example/cat.JPG?w=800,,,,',
      ].join('\n'),
    );

    expect(result.ok && result.questions.map((q) => [q.media, q.reveal_media])).toEqual([
      [
        { kind: 'youtube', source: 'link', url: 'https://youtu.be/dQw4w9WgXcQ', startSeconds: 30, durationSeconds: 15 },
        { kind: 'image', source: 'link', url: 'https://cdn.example/photo' },
      ],
      [{ kind: 'image', source: 'link', url: 'https://cdn.example/cat.JPG?w=800' }, null],
    ]);
  });

  it('reports every problem with its row and keeps nothing', () => {
    const result = parseQuestionsCsv(
      [
        'type,prompt,options,answer,points',
        'MULTIPLE_CHOICE,Otázka?,A | B,C,1',
        'NUMERIC_NEAREST,,,veľa,0',
        'ESSAY,Otázka?,,x,',
        'FREE_TEXT,Otázka?,,ok,',
      ].join('\n'),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        { row: 2, message: 'answer must be exactly one of the options' },
        { row: 3, message: 'prompt is empty' },
        { row: 3, message: 'answer must be a number' },
        { row: 3, message: 'points must be a whole number, 1 or more' },
        { row: 4, message: expect.stringContaining('type must be one of') },
      ],
    });
  });

  it('refuses unknown or missing columns', () => {
    expect(parseQuestionsCsv('type,question,answer\nFREE_TEXT,x,y')).toEqual({
      ok: false,
      errors: [
        { row: 1, message: 'Unknown columns: question' },
        { row: 1, message: 'Missing columns: prompt' },
      ],
    });
  });

  it('refuses a file with no questions', () => {
    expect(parseQuestionsCsv(`${HEADER}\n\n`)).toEqual({ ok: false, errors: [{ row: 2, message: 'The file has no questions' }] });
  });
});

describe('questionsToCsv', () => {
  const base = { quiz_id: 'q', unit: null, points: 1, time_limit_seconds: 30, media: null, reveal_media: null } as const;
  const questions: QuestionRecord[] = [
    {
      ...base,
      id: '2',
      order_index: 1,
      type: 'FREE_TEXT',
      prompt: 'Kto spieva "Dancing Queen"?',
      options: null,
      accepted_answers: ['ABBA', 'Abba'],
      correct_numeric: null,
      media: { kind: 'youtube', source: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', startSeconds: 30 },
      reveal_media: { kind: 'image', source: 'upload', path: 'h/q/x.jpg' },
    },
    {
      ...base,
      id: '1',
      order_index: 0,
      type: 'MULTIPLE_CHOICE',
      prompt: 'Rieka, ktorá tečie Bratislavou?',
      options: [
        { id: 'a', label: 'Dunaj', isCorrect: true },
        { id: 'b', label: 'Váh', isCorrect: false },
      ],
      accepted_answers: null,
      correct_numeric: null,
    },
  ];

  it('writes questions in quiz order with a BOM, leaving uploads out', () => {
    const csv = questionsToCsv(questions);

    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toEqual([
      `﻿${HEADER}`,
      'MULTIPLE_CHOICE,"Rieka, ktorá tečie Bratislavou?",Dunaj | Váh,Dunaj,,1,30,,,,,,,,',
      'FREE_TEXT,"Kto spieva ""Dancing Queen""?",,ABBA | Abba,,1,30,https://www.youtube.com/watch?v=dQw4w9WgXcQ,youtube,30,,,,,',
      '',
    ]);
  });

  it('reads back what it wrote', () => {
    const parsed = parseQuestionsCsv(questionsToCsv(questions));

    expect(parsed.ok && parsed.questions.map((q) => [q.type, q.prompt, q.options, q.accepted_answers, q.media])).toEqual([
      ['MULTIPLE_CHOICE', 'Rieka, ktorá tečie Bratislavou?', questions[1].options, null, null],
      ['FREE_TEXT', 'Kto spieva "Dancing Queen"?', null, ['ABBA', 'Abba'], questions[0].media],
    ]);
  });
});
