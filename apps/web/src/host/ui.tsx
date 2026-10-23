import { createContext, useCallback, useContext, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { CheckCircle2, Info, type LucideProps } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { Modal } from '../ui/Modal';

type Icon = ComponentType<LucideProps>;

// Button styles from the Stitch host screens.
export const btn = {
  primary:
    'inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-container px-space-md py-2.5 text-label-lg text-on-primary-container shadow-[0_0_20px_-4px_rgba(160,120,255,0.5)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50',
  gold: 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-secondary to-secondary-container px-space-lg py-2.5 text-label-lg text-on-secondary-fixed shadow-[0_0_20px_rgba(238,152,0,0.35)] transition-all hover:brightness-105 active:scale-95 disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-1.5 rounded-xl bg-surface-container-high px-space-md py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-bright disabled:cursor-not-allowed disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-1.5 rounded-xl px-space-md py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-1.5 rounded-xl bg-error-container px-space-lg py-2.5 text-label-lg text-on-error-container shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-50',
  icon: 'rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40',
} as const;

export const inputClass =
  'w-full rounded-xl bg-surface-container px-3 py-2.5 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60';

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-label-sm uppercase tracking-wider text-on-surface-variant">
      {children}
    </label>
  );
}

export function Card({ children, className = '', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={`rounded-2xl bg-surface-container-low/90 p-space-lg shadow-xl backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p role="alert" data-testid="host-error" className="rounded-xl bg-error-container/30 p-space-md text-body-md text-on-error-container">
      {children}
    </p>
  );
}

/** Confirmation dialog in the Stitch style (icon tile, title, text, two actions). */
export function ConfirmDialog({
  icon: IconComponent,
  tone = 'primary',
  title,
  text,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onClose,
  children,
  testId,
}: {
  icon: Icon;
  tone?: 'primary' | 'danger' | 'success';
  title: string;
  text: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
  testId?: string;
}) {
  const { t } = useI18n();
  const tile = { primary: 'bg-primary-container/20 text-primary', danger: 'bg-error-container/20 text-error', success: 'bg-tertiary-container/20 text-tertiary' }[tone];
  const confirmClass = tone === 'danger' ? btn.danger : btn.primary;
  return (
    <Modal tone="surface" labelledBy="confirm-dialog-title" onClose={onClose} className="max-w-md" testId={testId}>
      <div className="flex flex-col gap-space-md">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tile}`}>
          <IconComponent className="h-7 w-7" />
        </div>
        <div>
          <h3 id="confirm-dialog-title" className="text-headline-sm text-on-surface">
            {title}
          </h3>
          <div className="mt-1 text-body-md text-on-surface-variant">{text}</div>
        </div>
        {children}
        <div className="flex items-center justify-end gap-space-sm pt-space-xs">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {cancelLabel ?? t('host.common.cancel')}
          </button>
          <button type="button" className={confirmClass} disabled={busy} onClick={onConfirm} data-testid="confirm-dialog-confirm">
            {busy ? t('common.working') : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

type Toast = { id: number; text: string; tone: 'success' | 'info' };
const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const show = useCallback((text: string, tone: Toast['tone'] = 'success') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <aside aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-[70] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="flex items-center gap-space-sm rounded-xl bg-surface-container-high/95 px-space-md py-3 text-label-md text-on-surface shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_16px_rgba(160,120,255,0.4)] backdrop-blur-xl"
          >
            {toast.tone === 'success' ? <CheckCircle2 className="h-5 w-5 text-tertiary" /> : <Info className="h-5 w-5 text-primary" />}
            {toast.text}
          </div>
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Copies text and confirms with a toast. */
export function useCopy() {
  const toast = useToast();
  const { t } = useI18n();
  return useCallback(
    (text: string) => {
      void navigator.clipboard?.writeText(text).then(() => toast(t('host.common.copied')));
    },
    [toast, t],
  );
}
