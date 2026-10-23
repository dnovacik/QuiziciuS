import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Beer, MapPin, Plus, Store, Trash2 } from 'lucide-react';
import { describeError } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { pubLabel, pubsApi, type Pub } from '../lib/pubs';
import { btn, Card, ErrorBanner, inputClass, Label, useToast } from './ui';

/** The host's venue list. */
export function useHostPubs(token: string) {
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(() => {
    pubsApi
      .mine(token)
      .then((rows) => {
        setPubs(rows);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [token]);
  useEffect(reload, [reload]);

  return { pubs, loading, error, reload };
}

/** Pub picker for quizzes and sessions; lists the host's pubs and links to /host/pubs to add more. */
export function PubSelect({
  id,
  pubs,
  value,
  onChange,
  testId,
}: {
  id: string;
  pubs: Pub[];
  value: string;
  onChange: (pubId: string) => void;
  testId?: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{t('host.pubs.field')}</Label>
        <Link to="/host/pubs" className="mb-1 text-label-sm text-primary hover:underline">
          {pubs.length ? t('host.pubs.manage') : t('host.pubs.addFirst')}
        </Link>
      </div>
      <select id={id} data-testid={testId} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t('host.pubs.none')}</option>
        {pubs.map((pub) => (
          <option key={pub.id} value={pub.id}>
            {pubLabel(pub)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** /host/pubs — the pubs where the host runs quizzes. Pubs are shared, so existing ones are offered first. */
export function PubsPage({ token }: { token: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const { pubs, loading, error, reload } = useHostPubs(token);
  const [form, setForm] = useState({ name: '', city: '', address: '' });
  const [matches, setMatches] = useState<Pub[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Suggest pubs other hosts already added, so the same place is not created twice.
  useEffect(() => {
    const query = form.name.trim();
    if (query.length < 2) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      pubsApi
        .search(token, query)
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [token, form.name]);
  const suggestions = matches.filter((match) => !pubs.some((pub) => pub.id === match.id)).slice(0, 5);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setFormError(null);
    try {
      await action();
      toast(message);
      reload();
      return true;
    } catch (err) {
      setFormError(describeError(err, t, 'errors.generic'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy || form.name.trim().length < 2 || form.city.trim().length < 2) return;
    if (await run(() => pubsApi.add(token, form), t('host.pubs.added'))) setForm({ name: '', city: '', address: '' });
  }

  return (
    <div className="flex w-full flex-col gap-space-lg" data-testid="host-pubs">
      <div className="flex items-center gap-space-sm py-space-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container/20 text-secondary">
          <Beer className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-headline-lg tracking-tight text-on-surface">{t('host.nav.pubs')}</h1>
          <p className="text-body-md text-on-surface-variant">{t('host.pubs.subtitle')}</p>
        </div>
      </div>
      {error !== null && <ErrorBanner>{describeError(error, t, 'errors.generic')}</ErrorBanner>}

      <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
        <div className="flex flex-col gap-space-md xl:col-span-7">
          {pubs.length === 0 && !loading ? (
            <div
              className="rounded-2xl bg-surface-container-low/70 p-space-lg text-body-md text-on-surface-variant"
              data-testid="pubs-empty"
            >
              {t('host.pubs.empty')}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-space-sm md:grid-cols-2">
              {pubs.map((pub) => (
                <li
                  key={pub.id}
                  className="flex items-start justify-between gap-space-sm rounded-2xl bg-surface-container-low p-space-md shadow-lg"
                  data-testid="host-pub"
                >
                  <div className="flex min-w-0 gap-space-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                      <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-label-lg text-on-surface">{pub.name}</p>
                      <p className="flex items-center gap-1 text-body-sm text-on-surface-variant">
                        <MapPin className="h-3.5 w-3.5" />
                        {pub.city}
                      </p>
                      {pub.address && <p className="truncate text-body-sm text-on-surface-variant/80">{pub.address}</p>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={btn.icon}
                    disabled={busy}
                    aria-label={t('host.pubs.remove')}
                    data-testid={`pub-remove-${pub.id}`}
                    onClick={() => void run(() => pubsApi.unlink(token, pub.id), t('host.pubs.removed'))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-body-sm text-on-surface-variant">{t('host.pubs.sharedNote')}</p>
        </div>

        <Card className="flex flex-col gap-space-md xl:col-span-5" testId="pub-form">
          <div className="flex items-center gap-space-sm">
            <Plus className="h-5 w-5 text-primary" />
            <h2 className="text-headline-sm text-on-surface">{t('host.pubs.addTitle')}</h2>
          </div>
          <form className="flex flex-col gap-space-md" onSubmit={(event) => void add(event)}>
            <div>
              <Label htmlFor="pub-name">{t('host.pubs.name')}</Label>
              <input
                id="pub-name"
                data-testid="pub-name"
                className={inputClass}
                value={form.name}
                maxLength={80}
                placeholder={t('host.pubs.namePlaceholder')}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="rounded-xl bg-surface-container p-space-sm" data-testid="pub-suggestions">
                <p className="mb-space-xs text-label-sm uppercase tracking-wider text-on-surface-variant">{t('host.pubs.existing')}</p>
                <ul className="flex flex-col gap-1">
                  {suggestions.map((pub) => (
                    <li key={pub.id} className="flex items-center justify-between gap-space-sm">
                      <span className="truncate text-body-sm text-on-surface">{pubLabel(pub)}</span>
                      <button
                        type="button"
                        className={`${btn.secondary} py-1`}
                        disabled={busy}
                        data-testid={`pub-link-${pub.id}`}
                        onClick={() =>
                          void run(() => pubsApi.link(token, pub.id), t('host.pubs.added')).then(
                            (ok) => ok && setForm({ name: '', city: '', address: '' }),
                          )
                        }
                      >
                        {t('host.pubs.useExisting')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <Label htmlFor="pub-city">{t('host.pubs.city')}</Label>
              <input
                id="pub-city"
                data-testid="pub-city"
                className={inputClass}
                value={form.city}
                maxLength={60}
                placeholder={t('host.pubs.cityPlaceholder')}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="pub-address">{t('host.pubs.address')}</Label>
              <input
                id="pub-address"
                data-testid="pub-address"
                className={inputClass}
                value={form.address}
                maxLength={160}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </div>
            {formError && (
              <p role="alert" className="text-body-sm text-error">
                {formError}
              </p>
            )}
            <button
              type="submit"
              className={btn.primary}
              data-testid="pub-add-submit"
              disabled={busy || form.name.trim().length < 2 || form.city.trim().length < 2}
            >
              {busy ? t('common.working') : t('host.pubs.addSubmit')}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
