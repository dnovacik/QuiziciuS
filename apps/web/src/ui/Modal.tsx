import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: closes on Escape and backdrop click, keeps Tab focus inside,
 * and gives focus back to whatever opened it.
 */
export function Modal({
  labelledBy,
  onClose,
  children,
  className = '',
  testId,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('input, select, textarea')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-testid={testId}
        className={`glass-card relative max-h-[92vh] w-full overflow-y-auto overflow-x-hidden rounded-3xl border-white/20 p-6 shadow-2xl sm:p-8 ${className}`}
      >
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="absolute right-5 top-5 z-10 rounded-xl p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </section>
    </div>
  );
}
