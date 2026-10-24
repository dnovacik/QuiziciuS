import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, CirclePlay, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ScheduledNightDto } from '@quizicius/shared-types';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api-client';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { pubLabel } from '../lib/pubs';
import { Modal } from '../ui/Modal';
import type { Quiz } from './api';
import { StartSessionDialog } from './library';
import { PubSelect, useHostPubs } from './pubs';
import { btn, inputClass, Label } from './ui';

interface NightInput {
  startsAt: string;
  pubId: string;
  quizId: string | null;
  note: string | null;
}

export const scheduleApi = {
  list: (token: string) => apiGet<ScheduledNightDto[]>('/host/schedule', token),
  create: (token: string, night: NightInput) => apiPost<ScheduledNightDto>('/host/schedule', night, token),
  update: (token: string, id: string, night: NightInput) => apiPut<ScheduledNightDto>(`/host/schedule/${id}`, night, token),
  remove: (token: string, id: string) => apiDelete<void>(`/host/schedule/${id}`, token),
};

/** "Fri 24. 10., 20:00" in the viewer's language. */
export function useNightTime() {
  const { locale } = useI18n();
  return (iso: string) =>
    new Date(iso).toLocaleString(locale === 'sk' ? 'sk-SK' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
}

/** `datetime-local` value (local time) for an ISO instant, and back. */
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (value: string) => new Date(value).toISOString();

/** The host dashboard's card of quiz nights planned ahead. */
export function ScheduleCard({ token, quizzes }: { token: string; quizzes: Quiz[] }) {
  const { t } = useI18n();
  const when = useNightTime();
  const [nights, setNights] = useState<ScheduledNightDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduledNightDto | 'new' | null>(null);
  const [starting, setStarting] = useState<ScheduledNightDto | null>(null);

  const load = useCallback(() => {
    scheduleApi
      .list(token)
      .then(setNights)
      .catch((err) => setError(describeError(err, t, 'errors.generic')));
  }, [token, t]);
  useEffect(load, [load]);

  async function remove(night: ScheduledNightDto) {
    try {
      await scheduleApi.remove(token, night.id);
      load();
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
    }
  }

  const startQuiz = starting?.quizId ? quizzes.find((quiz) => quiz.id === starting.quizId) : undefined;

  return (
    <div
      className="flex h-full flex-col gap-space-sm rounded-2xl bg-surface-container-low/70 p-space-lg shadow-md"
      data-testid="schedule-card"
    >
      <div className="flex items-center justify-between gap-space-sm">
        <span className="flex w-fit items-center gap-1 rounded-full bg-secondary-container/20 px-2.5 py-1 text-label-sm uppercase tracking-wide text-secondary">
          <CalendarClock className="h-3.5 w-3.5" />
          {t('host.dashboard.scheduled')}
        </span>
        <button
          type="button"
          className={`${btn.secondary} px-space-sm py-1 text-label-sm`}
          onClick={() => setEditing('new')}
          data-testid="schedule-add"
        >
          <Plus className="h-4 w-4" />
          {t('host.schedule.plan')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
      {nights !== null && nights.length === 0 && <p className="text-body-sm text-on-surface-variant">{t('host.schedule.empty')}</p>}
      <ul className="flex flex-col gap-space-xs">
        {(nights ?? []).slice(0, 5).map((night) => (
          <li
            key={night.id}
            className="flex items-start justify-between gap-space-sm rounded-xl bg-surface-container p-space-sm"
            data-testid={`schedule-${night.id}`}
          >
            <div className="min-w-0">
              <div className="text-label-lg text-on-surface">{when(night.startsAt)}</div>
              <div className="truncate text-body-sm text-on-surface-variant">
                {night.pub ? pubLabel(night.pub) : '—'}
                {night.quizTitle && ` · ${night.quizTitle}`}
              </div>
              {night.note && <div className="truncate text-body-sm text-secondary">{night.note}</div>}
            </div>
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                className={btn.icon}
                onClick={() => setStarting(night)}
                aria-label={t('host.schedule.start')}
                title={t('host.schedule.start')}
                data-testid={`schedule-start-${night.id}`}
              >
                <CirclePlay className="h-4 w-4 text-tertiary" />
              </button>
              <button type="button" className={btn.icon} onClick={() => setEditing(night)} aria-label={t('host.schedule.edit')}>
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={btn.icon}
                onClick={() => void remove(night)}
                aria-label={t('host.schedule.delete')}
                data-testid={`schedule-delete-${night.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <NightDialog
          token={token}
          quizzes={quizzes}
          night={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {starting && (
        <StartSessionDialog
          token={token}
          quiz={startQuiz}
          choices={startQuiz ? [] : quizzes}
          pubId={starting.pub?.id}
          onClose={() => setStarting(null)}
        />
      )}
    </div>
  );
}

function NightDialog({
  token,
  quizzes,
  night,
  onClose,
  onSaved,
}: {
  token: string;
  quizzes: Quiz[];
  night: ScheduledNightDto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { pubs } = useHostPubs(token);
  const [startsAt, setStartsAt] = useState(night ? toLocalInput(night.startsAt) : '');
  const [pubId, setPubId] = useState(night?.pub?.id ?? '');
  const [quizId, setQuizId] = useState(night?.quizId ?? '');
  const [note, setNote] = useState(night?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosenPub = pubId || pubs[0]?.id || '';

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!startsAt || !chosenPub || busy) return;
    setBusy(true);
    setError(null);
    const input = { startsAt: fromLocalInput(startsAt), pubId: chosenPub, quizId: quizId || null, note: note.trim() || null };
    try {
      await (night ? scheduleApi.update(token, night.id, input) : scheduleApi.create(token, input));
      onSaved();
    } catch (err) {
      setError(describeError(err, t, 'errors.generic'));
      setBusy(false);
    }
  }

  return (
    <Modal tone="surface" labelledBy="night-dialog-title" onClose={onClose} className="max-w-lg" testId="schedule-dialog">
      <form className="flex flex-col gap-space-md" onSubmit={(event) => void save(event)}>
        <h3 id="night-dialog-title" className="text-headline-sm text-on-surface">
          {t(night ? 'host.schedule.edit' : 'host.schedule.plan')}
        </h3>
        <div>
          <Label htmlFor="night-starts">{t('host.schedule.when')}</Label>
          <input
            id="night-starts"
            type="datetime-local"
            required
            className={inputClass}
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            data-testid="schedule-starts"
          />
        </div>
        <PubSelect id="night-pub" testId="schedule-pub" pubs={pubs} value={chosenPub} onChange={setPubId} />
        <div>
          <Label htmlFor="night-quiz">{t('host.schedule.quiz')}</Label>
          <select
            id="night-quiz"
            className={inputClass}
            value={quizId}
            onChange={(event) => setQuizId(event.target.value)}
            data-testid="schedule-quiz"
          >
            <option value="">{t('host.schedule.quizLater')}</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="night-note">{t('host.schedule.note')}</Label>
          <input
            id="night-note"
            className={inputClass}
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('host.schedule.notePlaceholder')}
            data-testid="schedule-note"
          />
        </div>
        {error && (
          <p role="alert" className="text-body-sm text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-space-sm">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {t('host.common.cancel')}
          </button>
          <button type="submit" className={btn.primary} disabled={busy || !startsAt || !chosenPub} data-testid="schedule-save">
            {t('host.editor.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
