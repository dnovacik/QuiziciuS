import { InMemoryProfilesRepository, InMemoryQuizzesRepository, InMemorySessionsRepository } from '../test-utils/in-memory-repositories';
import { AccountsService } from './accounts.service';
import { AuthAdminGateway } from './auth-admin.gateway';

function buildService() {
  const profiles = new InMemoryProfilesRepository();
  const quizzes = new InMemoryQuizzesRepository();
  const sessions = new InMemorySessionsRepository();
  const invites: { email: string; name: string }[] = [];
  const authAdmin: AuthAdminGateway = {
    inviteByEmail: async (email, name) => {
      invites.push({ email, name });
      // Mirrors the sign-up trigger: every new account starts as a captain.
      profiles.add('invited-1', 'TEAM_CAPTAIN', email);
      return 'invited-1';
    },
  };
  return { service: new AccountsService(profiles, quizzes, sessions, authAdmin), profiles, quizzes, sessions, invites };
}

// "Today" is 23 Oct 2026 in Slovakia for every test.
beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-23T10:00:00Z') }));
afterEach(() => jest.useRealTimers());

describe('AccountsService', () => {
  it('invites a new host by e-mail and makes the new account a host', async () => {
    const { service, invites } = buildService();

    const result = await service.inviteHost(' Pub.Host@Example.com ', 'Michal');

    expect(invites).toEqual([{ email: 'pub.host@example.com', name: 'Michal' }]);
    expect(result).toEqual({ invited: true, account: expect.objectContaining({ id: 'invited-1', role: 'HOST', displayName: 'Michal' }) });
  });

  it('promotes an existing captain account instead of sending an invite', async () => {
    const { service, profiles, invites } = buildService();
    profiles.add('captain-1', 'TEAM_CAPTAIN', 'captain@example.com');

    const result = await service.inviteHost('captain@example.com');

    expect(invites).toEqual([]);
    expect(result.invited).toBe(false);
    expect((await profiles.findById('captain-1'))?.role).toBe('HOST');
  });

  it('refuses to invite someone who already hosts', async () => {
    const { service, profiles } = buildService();
    profiles.add('host-1', 'HOST', 'host@example.com');

    await expect(service.inviteHost('host@example.com')).rejects.toMatchObject({ response: { code: 'ALREADY_HOST' } });
  });

  it('deactivates and reactivates a host, but never a super admin', async () => {
    const { service, profiles } = buildService();
    profiles.add('host-1', 'HOST');
    profiles.add('admin-1', 'SUPER_ADMIN');

    expect((await service.setHostActive('host-1', false)).deactivated).toBe(true);
    expect((await service.setHostActive('host-1', true)).deactivated).toBe(false);
    await expect(service.setHostActive('admin-1', false)).rejects.toMatchObject({ response: { code: 'CANNOT_DEACTIVATE_ADMIN' } });
  });

  it('lists hosts and admins with their activity, not captains', async () => {
    const { service, profiles, quizzes, sessions } = buildService();
    profiles.add('host-1', 'HOST');
    profiles.add('admin-1', 'SUPER_ADMIN');
    profiles.add('captain-1', 'TEAM_CAPTAIN');
    const quiz = await quizzes.create('host-1', 'Friday', null);
    await sessions.create(quiz.id, 'host-1', 'AB12');

    const hosts = await service.listHosts();

    expect(hosts.map((host) => host.id).sort()).toEqual(['admin-1', 'host-1']);
    expect(hosts.find((host) => host.id === 'host-1')).toMatchObject({ quizCount: 1, sessionCount: 1, lastSessionAt: expect.any(String) });
  });

  it('returns the signed-in account', async () => {
    const { service, profiles } = buildService();
    profiles.add('captain-1', 'TEAM_CAPTAIN', 'captain@example.com');

    expect(await service.me('captain-1')).toEqual({
      id: 'captain-1',
      email: 'captain@example.com',
      displayName: 'captain@example.com',
      role: 'TEAM_CAPTAIN',
      deactivated: false,
      subscription: null,
    });
  });

  describe('subscriptions', () => {
    it('starts a 14-day trial for an invited host', async () => {
      const { service } = buildService();

      const { account } = await service.inviteHost('new@pub.sk');

      expect(account.subscription).toEqual({ status: 'TRIAL', until: '2026-11-06', forever: false });
    });

    it('starts a trial for a promoted captain, but keeps an earlier subscription', async () => {
      const { service, profiles } = buildService();
      profiles.add('captain-1', 'TEAM_CAPTAIN', 'captain@example.com');
      profiles.add('former-1', 'TEAM_CAPTAIN', 'former@example.com');
      await profiles.update('former-1', { subscribed_until: '2027-01-31' });

      expect((await service.inviteHost('captain@example.com')).account.subscription?.status).toBe('TRIAL');
      expect((await service.inviteHost('former@example.com')).account.subscription).toEqual({
        status: 'ACTIVE',
        until: '2027-01-31',
        forever: false,
      });
    });

    it('extends by a month from today when the subscription has run out', async () => {
      const { service, profiles } = buildService();
      profiles.add('host-1', 'HOST');
      await profiles.update('host-1', { subscribed_until: '2026-09-30' });

      expect((await service.setSubscription('host-1', { extendMonths: 1 })).subscription).toEqual({
        status: 'ACTIVE',
        until: '2026-11-23',
        forever: false,
      });
    });

    it('extends from the current end date, which also ends the trial', async () => {
      const { service, profiles } = buildService();
      profiles.add('host-1', 'HOST');
      await profiles.update('host-1', { subscribed_until: '2026-11-06', subscription_trial: true });

      expect((await service.setSubscription('host-1', { extendMonths: 1 })).subscription).toEqual({
        status: 'ACTIVE',
        until: '2026-12-06',
        forever: false,
      });
    });

    it('sets an end date; a date in the past means expired', async () => {
      const { service, profiles } = buildService();
      profiles.add('host-1', 'HOST');

      expect((await service.setSubscription('host-1', { until: '2026-10-23' })).subscription?.status).toBe('ACTIVE');
      expect((await service.setSubscription('host-1', { until: '2026-10-22' })).subscription?.status).toBe('EXPIRED');
    });

    it('keeps a forever host subscribed until forever is switched off', async () => {
      const { service, profiles } = buildService();
      profiles.add('host-1', 'HOST');
      await profiles.update('host-1', { subscribed_until: '2026-01-31' });

      expect((await service.setSubscription('host-1', { forever: true })).subscription?.status).toBe('FOREVER');
      expect((await service.setSubscription('host-1', { forever: false })).subscription).toEqual({
        status: 'EXPIRED',
        until: '2026-01-31',
        forever: false,
      });
    });

    it('treats super admins as always subscribed and refuses to change them', async () => {
      const { service, profiles } = buildService();
      profiles.add('admin-1', 'SUPER_ADMIN');
      profiles.add('captain-1', 'TEAM_CAPTAIN');

      expect((await service.me('admin-1')).subscription?.status).toBe('FOREVER');
      await expect(service.setSubscription('admin-1', { extendMonths: 1 })).rejects.toMatchObject({
        response: { code: 'ADMIN_ALWAYS_SUBSCRIBED' },
      });
      await expect(service.setSubscription('captain-1', { extendMonths: 1 })).rejects.toMatchObject({
        response: { code: 'HOST_NOT_FOUND' },
      });
    });
  });
});
