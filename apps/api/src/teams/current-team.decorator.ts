import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { TeamTokenPayload } from './team-token.service';

export const CurrentTeam = createParamDecorator((_data: unknown, ctx: ExecutionContext): TeamTokenPayload => {
  return ctx.switchToHttp().getRequest().team;
});
