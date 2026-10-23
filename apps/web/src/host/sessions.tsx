import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, MapPin, MonitorPlay, QrCode, SlidersHorizontal, Users } from 'lucide-react';
import type { QuizSessionStateDto, QuizState } from '@quizicius/shared-types';
import { apiGet } from '../lib/api-client';
import { useI18n } from '../lib/i18n';
import { rankTeams } from '../lib/quiz';
import { useSessionDisplay } from '../lib/use-quiz-title';
import { Modal } from '../ui/Modal';
import type { HostSession, Quiz } from './api';
import { btn, useCopy } from './ui';

export function joinUrl(sessionId: string): string {
  return new URL(`/play/${sessionId}`, window.location.origin).href;
}

const STATUS_STYLE: Record<QuizState, string> = {
  LOBBY: 'bg-secondary-container/20 text-secondary',
  LOCK_IN_ROUND: 'bg-tertiary-container/30 text-tertiary-fixed',
  QUESTION_ACTIVE: 'bg-tertiary-container/30 text-tertiary-fixed',
  QUESTION_REVEAL: 'bg-tertiary-container/30 text-tertiary-fixed',
  PAUSE_BREAK: 'bg-secondary-container/20 text-secondary',
  FINISHED: 'bg-surface-container-highest text-on-surface-variant',
};

export function StatusPill({ status }: { status: QuizState }) {
  const { t } = useI18n();
  const live = status !== 'LOBBY' && status !== 'FINISHED' && status !== 'PAUSE_BREAK';
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-label-sm uppercase tracking-wide ${STATUS_STYLE[status]}`}
      data-testid="session-status"
    >
      <span className={`h-2 w-2 rounded-full ${live ? 'animate-ping bg-tertiary' : 'bg-current'}`} />
      {t(`host.status.${status}`)}
    </span>
  );
}

/** Live session card from the Stitch dashboard ("Živé relácie v reálnom čase"). */
export function LiveSessionCard({ session, quiz }: { session: HostSession; quiz: Quiz | undefined }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const copy = useCopy();
  const [state, setState] = useState<QuizSessionStateDto | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const { pub } = useSessionDisplay(session.pub_id ? session.id : undefined);

  useEffect(() => {
    apiGet<QuizSessionStateDto>(`/sessions/${session.id}/state`)
      .then(setState)
      .catch(() => setState(null));
  }, [session.id]);

  const teams = state?.teams ?? [];
  const leader = rankTeams(teams)[0];
  return (
    <article
      className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-surface-container-low/90 p-space-lg shadow-xl backdrop-blur-xl"
      data-testid={`live-session-${session.id}`}
    >
      <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-tertiary via-primary-container to-tertiary" />
      <div>
        <div className="mb-space-md flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-xs">
            <StatusPill status={state?.status ?? session.status} />
            {state?.currentQuestion && state.status !== 'LOBBY' && (
              <span className="text-body-sm text-on-surface-variant">
                • {t('host.common.question')} {state.currentQuestion.orderIndex + 1}
              </span>
            )}
          </div>
          <div className="flex items-center gap-space-xs rounded-xl bg-surface-container-highest/80 px-3 py-1">
            <span className="text-label-sm text-on-surface-variant">{t('host.session.code')}</span>
            <span className="text-headline-sm font-extrabold tracking-widest text-secondary">#{session.join_code}</span>
            <button type="button" className={btn.icon} aria-label={t('host.session.copyCode')} onClick={() => copy(session.join_code)}>
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        <h3 className="text-headline-md tracking-tight text-on-surface">{quiz?.title ?? '—'}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-space-md text-body-sm text-on-surface-variant">
          {pub && (
            <span className="flex items-center gap-1" data-testid="session-pub">
              <MapPin className="h-4 w-4 text-secondary" />
              {pub}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4 text-tertiary" />
            <strong className="font-semibold text-tertiary">
              {teams.filter((team) => team.isActive).length} {t('host.session.teamsConnected')}
            </strong>
          </span>
          {leader && leader.score > 0 && (
            <span className="text-primary">
              1. {leader.name} ({leader.score} {t('host.common.pointsShort')})
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-space-sm pt-space-lg">
        <button type="button" className={btn.secondary} onClick={() => setQrOpen(true)} data-testid="session-show-qr">
          <QrCode className="h-[18px] w-[18px]" />
          {t('host.session.showQr')}
        </button>
        <a className={btn.secondary} href={`/projector/${session.id}`} target="_blank" rel="noreferrer">
          <MonitorPlay className="h-[18px] w-[18px] text-secondary" />
          {t('host.session.projector')}
        </a>
        <button
          type="button"
          className={btn.primary}
          onClick={() => navigate(`/host/sessions/${session.id}`)}
          data-testid={`session-open-${session.id}`}
        >
          <SlidersHorizontal className="h-5 w-5" />
          {t('host.session.controlRoom')}
        </button>
      </div>
      {qrOpen && <QrDialog sessionId={session.id} joinCode={session.join_code} onClose={() => setQrOpen(false)} />}
    </article>
  );
}

export function QrDialog({ sessionId, joinCode, onClose }: { sessionId: string; joinCode: string; onClose: () => void }) {
  const { t } = useI18n();
  const url = joinUrl(sessionId);
  return (
    <Modal tone="surface" labelledBy="qr-dialog-title" onClose={onClose} className="max-w-sm" testId="qr-dialog">
      <div className="flex flex-col items-center gap-space-md text-center">
        <span id="qr-dialog-title" className="text-label-sm font-bold uppercase tracking-widest text-secondary">
          QuiziciuS QR Connect
        </span>
        <div className="rounded-2xl bg-white p-4 shadow-xl">
          <QRCodeSVG value={url} size={192} level="M" marginSize={0} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">{t('host.session.scanToJoin')}</span>
          <span className="text-display-lg tracking-widest text-secondary">#{joinCode}</span>
          <span className="break-all text-body-sm text-on-surface-variant">{url}</span>
        </div>
        <button type="button" className={`${btn.secondary} w-full`} onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}
