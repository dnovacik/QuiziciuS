import {
  InMemoryProfilesRepository,
  InMemoryPubsRepository,
  InMemoryQuizzesRepository,
  InMemoryRegisteredTeamsRepository,
  InMemoryScheduledNightsRepository,
} from '../test-utils/in-memory-repositories';
import { ScheduleService } from './schedule.service';

const HOST = 'host-1';
const OTHER_HOST = 'host-2';
const CAPTAIN = 'captain-1';

async function build() {
  const nights = new InMemoryScheduledNightsRepository();
  const pubs = new InMemoryPubsRepository();
  const quizzes = new InMemoryQuizzesRepository();
  const teams = new InMemoryRegisteredTeamsRepository();
  const profiles = new InMemoryProfilesRepository();
  const service = new ScheduleService(nights, pubs, quizzes, teams, profiles);

  profiles.add(HOST, 'HOST', 'host@pub.sk');
  await profiles.update(HOST, { display_name: 'Michal' });
  const hoffman = await pubs.create({ name: 'KC Hoffman', city: 'Žilina', address: null });
  const mamut = await pubs.create({ name: 'Pub U Mamuta', city: 'Žilina', address: null });
  await pubs.linkHost(HOST, hoffman.id);
  const quiz = await quizzes.create(HOST, 'Friday Movies', null);
  const team = await teams.create({
    captainId: CAPTAIN,
    name: 'Wise Ducks',
    description: '',
    badge: 'shield',
    color: 'purple',
    expectedMembers: 4,
  });
  pubs.teamPubs.set(team.id, { pubIds: [hoffman.id], primary: hoffman.id });
  return { service, nights, hoffman: hoffman.id, mamut: mamut.id, quiz: quiz.id, team: team.id };
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('ScheduleService', () => {
  it('plans a night at one of the host’s pubs, with the quiz and a note, soonest first', async () => {
    const { service, hoffman, quiz } = await build();

    await service.create(HOST, { startsAt: inDays(14), pubId: hoffman, quizId: null, note: null });
    const first = await service.create(HOST, { startsAt: inDays(7), pubId: hoffman, quizId: quiz, note: '  Movie night  ' });

    expect(first).toMatchObject({ pub: { name: 'KC Hoffman' }, quizTitle: 'Friday Movies', note: 'Movie night' });
    expect((await service.listForHost(HOST)).map((night) => night.id)[0]).toBe(first.id);
  });

  it('refuses a pub the host has not added, or someone else’s quiz', async () => {
    const { service, mamut, hoffman, quiz } = await build();

    await expect(service.create(HOST, { startsAt: inDays(1), pubId: mamut })).rejects.toMatchObject({
      response: { code: 'PUB_NOT_YOURS' },
    });
    await expect(service.create(OTHER_HOST, { startsAt: inDays(1), pubId: hoffman, quizId: quiz })).rejects.toMatchObject({
      response: { code: 'PUB_NOT_YOURS' },
    });
  });

  it('leaves past nights out but keeps tonight’s', async () => {
    const { service, nights, hoffman } = await build();
    await nights.create(HOST, { pub_id: hoffman, quiz_id: null, starts_at: inDays(-3), note: null });
    await nights.create(HOST, { pub_id: hoffman, quiz_id: null, starts_at: new Date(Date.now() - 3_600_000).toISOString(), note: null });

    expect(await service.listForHost(HOST)).toHaveLength(1);
  });

  it('edits and deletes only the host’s own nights', async () => {
    const { service, hoffman } = await build();
    const night = await service.create(HOST, { startsAt: inDays(3), pubId: hoffman });

    expect((await service.update(HOST, night.id, { startsAt: inDays(4), pubId: hoffman, note: 'Moved' })).note).toBe('Moved');
    await expect(service.remove(OTHER_HOST, night.id)).rejects.toMatchObject({ response: { code: 'NIGHT_NOT_FOUND' } });
    await service.remove(HOST, night.id);
    expect(await service.listForHost(HOST)).toEqual([]);
  });

  it("shows a captain the nights coming up at the team's pubs, with the host's name", async () => {
    const { service, nights, hoffman, mamut, team } = await build();
    await service.create(HOST, { startsAt: inDays(2), pubId: hoffman, note: 'Halloween' });
    await nights.create(HOST, { pub_id: mamut, quiz_id: null, starts_at: inDays(1), note: null });

    const upcoming = await service.forTeam(CAPTAIN, team);

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]).toMatchObject({ pub: { name: 'KC Hoffman' }, note: 'Halloween', hostName: 'Michal' });
    await expect(service.forTeam('someone', team)).rejects.toMatchObject({ response: { code: 'TEAM_NOT_FOUND' } });
  });
});
