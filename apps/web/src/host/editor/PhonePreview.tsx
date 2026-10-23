import { Check, Smartphone, Timer } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { optionLetter } from '../../lib/quiz';
import type { QuestionDraft } from '../api';

/** "Živý náhľad pre hráčov" — the question as a player's phone shows it, correct answer highlighted. */
export function PhonePreview({ draft, index, total, mediaUrl }: { draft: QuestionDraft; index: number; total: number; mediaUrl: string | null }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center rounded-2xl bg-surface-container-low/90 p-space-md shadow-xl backdrop-blur-xl" data-testid="editor-preview">
      <div className="flex w-full items-center justify-between pb-space-sm">
        <div className="flex items-center gap-2">
          <Smartphone className="h-[18px] w-[18px] text-primary" />
          <span className="text-label-md text-on-surface">{t('host.editor.preview')}</span>
        </div>
        <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[10px] uppercase text-tertiary">{t('host.editor.mobile')}</span>
      </div>
      <div className="relative flex w-full max-w-[290px] flex-col rounded-[36px] bg-[#090b10] p-3 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_0_0_2px_rgba(255,255,255,0.1)]">
        <div className="mx-auto mb-2 flex h-4 w-24 items-center justify-center rounded-full bg-surface-container-lowest">
          <div className="h-1 w-8 rounded-full bg-surface-variant" />
        </div>
        <div className="relative flex min-h-[460px] w-full flex-col justify-between overflow-hidden rounded-[24px] bg-[#11131a] p-3">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              <span className="text-label-sm text-on-surface-variant">
                {t('host.common.question')} {index + 1}/{Math.max(total, index + 1)}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-primary">
              <Timer className="h-3 w-3" />
              {draft.time_limit_seconds}s
            </div>
          </div>
          <div className="my-auto flex flex-col gap-2">
            {mediaUrl && draft.media_type === 'image' && <img src={mediaUrl} alt="" className="h-24 w-full rounded-lg object-cover" />}
            {mediaUrl && draft.media_type === 'video' && <video src={mediaUrl} muted className="h-24 w-full rounded-lg bg-black object-cover" />}
            <div className="rounded-xl bg-surface-container/70 p-2.5">
              <p className="text-center text-[15px] font-bold leading-snug text-on-surface" data-testid="preview-prompt">
                {draft.prompt || t('host.editor.promptPlaceholderShort')}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 pt-1">
              {draft.type === 'MULTIPLE_CHOICE' &&
                (draft.options ?? []).map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className={`flex items-center gap-2 rounded-xl p-2 text-left text-xs ${
                      option.isCorrect ? 'bg-tertiary-container/30 font-bold text-tertiary shadow-[0_0_12px_rgba(78,222,163,0.3)]' : 'bg-surface-container-high/80 text-on-surface'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                        option.isCorrect ? 'bg-tertiary text-on-tertiary' : 'bg-surface-variant text-on-surface-variant'
                      }`}
                    >
                      {optionLetter(optionIndex)}
                    </span>
                    <span className="flex-1 truncate">{option.label || t('host.editor.optionPlaceholderShort')}</span>
                    {option.isCorrect && <Check className="h-3.5 w-3.5" />}
                  </div>
                ))}
              {draft.type === 'FREE_TEXT' && (
                <div className="flex flex-col gap-1.5 rounded-xl bg-surface-container p-2.5">
                  <span className="text-[10px] uppercase text-on-surface-variant">{t('host.editor.teamInput')}</span>
                  <div className="rounded-lg bg-surface-container-high p-2 text-xs text-on-surface-variant">{t('play.question.textPlaceholder')}</div>
                  <span className="pt-0.5 text-[10px] text-tertiary">
                    {t('host.editor.accepted')}: {draft.accepted_answers?.find((answer) => answer.trim()) ?? '…'}
                  </span>
                </div>
              )}
              {draft.type === 'NUMERIC_NEAREST' && (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-container p-2.5">
                  <span className="text-[10px] uppercase text-on-surface-variant">{t('play.question.numericLabel')}</span>
                  <div className="w-full rounded-lg bg-surface-container-high p-2 text-center text-lg font-extrabold text-secondary">
                    {draft.correct_numeric ?? '?'}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end pt-2 text-[10px] text-on-surface-variant">
            <span className="font-bold text-secondary">
              {draft.points} {t('host.common.pointsShort')}
            </span>
          </div>
        </div>
        <div className="mx-auto mt-2 h-1 w-20 rounded-full bg-white/20" />
      </div>
    </div>
  );
}
