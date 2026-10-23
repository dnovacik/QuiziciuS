import type { QuestionType } from '@quizicius/shared-types';
import type { TranslationKey } from '../../lib/i18n';
import type { QuestionDraft, QuestionOption } from '../api';

export const MAX_OPTIONS = 6;
export const MAX_PROMPT = 250;
export const TIMER_CHOICES = [15, 20, 30, 45, 60, 90] as const;

function freshOptions(): QuestionOption[] {
  return ['a', 'b', 'c', 'd'].map((id, index) => ({ id, label: '', isCorrect: index === 0 }));
}

export function blankQuestion(orderIndex: number): QuestionDraft {
  return {
    type: 'MULTIPLE_CHOICE',
    prompt: '',
    media_type: null,
    media_path: null,
    options: freshOptions(),
    accepted_answers: null,
    correct_numeric: null,
    points: 10,
    time_limit_seconds: 30,
    order_index: orderIndex,
  };
}

/** Switching type keeps what the other types need so switching back loses nothing. */
export function withType(draft: QuestionDraft, type: QuestionType): QuestionDraft {
  return {
    ...draft,
    type,
    options: draft.options ?? (type === 'MULTIPLE_CHOICE' ? freshOptions() : null),
    accepted_answers: draft.accepted_answers ?? (type === 'FREE_TEXT' ? [''] : null),
  };
}

/** Next free option id: a, b, c … */
export function nextOptionId(options: QuestionOption[]): string {
  return 'abcdefghijklmnopqrstuvwxyz'.split('').find((id) => !options.some((option) => option.id === id)) ?? String(options.length);
}

export function validate(draft: QuestionDraft): TranslationKey[] {
  const errors: TranslationKey[] = [];
  if (!draft.prompt.trim()) errors.push('host.editor.validation.prompt');
  if (draft.type === 'MULTIPLE_CHOICE') {
    const options = draft.options ?? [];
    if (options.length < 2) errors.push('host.editor.validation.options');
    if (options.some((option) => !option.label.trim())) errors.push('host.editor.validation.optionText');
    if (options.filter((option) => option.isCorrect).length !== 1) errors.push('host.editor.validation.correct');
  }
  if (draft.type === 'FREE_TEXT' && !(draft.accepted_answers ?? []).some((answer) => answer.trim())) {
    errors.push('host.editor.validation.accepted');
  }
  if (draft.type === 'NUMERIC_NEAREST' && (draft.correct_numeric === null || !Number.isFinite(draft.correct_numeric))) {
    errors.push('host.editor.validation.numeric');
  }
  if (!(draft.points >= 1)) errors.push('host.editor.validation.points');
  return errors;
}

/** Empty alternatives are dropped before saving. */
export function cleanForSave(draft: QuestionDraft): QuestionDraft {
  return draft.type === 'FREE_TEXT'
    ? { ...draft, accepted_answers: (draft.accepted_answers ?? []).filter((answer) => answer.trim()) }
    : draft;
}
