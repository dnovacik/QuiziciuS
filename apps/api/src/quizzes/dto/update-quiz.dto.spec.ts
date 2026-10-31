import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateQuizDto } from './update-quiz.dto';

const errorsOf = (body: unknown) => validateSync(plainToInstance(UpdateQuizDto, body), { whitelist: true });

describe('UpdateQuizDto rounds', () => {
  it('accepts rounds with a title, a question count and a break length', () => {
    expect(
      errorsOf({
        rounds: [
          { title: 'Music', questionCount: 10, breakMinutes: 10 },
          { title: 'Film', questionCount: 8, breakMinutes: 0 },
        ],
      }),
    ).toEqual([]);
    expect(errorsOf({ rounds: [] })).toEqual([]);
  });

  it('refuses an empty title, an empty round or an impossible break', () => {
    expect(errorsOf({ rounds: [{ title: '', questionCount: 10, breakMinutes: 5 }] })).not.toEqual([]);
    expect(errorsOf({ rounds: [{ title: 'Music', questionCount: 0, breakMinutes: 5 }] })).not.toEqual([]);
    expect(errorsOf({ rounds: [{ title: 'Music', questionCount: 5, breakMinutes: -1 }] })).not.toEqual([]);
    expect(errorsOf({ rounds: [{ title: 'Music', questionCount: 2.5, breakMinutes: 5 }] })).not.toEqual([]);
  });
});
