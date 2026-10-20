import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface CurrentHostPayload {
  id: string;
}

export const CurrentHost = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentHostPayload => {
  // Note: stored as `authHost` rather than `host` — Express defines a
  // deprecated getter-only `req.host` property, and assigning to it throws
  // ("Cannot set property host ... which has only a getter") on a real
  // Express request, as opposed to the plain mock objects used in guard unit tests.
  return ctx.switchToHttp().getRequest().authHost;
});
