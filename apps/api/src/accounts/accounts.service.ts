import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountDto } from '@quizicius/shared-types';
import { ProfileRecord, ProfilesRepository } from '../data/profiles.repository';
import { QuizzesRepository } from '../data/quizzes.repository';
import { SessionsRepository } from '../data/sessions.repository';
import { AuthAdminGateway } from './auth-admin.gateway';

export interface AdminHostDto extends AccountDto {
  createdAt: string;
  quizCount: number;
  sessionCount: number;
  lastSessionAt: string | null;
}

export function toAccount(profile: ProfileRecord): AccountDto {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    deactivated: Boolean(profile.deactivated_at),
  };
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly profiles: ProfilesRepository,
    private readonly quizzes: QuizzesRepository,
    private readonly sessions: SessionsRepository,
    private readonly authAdmin: AuthAdminGateway,
  ) {}

  async me(accountId: string): Promise<AccountDto> {
    const profile = await this.profiles.findById(accountId);
    if (!profile) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    return toAccount(profile);
  }

  /** Hosts and super admins, with what they have been doing. */
  async listHosts(): Promise<AdminHostDto[]> {
    const hosts = await this.profiles.listByRoles(['SUPER_ADMIN', 'HOST']);
    return Promise.all(
      hosts.map(async (host) => {
        const [quizzes, sessions] = await Promise.all([this.quizzes.listByHost(host.id), this.sessions.listByHost(host.id)]);
        const last =
          sessions
            .map((session) => session.created_at)
            .sort()
            .at(-1) ?? null;
        return {
          ...toAccount(host),
          createdAt: host.created_at,
          quizCount: quizzes.length,
          sessionCount: sessions.length,
          lastSessionAt: last,
        };
      }),
    );
  }

  /**
   * Makes someone a host. An existing account (e.g. a captain) is promoted in place; a new
   * e-mail gets a Supabase invite to set a password.
   */
  async inviteHost(rawEmail: string, rawName?: string): Promise<{ account: AccountDto; invited: boolean }> {
    const email = rawEmail.trim().toLowerCase();
    const displayName = rawName?.trim() || email;
    const existing = await this.profiles.findByEmail(email);
    if (existing) {
      if (existing.role !== 'TEAM_CAPTAIN')
        throw new ConflictException({ code: 'ALREADY_HOST', message: 'This account is already a host' });
      return { account: toAccount(await this.profiles.update(existing.id, { role: 'HOST', deactivated_at: null })), invited: false };
    }
    const userId = await this.authAdmin.inviteByEmail(email, displayName);
    // The sign-up trigger has created the profile as a captain; promote it.
    const profile = await this.profiles.update(userId, { role: 'HOST', display_name: displayName });
    return { account: toAccount(profile), invited: true };
  }

  /** Deactivated hosts keep their data and can sign in, but cannot launch quiz nights. */
  async setHostActive(hostId: string, active: boolean): Promise<AccountDto> {
    const profile = await this.profiles.findById(hostId);
    if (!profile || profile.role === 'TEAM_CAPTAIN') throw new NotFoundException({ code: 'HOST_NOT_FOUND', message: 'Host not found' });
    if (profile.role === 'SUPER_ADMIN')
      throw new BadRequestException({ code: 'CANNOT_DEACTIVATE_ADMIN', message: 'Super admins cannot be deactivated' });
    return toAccount(await this.profiles.update(hostId, { deactivated_at: active ? null : new Date().toISOString() }));
  }
}
