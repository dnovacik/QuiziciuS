import { useRef, useState } from 'react';
import {
  Calculator,
  Check,
  Copy,
  Hash,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  Minus,
  Plus,
  SpellCheck,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import type { QuestionType } from '@quizicius/shared-types';
import { useI18n } from '../../lib/i18n';
import { optionLetter } from '../../lib/quiz';
import { Pending } from '../../ui/Pending';
import { ACCEPTED_MEDIA, type QuestionDraft } from '../api';
import { btn, Card, inputClass, Label } from '../ui';
import { MAX_OPTIONS, MAX_PROMPT, nextOptionId, TIMER_CHOICES, withType } from './question-draft';

const TYPES: { type: QuestionType; icon: typeof LayoutGrid }[] = [
  { type: 'MULTIPLE_CHOICE', icon: LayoutGrid },
  { type: 'FREE_TEXT', icon: Type },
  { type: 'NUMERIC_NEAREST', icon: Hash },
];

/** Centre panel of the Stitch quiz editor ("Úprava otázky"). */
export function QuestionForm({
  draft,
  index,
  isNew,
  dirty,
  busy,
  mediaUrl,
  mediaBusy,
  onChange,
  onUploadMedia,
  onRemoveMedia,
  onSave,
  onRevert,
  onDuplicate,
  onDelete,
}: {
  draft: QuestionDraft;
  index: number;
  isNew: boolean;
  dirty: boolean;
  busy: boolean;
  mediaUrl: string | null;
  mediaBusy: boolean;
  onChange: (patch: Partial<QuestionDraft>) => void;
  onUploadMedia: (file: File) => void;
  onRemoveMedia: () => void;
  onSave: () => void;
  onRevert: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState('');
  const options = draft.options ?? [];
  const accepted = draft.accepted_answers ?? [''];
  const timerChoices = TIMER_CHOICES.includes(draft.time_limit_seconds as (typeof TIMER_CHOICES)[number])
    ? TIMER_CHOICES
    : [...TIMER_CHOICES, draft.time_limit_seconds].sort((a, b) => a - b);

  const setOptions = (next: typeof options) => onChange({ options: next });

  return (
    <Card className="flex flex-col gap-space-lg" testId="editor-form">
      <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-xs">
        <div className="flex items-center gap-space-sm">
          <span className="rounded-lg bg-primary-container px-3 py-1 text-headline-sm text-on-primary-container">#{index + 1}</span>
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">{t(isNew ? 'host.editor.newQuestion' : 'host.editor.editing')}</span>
            <span className="text-label-sm uppercase text-primary">{t(`host.editor.type.${draft.type}`)}</span>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          {dirty && (
            <span
              className="flex items-center gap-1 rounded-full bg-secondary-container/20 px-2.5 py-1 text-label-sm text-secondary"
              data-testid="editor-dirty"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              {t('host.editor.unsaved')}
            </span>
          )}
          <button
            type="button"
            className={`${btn.icon} bg-surface-container`}
            onClick={onDuplicate}
            disabled={isNew || busy}
            title={t('host.editor.duplicate')}
            aria-label={t('host.editor.duplicate')}
            data-testid="editor-duplicate"
          >
            <Copy className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            className={`${btn.icon} bg-surface-container text-error hover:bg-error-container/30 hover:text-error`}
            onClick={onDelete}
            disabled={busy}
            title={t('host.editor.delete')}
            aria-label={t('host.editor.delete')}
            data-testid="editor-delete"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('host.editor.typeLabel')}</Label>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-container p-1.5" role="radiogroup">
          {TYPES.map(({ type, icon: Icon }) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={draft.type === type}
              data-testid={`editor-type-${type}`}
              onClick={() => onChange(withType(draft, type))}
              className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-label-sm transition-all ${
                draft.type === type
                  ? 'bg-primary-container text-on-primary-container shadow-md'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{t(`host.editor.typeShort.${type}`)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="editor-prompt">{t('host.editor.promptLabel')}</Label>
          <span className="text-label-sm text-on-surface-variant">
            {draft.prompt.length} / {MAX_PROMPT}
          </span>
        </div>
        <textarea
          id="editor-prompt"
          data-testid="editor-prompt"
          rows={3}
          maxLength={MAX_PROMPT}
          value={draft.prompt}
          onChange={(event) => onChange({ prompt: event.target.value })}
          placeholder={t('host.editor.promptPlaceholder')}
          className="w-full resize-none rounded-xl bg-surface-container p-space-md text-body-lg text-on-surface transition-all placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container/60 p-space-md" data-testid="editor-media">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-secondary" />
            <span className="text-label-md text-on-surface">{t('host.editor.media')}</span>
            <span className="text-label-sm text-on-surface-variant">({t('common.optional')})</span>
          </div>
          {!draft.media_path && (
            <button
              type="button"
              className="text-label-sm text-primary hover:underline disabled:opacity-50"
              disabled={mediaBusy}
              onClick={() => fileRef.current?.click()}
              data-testid="editor-media-add"
            >
              {mediaBusy ? t('host.editor.uploading') : `+ ${t('host.editor.addMedia')}`}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_MEDIA}
          className="hidden"
          data-testid="editor-media-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onUploadMedia(file);
          }}
        />
        {draft.media_path && (
          <div className="flex flex-col items-center gap-space-md pt-2 sm:flex-row">
            <div className="group relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-surface-container-high sm:w-48">
              {mediaUrl && draft.media_type === 'image' && (
                <img
                  src={mediaUrl}
                  alt={t('play.question.image')}
                  className="h-full w-full object-cover"
                  data-testid="editor-media-image"
                />
              )}
              {mediaUrl && draft.media_type === 'video' && (
                <video
                  src={mediaUrl}
                  controls
                  preload="metadata"
                  className="h-full w-full bg-black object-contain"
                  data-testid="editor-media-video"
                />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 text-body-sm text-on-surface-variant">
              <span className="text-label-md text-on-surface">{draft.media_path.split('/').pop()}</span>
              <span>{t('host.editor.mediaHint')}</span>
              <div className="mt-2 flex gap-space-md">
                <button
                  type="button"
                  className="text-label-sm text-primary hover:underline"
                  disabled={mediaBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {t('host.editor.changeMedia')}
                </button>
                <button
                  type="button"
                  className="text-label-sm text-error hover:underline"
                  onClick={onRemoveMedia}
                  data-testid="editor-media-remove"
                >
                  {t('host.editor.removeMedia')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {draft.type === 'MULTIPLE_CHOICE' && (
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-label-md text-on-surface">{t('host.editor.options')}</span>
              <p className="text-body-sm text-on-surface-variant">{t('host.editor.optionsHint')}</p>
            </div>
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg bg-surface-container px-3 py-1.5 text-label-sm text-primary transition-all hover:bg-surface-container-high"
                onClick={() => setOptions([...options, { id: nextOptionId(options), label: '', isCorrect: false }])}
                data-testid="editor-add-option"
              >
                <Plus className="h-4 w-4" />
                {t('host.editor.addOption')}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            {options.map((option, optionIndex) => (
              <div
                key={option.id}
                className={`flex items-center gap-2 rounded-xl p-1.5 transition-all ${option.isCorrect ? 'bg-tertiary-container/20 ring-1 ring-tertiary/40' : 'bg-surface-container'}`}
              >
                <label className="flex shrink-0 cursor-pointer items-center gap-2 pl-1">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={option.isCorrect}
                    onChange={() => setOptions(options.map((item) => ({ ...item, isCorrect: item.id === option.id })))}
                    className="h-4 w-4 cursor-pointer accent-tertiary"
                    aria-label={t('host.editor.markCorrect')}
                    data-testid={`editor-correct-${optionIndex}`}
                  />
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-label-md font-bold ${
                      option.isCorrect ? 'bg-tertiary text-on-tertiary' : 'bg-surface-container-high text-on-surface'
                    }`}
                  >
                    {optionLetter(optionIndex)}
                  </span>
                </label>
                <input
                  value={option.label}
                  onChange={(event) =>
                    setOptions(options.map((item) => (item.id === option.id ? { ...item, label: event.target.value } : item)))
                  }
                  placeholder={`${t('host.editor.optionPlaceholder')} ${optionLetter(optionIndex)}…`}
                  className="w-full bg-transparent px-2 py-1.5 text-body-md text-on-surface focus:outline-none"
                  data-testid={`editor-option-${optionIndex}`}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="p-1.5 text-on-surface-variant transition-colors hover:text-error"
                    aria-label={t('host.editor.removeOption')}
                    onClick={() => {
                      const rest = options.filter((item) => item.id !== option.id);
                      setOptions(rest.some((item) => item.isCorrect) ? rest : rest.map((item, i) => ({ ...item, isCorrect: i === 0 })));
                    }}
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {draft.type === 'FREE_TEXT' && (
        <div className="flex flex-col gap-space-md">
          <div className="flex items-start gap-3 rounded-xl bg-surface-container/60 p-space-md">
            <Info className="mt-0.5 h-[22px] w-[22px] shrink-0 text-secondary" />
            <div className="text-body-sm text-on-surface-variant">
              <p className="mb-1 text-label-md text-on-surface">{t('host.editor.freeTextTitle')}</p>
              <p>{t('host.editor.freeTextText')}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-label-md text-on-surface">{t('host.editor.accepted')}</span>
            <button
              type="button"
              className="flex items-center gap-1 rounded-lg bg-surface-container px-3 py-1.5 text-label-sm text-primary transition-all hover:bg-surface-container-high"
              onClick={() => onChange({ accepted_answers: [...accepted, ''] })}
              data-testid="editor-add-accepted"
            >
              <Plus className="h-4 w-4" />
              {t('host.editor.addAlternative')}
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {accepted.map((answer, answerIndex) => (
              <div key={answerIndex} className="flex items-center gap-2 rounded-xl bg-surface-container p-2">
                <span className="px-2 text-label-sm text-primary">#{answerIndex + 1}</span>
                <input
                  value={answer}
                  onChange={(event) =>
                    onChange({ accepted_answers: accepted.map((item, i) => (i === answerIndex ? event.target.value : item)) })
                  }
                  placeholder={t('host.editor.acceptedPlaceholder')}
                  className="w-full bg-transparent px-2 py-1 text-body-md text-on-surface focus:outline-none"
                  data-testid={`editor-accepted-${answerIndex}`}
                />
                {accepted.length > 1 && (
                  <button
                    type="button"
                    className="p-1 text-on-surface-variant hover:text-error"
                    aria-label={t('host.editor.removeOption')}
                    onClick={() => onChange({ accepted_answers: accepted.filter((_, i) => i !== answerIndex) })}
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-surface-container p-2 text-body-sm text-on-surface-variant">
            <SpellCheck className="h-[18px] w-[18px] text-tertiary" />
            {t('host.editor.accentsIgnored')}
          </div>
        </div>
      )}

      {draft.type === 'NUMERIC_NEAREST' && (
        <div className="flex flex-col gap-space-md">
          <div className="flex items-start gap-3 rounded-xl bg-surface-container/60 p-space-md">
            <Calculator className="mt-0.5 h-[22px] w-[22px] shrink-0 text-secondary" />
            <div className="text-body-sm text-on-surface-variant">
              <p className="mb-1 text-label-md text-on-surface">{t('host.editor.numericTitle')}</p>
              <p>{t('host.editor.numericText')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editor-numeric">{t('host.editor.exactValue')}</Label>
              <input
                id="editor-numeric"
                data-testid="editor-numeric"
                type="number"
                step="any"
                value={draft.correct_numeric ?? ''}
                onChange={(event) => onChange({ correct_numeric: event.target.value === '' ? null : Number(event.target.value) })}
                placeholder={t('host.editor.exactPlaceholder')}
                className="w-full rounded-xl bg-surface-container p-space-md text-headline-sm text-secondary placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
            <Pending feature="numeric-unit">
              <div className="flex flex-col gap-1.5">
                <Label>{t('host.editor.unit')}</Label>
                <input
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  placeholder={t('host.editor.unitPlaceholder')}
                  className={`${inputClass} p-space-md`}
                />
              </div>
            </Pending>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-space-md rounded-xl bg-surface-container/30 p-space-md sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="editor-points">{t('host.editor.points')}</Label>
            <span className="text-label-md text-secondary">
              {draft.points} {t('host.common.pointsShort')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="-5"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high"
              onClick={() => onChange({ points: Math.max(1, draft.points - 5) })}
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              id="editor-points"
              data-testid="editor-points"
              type="number"
              min={1}
              max={100}
              value={draft.points}
              onChange={(event) => onChange({ points: Math.max(1, Math.round(Number(event.target.value) || 1)) })}
              className="flex-1 rounded-xl bg-surface-container py-2 text-center text-headline-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              aria-label="+5"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high"
              onClick={() => onChange({ points: draft.points + 5 })}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="editor-timer">{t('host.editor.timer')}</Label>
            <span className="text-label-md text-primary">{draft.time_limit_seconds} s</span>
          </div>
          <select
            id="editor-timer"
            data-testid="editor-timer"
            value={draft.time_limit_seconds}
            onChange={(event) => onChange({ time_limit_seconds: Number(event.target.value) })}
            className={`${inputClass} cursor-pointer`}
          >
            {timerChoices.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} {t('host.editor.seconds')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-sm">
        <button
          type="button"
          className={`${btn.ghost} text-error hover:bg-error-container/20 hover:text-error`}
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 className="h-[18px] w-[18px]" />
          {t('host.editor.delete')}
        </button>
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            className={`${btn.ghost} bg-surface-container`}
            onClick={onRevert}
            disabled={!dirty || busy}
            data-testid="editor-revert"
          >
            {t('host.editor.revert')}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-space-lg py-2.5 text-label-lg text-on-primary shadow-[0_0_16px_rgba(208,188,255,0.4)] transition-all hover:brightness-105 active:scale-95 disabled:opacity-50"
            onClick={onSave}
            disabled={busy || (!dirty && !isNew)}
            data-testid="editor-save"
          >
            <Check className="h-[18px] w-[18px]" />
            {busy ? t('common.working') : t('host.editor.save')}
          </button>
        </div>
      </div>
    </Card>
  );
}
