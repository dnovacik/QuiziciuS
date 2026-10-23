import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountRole } from '@quizicius/shared-types';
import { AccountsController, AdminController } from '../accounts/accounts.controller';
import { CategoriesController } from '../categories/categories.controller';
import { InfractionsController } from '../infractions/infractions.controller';
import { PubsController } from '../pubs/pubs.controller';
import { QuestionsController } from '../questions/questions.controller';
import { QuizzesController } from '../quizzes/quizzes.controller';
import { RegisteredTeamsController } from '../registered-teams/registered-teams.controller';
import { SessionsController } from '../sessions/sessions.controller';
import { RolesGuard } from './require-role';

function contextFor(role: AccountRole | null, handler = () => undefined, cls: object = class {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ authHost: role ? { id: 'u1', role, deactivated: false, subscription: null } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const requiring = (role: AccountRole) => {
    const handler = () => undefined;
    Reflect.defineMetadata('requiredRole', role, handler);
    return handler;
  };

  it('lets a host and a super admin through a host endpoint', () => {
    expect(guard.canActivate(contextFor('HOST', requiring('HOST')))).toBe(true);
    expect(guard.canActivate(contextFor('SUPER_ADMIN', requiring('HOST')))).toBe(true);
  });

  it('refuses a team captain on a host endpoint', () => {
    expect(() => guard.canActivate(contextFor('TEAM_CAPTAIN', requiring('HOST')))).toThrow(ForbiddenException);
  });

  it('refuses a host on an admin endpoint', () => {
    expect(() => guard.canActivate(contextFor('HOST', requiring('SUPER_ADMIN')))).toThrow(ForbiddenException);
  });
});

/** Guards against a new host endpoint being added without a role check. */
describe('role requirements on endpoints', () => {
  const reflector = new Reflector();
  const roleOf = (cls: new (...args: never[]) => object, method: string) =>
    reflector.getAllAndOverride<AccountRole | undefined>('requiredRole', [(cls.prototype as Record<string, () => void>)[method], cls]);
  const routes = (cls: new (...args: never[]) => object) =>
    Object.getOwnPropertyNames(cls.prototype).filter(
      (name) => name !== 'constructor' && Reflect.getMetadata('path', (cls.prototype as Record<string, object>)[name]) !== undefined,
    );

  it.each([QuizzesController, QuestionsController, CategoriesController])('every %p route requires HOST', (cls) => {
    for (const method of routes(cls)) expect([method, roleOf(cls, method)]).toEqual([method, 'HOST']);
  });

  it('host-only session endpoints require HOST; the public ones stay public', () => {
    const publicRoutes = ['findByJoinCode', 'displayMetadata', 'getState'];
    for (const method of routes(SessionsController)) {
      expect([method, roleOf(SessionsController, method)]).toEqual([method, publicRoutes.includes(method) ? undefined : 'HOST']);
    }
  });

  it('infraction review requires HOST; reporting stays with the team token', () => {
    for (const method of routes(InfractionsController)) {
      expect([method, roleOf(InfractionsController, method)]).toEqual([method, method === 'report' ? undefined : 'HOST']);
    }
  });

  it('the shared pub list needs any account; managing a pub list needs HOST', () => {
    for (const method of routes(PubsController)) {
      expect([method, roleOf(PubsController, method)]).toEqual([method, method === 'search' ? 'TEAM_CAPTAIN' : 'HOST']);
    }
  });

  it('registered teams need any account, the admin area a super admin', () => {
    for (const method of routes(RegisteredTeamsController)) expect(roleOf(RegisteredTeamsController, method)).toBe('TEAM_CAPTAIN');
    for (const method of routes(AccountsController)) expect(roleOf(AccountsController, method)).toBe('TEAM_CAPTAIN');
    for (const method of routes(AdminController)) expect(roleOf(AdminController, method)).toBe('SUPER_ADMIN');
  });
});
