import { InMemoryPubsRepository } from '../test-utils/in-memory-repositories';
import { PubsService } from './pubs.service';

function buildService() {
  const repo = new InMemoryPubsRepository();
  return { repo, service: new PubsService(repo) };
}

describe('PubsService', () => {
  it('adds a new pub to the host venue list', async () => {
    const { service } = buildService();

    const pub = await service.addForHost('host1', { name: ' U Zlatého leva ', city: 'Žilina', address: 'Mariánske nám. 1' });

    expect(pub).toMatchObject({ name: 'U Zlatého leva', city: 'Žilina', address: 'Mariánske nám. 1' });
    expect(await service.listForHost('host1')).toEqual([pub]);
  });

  it('reuses a pub another host already added instead of duplicating it', async () => {
    const { service, repo } = buildService();
    const first = await service.addForHost('host1', { name: 'U Zlatého leva', city: 'Žilina' });

    const second = await service.addForHost('host2', { name: 'u zlatého leva', city: 'ŽILINA ' });

    expect(second.id).toBe(first.id);
    expect(repo.pubs.size).toBe(1);
    expect(await service.listForHost('host2')).toEqual([first]);
  });

  it('removes a pub from the host list without deleting the shared pub', async () => {
    const { service } = buildService();
    const pub = await service.addForHost('host1', { name: 'Black Dog', city: 'Bratislava' });

    await service.unlinkForHost('host1', pub.id);

    expect(await service.listForHost('host1')).toEqual([]);
    expect(await service.search('black')).toEqual([pub]);
  });

  it('sets team pubs with the first pub as primary by default', async () => {
    const { service } = buildService();
    const a = await service.addForHost('host1', { name: 'Black Dog', city: 'Bratislava' });
    const b = await service.addForHost('host1', { name: 'U Zlatého leva', city: 'Žilina' });

    await service.setTeamPubs('rt1', [b.id, a.id, b.id], undefined);

    expect(await service.listForTeam('rt1')).toEqual([
      { ...b, is_primary: true },
      { ...a, is_primary: false },
    ]);
  });

  it('keeps the chosen primary pub and rejects unknown pubs', async () => {
    const { service } = buildService();
    const a = await service.addForHost('host1', { name: 'Black Dog', city: 'Bratislava' });
    const b = await service.addForHost('host1', { name: 'U Zlatého leva', city: 'Žilina' });

    await service.setTeamPubs('rt1', [a.id, b.id], b.id);
    expect((await service.listForTeam('rt1')).find((pub) => pub.is_primary)?.id).toBe(b.id);

    await expect(service.setTeamPubs('rt1', ['missing'], null)).rejects.toMatchObject({ response: { code: 'PUB_NOT_FOUND' } });
  });

  it('refuses more than five pubs per team', async () => {
    const { service } = buildService();
    const ids = await Promise.all(
      ['A1', 'B2', 'C3', 'D4', 'E5', 'F6'].map(async (name) => (await service.addForHost('host1', { name, city: 'Žilina' })).id),
    );

    await expect(service.setTeamPubs('rt1', ids, null)).rejects.toMatchObject({ response: { code: 'TOO_MANY_PUBS' } });
  });
});
