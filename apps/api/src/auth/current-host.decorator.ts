import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface CurrentHostPayload {
  id: string;
}

export const CurrentHost = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentHostPayload => {
  return ctx.switchToHttp().getRequest().host;
});
