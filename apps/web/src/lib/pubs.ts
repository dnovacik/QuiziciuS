import { apiDelete, apiGet, apiPost, apiPut } from './api-client';

/** A shared venue record; the same pub is reused by every host and team that plays there. */
export interface Pub {
  id: string;
  name: string;
  city: string;
  address?: string | null;
}

export function pubLabel(pub: Pick<Pub, 'name' | 'city'>): string {
  return `${pub.name}, ${pub.city}`;
}

export const pubsApi = {
  search: (token: string, query = '') => apiGet<Pub[]>(`/pubs${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`, token),
  mine: (token: string) => apiGet<Pub[]>('/host/pubs', token),
  add: (token: string, pub: { name: string; city: string; address: string }) =>
    apiPost<Pub>('/host/pubs', { name: pub.name.trim(), city: pub.city.trim(), address: pub.address.trim() || undefined }, token),
  link: (token: string, pubId: string) => apiPut<Pub>(`/host/pubs/${pubId}`, {}, token),
  unlink: (token: string, pubId: string) => apiDelete<void>(`/host/pubs/${pubId}`, token),
};
