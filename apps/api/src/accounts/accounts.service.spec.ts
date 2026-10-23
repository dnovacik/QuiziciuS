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
    });
  });
});
